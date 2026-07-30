from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from hive.modules.device_agent.repository import (
    DeviceAgentRepository,
)
from hive.modules.device_agent.schemas import (
    DeviceAgentResponse,
    DeviceCommandDelivery,
    DeviceHeartbeatRequest,
    DeviceHeartbeatResponse,
    DeviceLocationResponse,
    DeviceLocationUpload,
)
from hive.modules.device_commands.repository import (
    DeviceCommandRepository,
)
from hive.modules.device_locations.models import DeviceLocation
from hive.modules.devices.models import Device


def utc_now() -> datetime:
    """Return the current UTC time."""

    return datetime.now(UTC)


class DeviceAgentService:
    """Business logic for authenticated device agents."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = DeviceAgentRepository(db)
        self.commands = DeviceCommandRepository(db)

    def get_current_device(
        self,
        device: Device,
    ) -> DeviceAgentResponse:
        """Return information about the authenticated device."""

        return DeviceAgentResponse.model_validate(device)

    def record_heartbeat(
        self,
        *,
        device: Device,
        payload: DeviceHeartbeatRequest,
    ) -> DeviceHeartbeatResponse:
        """Store telemetry and deliver pending commands."""

        now = utc_now()

        device.last_seen_at = now

        if payload.battery_level is not None:
            device.battery_level = payload.battery_level

        if payload.is_charging is not None:
            device.is_charging = payload.is_charging

        if payload.wifi_ssid is not None:
            device.wifi_ssid = self._clean_optional_text(
                payload.wifi_ssid,
            )

        if payload.ip_address is not None:
            device.ip_address = self._clean_optional_text(
                payload.ip_address,
            )

        if payload.agent_version is not None:
            device.agent_version = self._clean_optional_text(
                payload.agent_version,
            )

        if payload.android_version is not None:
            device.android_version = self._clean_optional_text(
                payload.android_version,
            )

        if payload.build_version is not None:
            device.build_version = self._clean_optional_text(
                payload.build_version,
            )

        delivered_commands: list[DeviceCommandDelivery] = []

        try:
            self.repository.update_last_seen(
                device,
                now=now,
            )

            pending_commands = (
                self.commands.list_pending_for_device(
                    device.id,
                )
            )

            for command in pending_commands:
                self.commands.mark_sent(command)

                delivered_commands.append(
                    DeviceCommandDelivery(
                        id=command.id,
                        command=command.command,
                        payload=command.payload,
                        created_at=command.created_at,
                    )
                )

            self.db.commit()
            self.db.refresh(device)

        except Exception:
            self.db.rollback()
            raise

        return DeviceHeartbeatResponse(
            device_id=device.id,
            hive_id=device.hive_id,
            accepted=True,
            server_time=now,
            heartbeat_interval_seconds=300,
            last_seen_at=device.last_seen_at,
            commands=delivered_commands,
        )

    def record_location(
        self,
        *,
        device: Device,
        payload: DeviceLocationUpload,
    ) -> DeviceLocationResponse:
        """Store a location report from an authenticated device."""

        now = utc_now()

        location = DeviceLocation(
            organization_id=device.organization_id,
            device_id=device.id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            accuracy=payload.accuracy,
            altitude=payload.altitude,
            speed=payload.speed,
            bearing=payload.bearing,
            provider=self._clean_optional_text(
                payload.provider,
            ),
            recorded_at=payload.recorded_at,
        )

        try:
            saved_location = self.repository.add_location(
                location,
            )

            self.repository.update_last_seen(
                device,
                now=now,
            )

            self.db.commit()
            self.db.refresh(saved_location)
            self.db.refresh(device)

        except Exception:
            self.db.rollback()
            raise

        return DeviceLocationResponse.model_validate(
            saved_location,
        )

    @staticmethod
    def _clean_optional_text(
        value: str | None,
    ) -> str | None:
        """Trim optional text and convert blank strings to None."""

        if value is None:
            return None

        cleaned = value.strip()

        return cleaned or None