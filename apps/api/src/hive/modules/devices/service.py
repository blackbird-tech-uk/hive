from __future__ import annotations

import secrets
import uuid
from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from hive.core.security import create_access_token
from hive.modules.devices.models import Device
from hive.modules.devices.repository import DeviceRepository
from hive.modules.devices.schemas import (
    DeviceCreate,
    DeviceTokenResponse,
    DeviceUpdate,
)
from hive.modules.users.models import User


class DeviceAlreadyExistsError(Exception):
    """Raised when a device identifier already exists."""

    def __init__(self, field: str, value: str) -> None:
        self.field = field
        self.value = value
        super().__init__(
            f"A device with {field} '{value}' already exists."
        )


class DeviceNotFoundError(Exception):
    """Raised when a device cannot be found within the tenant."""

    def __init__(self, device_id: object) -> None:
        super().__init__(f"Device '{device_id}' was not found.")


class DevicePermissionDeniedError(Exception):
    """Raised when a user lacks a required device permission."""

    def __init__(self, permission_code: str) -> None:
        self.permission_code = permission_code
        super().__init__(
            f"Permission '{permission_code}' is required."
        )


class DeviceDeletionError(Exception):
    """Raised when a device cannot safely be deleted."""

    def __init__(self, device_id: object) -> None:
        super().__init__(
            f"Device '{device_id}' could not be deleted because "
            "related records still reference it."
        )


