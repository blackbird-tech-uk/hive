from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from hive.modules.device_commands.models import (
    DeviceCommand,
    DeviceCommandStatus,
)


class DeviceCommandRepository:
    """Database access for device commands."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def add(
        self,
        device_command: DeviceCommand,
    ) -> DeviceCommand:
        self.db.add(device_command)
        self.db.flush()
        self.db.refresh(device_command)
        return device_command

    def get_by_id(
        self,
        command_id: uuid.UUID,
    ) -> DeviceCommand | None:
        statement = select(DeviceCommand).where(
            DeviceCommand.id == command_id,
        )

        return self.db.scalar(statement)

    def list_for_device(
        self,
        device_id: uuid.UUID,
    ) -> Sequence[DeviceCommand]:
        statement = (
            select(DeviceCommand)
            .where(DeviceCommand.device_id == device_id)
            .order_by(DeviceCommand.created_at.desc())
        )

        return self.db.scalars(statement).all()

    def list_pending_for_device(
        self,
        device_id: uuid.UUID,
    ) -> Sequence[DeviceCommand]:
        statement = (
            select(DeviceCommand)
            .where(
                DeviceCommand.device_id == device_id,
                DeviceCommand.status == DeviceCommandStatus.PENDING,
            )
            .order_by(DeviceCommand.created_at.asc())
        )

        return self.db.scalars(statement).all()

    def expire_unconfirmed_for_device(
        self,
        device_id: uuid.UUID,
        *,
        older_than_minutes: int = 30,
    ) -> int:
        """Mark stale delivered commands as unconfirmed; never replay them.

        A device may have executed a command even when its result was lost.
        Avoid automatic retries, especially for lock and reboot commands.
        """
        cutoff = datetime.now(UTC) - timedelta(minutes=older_than_minutes)
        statement = select(DeviceCommand).where(
            DeviceCommand.device_id == device_id,
            DeviceCommand.status.in_([
                DeviceCommandStatus.SENT,
                DeviceCommandStatus.ACKNOWLEDGED,
            ]),
            DeviceCommand.sent_at < cutoff,
        )
        stale = self.db.scalars(statement).all()
        for command in stale:
            command.status = DeviceCommandStatus.FAILED
            command.result_message = (
                "Result unconfirmed after 30 minutes; command may have "
                "executed. Do not automatically retry."
            )
            command.completed_at = datetime.now(UTC)
        if stale:
            self.db.flush()
        return len(stale)

    def mark_sent(
        self,
        device_command: DeviceCommand,
    ) -> DeviceCommand:
        device_command.status = DeviceCommandStatus.SENT
        device_command.sent_at = datetime.now(UTC)

        self.db.flush()
        self.db.refresh(device_command)
        return device_command

    def mark_acknowledged(
        self,
        device_command: DeviceCommand,
    ) -> DeviceCommand:
        device_command.status = DeviceCommandStatus.ACKNOWLEDGED
        device_command.acknowledged_at = datetime.now(UTC)

        self.db.flush()
        self.db.refresh(device_command)
        return device_command

    def mark_completed(
        self,
        device_command: DeviceCommand,
        *,
        result_message: str | None = None,
    ) -> DeviceCommand:
        device_command.status = DeviceCommandStatus.COMPLETED
        device_command.result_message = result_message
        device_command.completed_at = datetime.now(UTC)

        self.db.flush()
        self.db.refresh(device_command)
        return device_command

    def mark_failed(
        self,
        device_command: DeviceCommand,
        *,
        result_message: str | None = None,
    ) -> DeviceCommand:
        device_command.status = DeviceCommandStatus.FAILED
        device_command.result_message = result_message
        device_command.completed_at = datetime.now(UTC)

        self.db.flush()
        self.db.refresh(device_command)
        return device_command