from sqlalchemy.orm import Session

from hive.modules.devices.models import Device


class DeviceRepository:
    """Handles all database operations for devices."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, device: Device) -> Device:
        self.db.add(device)
        self.db.commit()
        self.db.refresh(device)
        return device

    def get_by_id(self, device_id):
        return (
            self.db.query(Device)
            .filter(Device.id == device_id)
            .first()
        )

    def get_by_serial(self, serial_number: str):
        return (
            self.db.query(Device)
            .filter(Device.serial_number == serial_number)
            .first()
        )

    def get_all(self):
        return (
            self.db.query(Device)
            .order_by(Device.created_at.desc())
            .all()
        )