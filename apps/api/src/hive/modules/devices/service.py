from __future__ import annotations

import secrets
import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from hive.modules.devices.models import Device
from hive.modules.devices.repository import DeviceRepository
from hive.modules.devices.schemas import DeviceCreate


class DeviceAlreadyExistsError(Exception):
    """Raised when a unique device identifier already exists."""

    def __init__(self, field: str, value: str) -> None:
        self.field = field
        self.value = value
        super().__init__(f"A device with {field} '{value}' already exists.")


class DeviceNotFoundError(Exception):
    """Raised when a requested device cannot be found."""

    def __init__(self, device_id: object) -> None:
        super().__init__(f"Device '{device_id}' was not found.")


class DeviceService:
    """Business rules for registering and retrieving devices."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = DeviceRepository(db)

    def create_device(self, payload: DeviceCreate) -> Device:
        self._check_for_duplicates(payload)

        device = Device(
            hive_id=self._generate_hive_id(),
            asset_id=payload.asset_id.strip(),
            serial_number=payload.serial_number.strip(),
            imei=payload.imei.strip() if payload.imei else None,
            model=payload.model.strip(),
            android_version=payload.android_version,
            build_version=payload.build_version,
            condition=payload.condition,
            notes=payload.notes,
        )

        try:
            self.repository.add(device)
            self.db.commit()
            self.db.refresh(device)
        except IntegrityError:
            self.db.rollback()
            raise DeviceAlreadyExistsError(
                "identifier",
                "asset ID, serial number or IMEI",
            ) from None

        return device

    def get_device(self, device_id: uuid.UUID) -> Device:
        device = self.repository.get_by_id(device_id)

        if device is None:
            raise DeviceNotFoundError(device_id)

        return device

    def list_devices(self) -> Sequence[Device]:
        return self.repository.list_all()

    def _check_for_duplicates(self, payload: DeviceCreate) -> None:
        asset_id = payload.asset_id.strip()
        serial_number = payload.serial_number.strip()

        if self.repository.get_by_asset_id(asset_id):
            raise DeviceAlreadyExistsError("asset_id", asset_id)

        if self.repository.get_by_serial_number(serial_number):
            raise DeviceAlreadyExistsError(
                "serial_number",
                serial_number,
            )

        if payload.imei:
            imei = payload.imei.strip()

            if self.repository.get_by_imei(imei):
                raise DeviceAlreadyExistsError("imei", imei)

    def _generate_hive_id(self) -> str:
        """Generate a readable unique Hive identifier."""
        for _ in range(10):
            candidate = f"HB-{secrets.token_hex(3).upper()}"

            exists = self.db.scalar(
                select(Device.id).where(Device.hive_id == candidate)
            )

            if not exists:
                return candidate

        raise RuntimeError("Unable to generate a unique Hive ID.")