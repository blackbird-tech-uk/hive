from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from hive.modules.device_commands.models import DeviceCommand
from hive.modules.device_commands.repository import (
    DeviceCommandRepository,
)
from hive.modules.device_commands.schemas import (
    DeviceCommandCreate,
)
from hive.modules.devices.repository import DeviceRepository


class DeviceCommandNotFoundError(Exception):
    """Raised when a device command cannot be found."""


class DeviceNotFoundError(Exception):
    """Raised when the target device does not exist."""


class DeviceCommandService:
    """Business logic for device commands."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.commands = DeviceCommandRepository(db)
        self.devices = DeviceRepository(db)

    def create_command(
        self,
        *,
        organization_id: uuid.UUID,
        device_id: uuid.UUID,
        payload: DeviceCommandCreate,
    ) -> DeviceCommand:
        device = self.devices.get_by_id(
            organization_id=organization_id,
            device_id=device_id,
        )

        if device is None:
            raise DeviceNotFoundError(
                "Device does not exist in this organization.",
            )

        command = DeviceCommand(
            device_id=device.id,
            command=payload.command,
            payload=payload.payload,
        )

        command = self.commands.add(command)
        self.db.commit()
        self.db.refresh(command)

        return command

    def list_device_commands(
        self,
        device_id: uuid.UUID,
    ) -> list[DeviceCommand]:
        return list(
            self.commands.list_for_device(device_id),
        )

    def get_command(
        self,
        command_id: uuid.UUID,
    ) -> DeviceCommand:
        command = self.commands.get_by_id(command_id)

        if command is None:
            raise DeviceCommandNotFoundError(
                "Device command not found.",
            )

        return command

    def pending_commands(
        self,
        device_id: uuid.UUID,
    ) -> list[DeviceCommand]:
        return list(
            self.commands.list_pending_for_device(device_id),
        )

    def mark_sent(
        self,
        command_id: uuid.UUID,
    ) -> DeviceCommand:
        command = self.get_command(command_id)
        command = self.commands.mark_sent(command)

        self.db.commit()
        self.db.refresh(command)

        return command

    def acknowledge_command(
        self,
        command_id: uuid.UUID,
    ) -> DeviceCommand:
        command = self.get_command(command_id)
        command = self.commands.mark_acknowledged(command)

        self.db.commit()
        self.db.refresh(command)

        return command

    def complete_command(
        self,
        command_id: uuid.UUID,
        *,
        result_message: str | None = None,
    ) -> DeviceCommand:
        command = self.get_command(command_id)
        command = self.commands.mark_completed(
            command,
            result_message=result_message,
        )

        self.db.commit()
        self.db.refresh(command)

        return command

    def fail_command(
        self,
        command_id: uuid.UUID,
        *,
        result_message: str | None = None,
    ) -> DeviceCommand:
        command = self.get_command(command_id)
        command = self.commands.mark_failed(
            command,
            result_message=result_message,
        )

        self.db.commit()
        self.db.refresh(command)

        return command