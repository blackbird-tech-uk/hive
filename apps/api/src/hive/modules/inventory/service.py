from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from hive.modules.devices.models import Device
from hive.modules.inventory.models import InstalledApplication
from hive.modules.inventory.repository import InstalledApplicationRepository
from hive.modules.inventory.schemas import (
    InstalledApplicationInventoryResponse,
    InstalledApplicationInventoryUpload,
    InstalledApplicationResponse,
)


class InstalledApplicationService:
    """Business logic for application inventory."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = InstalledApplicationRepository(db)

    def replace_inventory(
        self,
        *,
        device: Device,
        payload: InstalledApplicationInventoryUpload,
    ) -> InstalledApplicationInventoryResponse:
        reported_at = datetime.now(UTC)

        try:
            self.repository.delete_for_device(
                organization_id=device.organization_id,
                device_id=device.id,
            )

            for item in payload.applications:
                self.repository.add(
                    InstalledApplication(
                        organization_id=device.organization_id,
                        device_id=device.id,
                        package_name=item.package_name,
                        app_name=item.app_name,
                        version_name=item.version_name,
                        version_code=item.version_code,
                        is_system_app=item.is_system_app,
                        is_enabled=item.is_enabled,
                        first_installed_at=item.first_installed_at,
                        last_updated_at=item.last_updated_at,
                        reported_at=reported_at,
                    )
                )

            self.db.commit()

        except Exception:
            self.db.rollback()
            raise

        return InstalledApplicationInventoryResponse(
            device_id=device.id,
            application_count=len(payload.applications),
            reported_at=reported_at,
        )

    def list_inventory(
        self,
        *,
        organization_id,
        device_id,
    ) -> list[InstalledApplicationResponse]:
        applications = self.repository.list_for_device(
            organization_id=organization_id,
            device_id=device_id,
        )

        return [
            InstalledApplicationResponse.model_validate(
                application
            )
            for application in applications
        ]
