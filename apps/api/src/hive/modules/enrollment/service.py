from __future__ import annotations

import hashlib
import secrets
import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from hive.core.config import settings
from hive.core.security import create_access_token
from hive.modules.devices.models import (
    Device,
    DeviceCondition,
    DeviceStatus,
)
from hive.modules.devices.repository import DeviceRepository
from hive.modules.enrollment.exceptions import (
    EnrolledDeviceAlreadyExistsError,
    EnrollmentPermissionDeniedError,
    EnrollmentTokenAlreadyRevokedError,
    EnrollmentTokenExhaustedError,
    EnrollmentTokenExpiredError,
    EnrollmentTokenNotFoundError,
    EnrollmentTokenRevokedError,
    InvalidEnrollmentTokenError,
)
from hive.modules.enrollment.models import EnrollmentToken
from hive.modules.enrollment.repository import EnrollmentRepository
from hive.modules.enrollment.schemas import (
    DeviceEnrollmentRequest,
    DeviceEnrollmentResponse,
    EnrollmentTokenCreate,
    EnrollmentTokenCreatedResponse,
)
from hive.modules.users.models import User


def utc_now() -> datetime:
    """Return the current UTC time."""
    return datetime.now(timezone.utc)


class EnrollmentService:
    """Business rules for token management and device enrollment."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = EnrollmentRepository(db)
        self.device_repository = DeviceRepository(db)

    def create_token(
        self,
        *,
        organization_id: uuid.UUID,
        payload: EnrollmentTokenCreate,
        actor: User,
    ) -> EnrollmentTokenCreatedResponse:
        """Create a plaintext enrollment token and store only its hash."""

        self._require_permission(
            organization_id=organization_id,
            actor=actor,
            permission_code="enrollment.manage",
        )

        plaintext_token = self._generate_plaintext_token()
        token_hash = self.hash_token(plaintext_token)
        now = utc_now()

        # Temporary debugging output. Remove after enrollment is confirmed.
       

        enrollment_token = EnrollmentToken(
            organization_id=organization_id,
            created_by_user_id=actor.id,
            token_hash=token_hash,
            token_prefix=plaintext_token[:14],
            label=self._clean_optional_text(payload.label),
            max_uses=payload.max_uses,
            use_count=0,
            expires_at=now
            + timedelta(hours=payload.expires_in_hours),
        )

        try:
            self.repository.add(enrollment_token)
            self.db.commit()
            self.db.refresh(enrollment_token)
        except IntegrityError:
            self.db.rollback()
            raise RuntimeError(
                "Unable to generate a unique enrollment token."
            ) from None
        except Exception:
            self.db.rollback()
            raise

        return EnrollmentTokenCreatedResponse(
            id=enrollment_token.id,
            organization_id=enrollment_token.organization_id,
            token=plaintext_token,
            token_prefix=enrollment_token.token_prefix,
            label=enrollment_token.label,
            max_uses=enrollment_token.max_uses,
            use_count=enrollment_token.use_count,
            expires_at=enrollment_token.expires_at,
            created_at=enrollment_token.created_at,
        )

    def list_tokens(
        self,
        *,
        organization_id: uuid.UUID,
        actor: User,
    ) -> Sequence[EnrollmentToken]:
        """Return safe enrollment-token metadata for an organization."""

        self._require_permission(
            organization_id=organization_id,
            actor=actor,
            permission_code="enrollment.manage",
        )

        return self.repository.list_for_organization(
            organization_id
        )

    def revoke_token(
        self,
        *,
        organization_id: uuid.UUID,
        token_id: uuid.UUID,
        actor: User,
    ) -> EnrollmentToken:
        """Revoke an enrollment token."""

        self._require_permission(
            organization_id=organization_id,
            actor=actor,
            permission_code="enrollment.manage",
        )

        enrollment_token = self.repository.get_by_id(
            organization_id=organization_id,
            token_id=token_id,
        )

        if enrollment_token is None:
            raise EnrollmentTokenNotFoundError(token_id)

        if enrollment_token.revoked_at is not None:
            raise EnrollmentTokenAlreadyRevokedError(token_id)

        enrollment_token.revoked_at = utc_now()

        try:
            self.db.commit()
            self.db.refresh(enrollment_token)
        except Exception:
            self.db.rollback()
            raise

        return enrollment_token

    def redeem_token(
        self,
        payload: DeviceEnrollmentRequest,
    ) -> DeviceEnrollmentResponse:
        """Enroll a new device or re-enrol an existing physical device."""

        token_hash = self.hash_token(payload.token)
        now = utc_now()

        try:
            enrollment_token = (
                self.repository.get_by_hash_for_update(token_hash)
            )

            if enrollment_token is None:
                raise InvalidEnrollmentTokenError()

            if enrollment_token.revoked_at is not None:
                raise EnrollmentTokenRevokedError()

            if enrollment_token.expires_at <= now:
                raise EnrollmentTokenExpiredError()

            if (
                enrollment_token.use_count
                >= enrollment_token.max_uses
            ):
                raise EnrollmentTokenExhaustedError()

            organization_id = enrollment_token.organization_id
            serial_number = payload.serial_number.strip()

            requested_asset_id = (
                payload.asset_id.strip()
                if payload.asset_id
                else None
            )

            requested_imei = (
                payload.imei.strip()
                if payload.imei
                else None
            )

            existing_device = (
                self.device_repository.get_by_serial_number(
                    organization_id=organization_id,
                    serial_number=serial_number,
                )
            )

            if existing_device is not None:
                device = self._reenroll_existing_device(
                    device=existing_device,
                    payload=payload,
                    requested_asset_id=requested_asset_id,
                    requested_imei=requested_imei,
                    now=now,
                )
            else:
                asset_id = requested_asset_id or serial_number

                self._check_device_identifiers(
                    organization_id=organization_id,
                    asset_id=asset_id,
                    serial_number=serial_number,
                    imei=requested_imei,
                )

                device = Device(
                    organization_id=organization_id,
                    hive_id=self._generate_hive_id(
                        organization_id
                    ),
                    asset_id=asset_id,
                    serial_number=serial_number,
                    imei=requested_imei,
                    manufacturer=self._clean_optional_text(
                        payload.manufacturer
                    ),
                    model=payload.model.strip(),
                    android_version=self._clean_optional_text(
                        payload.android_version
                    ),
                    build_version=self._clean_optional_text(
                        payload.build_version
                    ),
                    status=DeviceStatus.AVAILABLE,
                    condition=DeviceCondition.GOOD,
                    device_token_version=1,
                    enrolled_at=now,
                    last_seen_at=now,
                )

                self.device_repository.add(device)

            enrollment_token.use_count += 1
            enrollment_token.last_used_at = now

            self.db.flush()

            device_token, expires_in = create_access_token(
                subject=str(device.id),
                additional_claims={
                    "type": "device",
                    "organization_id": str(
                        device.organization_id
                    ),
                    "token_version": (
                        device.device_token_version
                    ),
                },
                expires_in_minutes=settings.device_token_expire_minutes,
            )

            self.db.commit()
            self.db.refresh(device)

        except (
            InvalidEnrollmentTokenError,
            EnrollmentTokenRevokedError,
            EnrollmentTokenExpiredError,
            EnrollmentTokenExhaustedError,
            EnrolledDeviceAlreadyExistsError,
        ):
            self.db.rollback()
            raise
        except IntegrityError:
            self.db.rollback()
            raise EnrolledDeviceAlreadyExistsError(
                "identifier",
                "asset ID, serial number, IMEI or Hive ID",
            ) from None
        except Exception:
            self.db.rollback()
            raise

        return DeviceEnrollmentResponse(
            device_id=device.id,
            organization_id=device.organization_id,
            hive_id=device.hive_id,
            device_token=device_token,
            expires_in=expires_in,
            enrolled_at=device.enrolled_at,
        )

    def _require_permission(
        self,
        *,
        organization_id: uuid.UUID,
        actor: User,
        permission_code: str,
    ) -> None:
        has_permission = self.repository.user_has_permission(
            organization_id=organization_id,
            user_id=actor.id,
            permission_code=permission_code,
        )

        if not has_permission:
            raise EnrollmentPermissionDeniedError(
                permission_code
            )

    def _reenroll_existing_device(
        self,
        *,
        device: Device,
        payload: DeviceEnrollmentRequest,
        requested_asset_id: str | None,
        requested_imei: str | None,
        now: datetime,
    ) -> Device:
        """Re-enrol an existing device and rotate its credentials."""

        organization_id = device.organization_id

        if requested_asset_id is not None:
            asset_owner = self.device_repository.get_by_asset_id(
                organization_id=organization_id,
                asset_id=requested_asset_id,
            )

            if (
                asset_owner is not None
                and asset_owner.id != device.id
            ):
                raise EnrolledDeviceAlreadyExistsError(
                    "asset_id",
                    requested_asset_id,
                )

            device.asset_id = requested_asset_id

        if requested_imei is not None:
            imei_owner = self.device_repository.get_by_imei(
                organization_id=organization_id,
                imei=requested_imei,
            )

            if (
                imei_owner is not None
                and imei_owner.id != device.id
            ):
                raise EnrolledDeviceAlreadyExistsError(
                    "imei",
                    requested_imei,
                )

            device.imei = requested_imei

        device.manufacturer = self._clean_optional_text(
            payload.manufacturer
        )
        device.model = payload.model.strip()
        device.android_version = self._clean_optional_text(
            payload.android_version
        )
        device.build_version = self._clean_optional_text(
            payload.build_version
        )

        device.enrolled_at = now
        device.last_seen_at = now

        # Invalidates any previously issued JWT for this device.
        device.device_token_version += 1

        self.db.add(device)

        return device

    def _check_device_identifiers(
        self,
        *,
        organization_id: uuid.UUID,
        asset_id: str,
        serial_number: str,
        imei: str | None,
    ) -> None:
        existing = self.device_repository.get_by_asset_id(
            organization_id=organization_id,
            asset_id=asset_id,
        )

        if existing is not None:
            raise EnrolledDeviceAlreadyExistsError(
                "asset_id",
                asset_id,
            )

        existing = self.device_repository.get_by_serial_number(
            organization_id=organization_id,
            serial_number=serial_number,
        )

        if existing is not None:
            raise EnrolledDeviceAlreadyExistsError(
                "serial_number",
                serial_number,
            )

        if imei is not None:
            existing = self.device_repository.get_by_imei(
                organization_id=organization_id,
                imei=imei,
            )

            if existing is not None:
                raise EnrolledDeviceAlreadyExistsError(
                    "imei",
                    imei,
                )

    def _generate_hive_id(
        self,
        organization_id: uuid.UUID,
    ) -> str:
        """Generate a readable Hive identifier unique to one tenant."""

        for _ in range(20):
            candidate = f"HB-{secrets.token_hex(3).upper()}"

            existing = self.device_repository.get_by_hive_id(
                organization_id=organization_id,
                hive_id=candidate,
            )

            if existing is None:
                return candidate

        raise RuntimeError(
            "Unable to generate a unique Hive ID."
        )

    @staticmethod
    def hash_token(token: str) -> str:
        """Create a SHA-256 digest of a normalized token."""

        normalized = token.strip().upper()

        return hashlib.sha256(
            normalized.encode("utf-8")
        ).hexdigest()

    @staticmethod
    def _generate_plaintext_token() -> str:
        """Generate a readable high-entropy enrollment token."""

        first = secrets.token_hex(3).upper()
        second = secrets.token_hex(3).upper()
        third = secrets.token_hex(3).upper()

        return f"HIVE-{first}-{second}-{third}"

    @staticmethod
    def _clean_optional_text(
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        return cleaned or None