class DeviceService:
    """Tenant-aware business rules for managed devices."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = DeviceRepository(db)

    def create_device(
        self,
        *,
        organization_id: uuid.UUID,
        payload: DeviceCreate,
        actor: User,
    ) -> Device:
        self._require_permission(
            organization_id=organization_id,
            actor=actor,
            permission_code="devices.create",
        )

        self._check_for_duplicates(
            organization_id=organization_id,
            payload=payload,
        )

        device = Device(
            organization_id=organization_id,
            hive_id=self._generate_hive_id(organization_id),
            asset_id=payload.asset_id.strip(),
            serial_number=payload.serial_number.strip(),
            imei=payload.imei.strip() if payload.imei else None,
            model=payload.model.strip(),
            android_version=self._clean_optional_text(
                payload.android_version
            ),
            build_version=self._clean_optional_text(
                payload.build_version
            ),
            condition=payload.condition,
            notes=self._clean_optional_text(payload.notes),
        )

        try:
            self.repository.add(device)
            self.db.commit()
            self.db.refresh(device)
        except IntegrityError:
            self.db.rollback()
            raise DeviceAlreadyExistsError(
                "identifier",
                "asset ID, serial number, IMEI or Hive ID",
            ) from None
        except Exception:
            self.db.rollback()
            raise

        return device

    def get_device(
        self,
        *,
        organization_id: uuid.UUID,
        device_id: uuid.UUID,
        actor: User,
    ) -> Device:
        self._require_permission(
            organization_id=organization_id,
            actor=actor,
            permission_code="devices.read",
        )

        device = self.repository.get_by_id(
            organization_id=organization_id,
            device_id=device_id,
        )

        if device is None:
            raise DeviceNotFoundError(device_id)

        return device

    def list_devices(
        self,
        *,
        organization_id: uuid.UUID,
        actor: User,
    ) -> Sequence[Device]:
        self._require_permission(
            organization_id=organization_id,
            actor=actor,
            permission_code="devices.read",
        )

        return self.repository.list_for_organization(
            organization_id
        )

    def update_device(
        self,
        *,
        organization_id: uuid.UUID,
        device_id: uuid.UUID,
        payload: DeviceUpdate,
        actor: User,
    ) -> Device:
        self._require_permission(
            organization_id=organization_id,
            actor=actor,
            permission_code="devices.update",
        )

        device = self.repository.get_by_id(
            organization_id=organization_id,
            device_id=device_id,
        )

        if device is None:
            raise DeviceNotFoundError(device_id)

        updates = payload.model_dump(exclude_unset=True)

        if "asset_id" in updates:
            new_asset_id = updates["asset_id"].strip()

            existing = self.repository.get_by_asset_id(
                organization_id=organization_id,
                asset_id=new_asset_id,
            )

            if (
                existing is not None
                and existing.id != device.id
            ):
                raise DeviceAlreadyExistsError(
                    "asset_id",
                    new_asset_id,
                )

            device.asset_id = new_asset_id

        if "serial_number" in updates:
            new_serial_number = updates[
                "serial_number"
            ].strip()

            existing = self.repository.get_by_serial_number(
                organization_id=organization_id,
                serial_number=new_serial_number,
            )

            if (
                existing is not None
                and existing.id != device.id
            ):
                raise DeviceAlreadyExistsError(
                    "serial_number",
                    new_serial_number,
                )

            device.serial_number = new_serial_number

        if "imei" in updates:
            raw_imei = updates["imei"]
            new_imei = (
                raw_imei.strip()
                if raw_imei
                else None
            )

            if new_imei is not None:
                existing = self.repository.get_by_imei(
                    organization_id=organization_id,
                    imei=new_imei,
                )

                if (
                    existing is not None
                    and existing.id != device.id
                ):
                    raise DeviceAlreadyExistsError(
                        "imei",
                        new_imei,
                    )

            device.imei = new_imei

        if "model" in updates:
            device.model = updates["model"].strip()

        if "android_version" in updates:
            device.android_version = self._clean_optional_text(
                updates["android_version"]
            )

        if "build_version" in updates:
            device.build_version = self._clean_optional_text(
                updates["build_version"]
            )

        if "status" in updates:
            device.status = updates["status"]

        if "condition" in updates:
            device.condition = updates["condition"]

        if "notes" in updates:
            device.notes = self._clean_optional_text(
                updates["notes"]
            )

        try:
            self.db.commit()
            self.db.refresh(device)
        except IntegrityError:
            self.db.rollback()
            raise DeviceAlreadyExistsError(
                "identifier",
                "asset ID, serial number, IMEI or Hive ID",
            ) from None
        except Exception:
            self.db.rollback()
            raise

        return device

    def delete_device(
        self,
        *,
        organization_id: uuid.UUID,
        device_id: uuid.UUID,
        actor: User,
    ) -> None:
        """Permanently remove a device from an organization."""

        # Reuse an existing permission until a dedicated
        # devices.delete permission is added to the RBAC seed.
        self._require_permission(
            organization_id=organization_id,
            actor=actor,
            permission_code="devices.update",
        )

        device = self.repository.get_by_id(
            organization_id=organization_id,
            device_id=device_id,
        )

        if device is None:
            raise DeviceNotFoundError(device_id)

        try:
            self.repository.delete(device)
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise DeviceDeletionError(device_id) from None
        except Exception:
            self.db.rollback()
            raise

    def issue_device_token(
        self,
        *,
        organization_id: uuid.UUID,
        device_id: uuid.UUID,
        actor: User,
    ) -> DeviceTokenResponse:
        """Rotate and issue a JWT for an existing enrolled device."""

        self._require_permission(
            organization_id=organization_id,
            actor=actor,
            permission_code="devices.update",
        )

        device = self.repository.get_by_id(
            organization_id=organization_id,
            device_id=device_id,
        )

        if device is None:
            raise DeviceNotFoundError(device_id)

        # Generate the replacement before invalidating the existing token.
        # If signing fails, the currently enrolled scanner stays authorised.
        device.device_token_version += 1

        try:
            device_token, expires_in = create_access_token(
                subject=str(device.id),
                additional_claims={
                    "type": "device",
                    "organization_id": str(device.organization_id),
                    "token_version": device.device_token_version,
                },
            )
            self.db.commit()
            self.db.refresh(device)
        except Exception:
            self.db.rollback()
            raise

        return DeviceTokenResponse(
            device_id=device.id,
            organization_id=device.organization_id,
            hive_id=device.hive_id,
            device_token=device_token,
            token_type="Bearer",
            expires_in=expires_in,
            token_version=device.device_token_version,
        )

    def _require_permission(
        self,
        *,
        organization_id: uuid.UUID,
        actor: User,
        permission_code: str,
    ) -> None:
        has_permission = (
            self.repository.user_has_permission(
                organization_id=organization_id,
                user_id=actor.id,
                permission_code=permission_code,
            )
        )

        if not has_permission:
            raise DevicePermissionDeniedError(
                permission_code
            )

    def _check_for_duplicates(
        self,
        *,
        organization_id: uuid.UUID,
        payload: DeviceCreate,
    ) -> None:
        asset_id = payload.asset_id.strip()
        serial_number = payload.serial_number.strip()

        if self.repository.get_by_asset_id(
            organization_id=organization_id,
            asset_id=asset_id,
        ):
            raise DeviceAlreadyExistsError(
                "asset_id",
                asset_id,
            )

        if self.repository.get_by_serial_number(
            organization_id=organization_id,
            serial_number=serial_number,
        ):
            raise DeviceAlreadyExistsError(
                "serial_number",
                serial_number,
            )

        if payload.imei:
            imei = payload.imei.strip()

            if self.repository.get_by_imei(
                organization_id=organization_id,
                imei=imei,
            ):
                raise DeviceAlreadyExistsError(
                    "imei",
                    imei,
                )

    def _generate_hive_id(
        self,
        organization_id: uuid.UUID,
    ) -> str:
        for _ in range(20):
            candidate = (
                f"HB-{secrets.token_hex(3).upper()}"
            )

            existing = self.repository.get_by_hive_id(
                organization_id=organization_id,
                hive_id=candidate,
            )

            if existing is None:
                return candidate

        raise RuntimeError(
            "Unable to generate a unique Hive ID."
        )

    @staticmethod
    def _clean_optional_text(
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()
        return cleaned or None