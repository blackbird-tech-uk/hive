from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from hive.modules.inventory.models import InstalledApplication


class InstalledApplicationRepository:
    """Persistence for installed application inventory."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_for_device(
        self,
        *,
        organization_id: uuid.UUID,
        device_id: uuid.UUID,
    ) -> list[InstalledApplication]:
        statement = (
            select(InstalledApplication)
            .where(
                InstalledApplication.organization_id
                == organization_id,
                InstalledApplication.device_id == device_id,
            )
            .order_by(
                InstalledApplication.is_system_app.asc(),
                InstalledApplication.app_name.asc().nullslast(),
                InstalledApplication.package_name.asc(),
            )
        )

        return list(
            self.db.scalars(statement).all()
        )

    def delete_for_device(
        self,
        *,
        organization_id: uuid.UUID,
        device_id: uuid.UUID,
    ) -> None:
        self.db.execute(
            delete(InstalledApplication).where(
                InstalledApplication.organization_id
                == organization_id,
                InstalledApplication.device_id == device_id,
            )
        )

    def add(
        self,
        application: InstalledApplication,
    ) -> InstalledApplication:
        self.db.add(application)
        return application
