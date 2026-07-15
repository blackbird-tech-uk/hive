from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from hive.modules.devices.models import Device


class DeviceRepository:
    """Database access for Hive-managed devices."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, device: Device) -> Device:
        self.db.add(device)
        self.db.flush()
        return device

    def get_by_id(self, device_id: uuid.UUID) -> Device | None:
        return self.db.scalar(
            select(Device).where(Device.id == device_id)
        )

    def get_by_asset_id(self, asset_id: str) -> Device | None:
        return self.db.scalar(
            select(Device).where(Device.asset_id == asset_id)
        )

    def get_by_serial_number(self, serial_number: str) -> Device | None:
        return self.db.scalar(
            select(Device).where(Device.serial_number == serial_number)
        )

    def get_by_imei(self, imei: str) -> Device | None:
        return self.db.scalar(
            select(Device).where(Device.imei == imei)
        )

    def list_all(self) -> Sequence[Device]:
        return self.db.scalars(
            select(Device).order_by(Device.created_at.desc())
        ).all()