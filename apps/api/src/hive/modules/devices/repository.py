from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from hive.modules.devices.models import Device
from hive.modules.organizations.models import (
    MembershipStatus,
    OrganizationMembership,
)
from hive.modules.rbac.models import (
    MembershipRole,
    Permission,
    RolePermission,
)


class DeviceRepository:
    """Tenant-scoped database access for managed devices."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, device: Device) -> Device:
        self.db.add(device)
        self.db.flush()
        return device

    def get_by_id(
        self,
        *,
        organization_id: uuid.UUID,
        device_id: uuid.UUID,
    ) -> Device | None:
        statement = select(Device).where(
            Device.id == device_id,
            Device.organization_id == organization_id,
        )

        return self.db.scalar(statement)

    def get_by_asset_id(
        self,
        *,
        organization_id: uuid.UUID,
        asset_id: str,
    ) -> Device | None:
        statement = select(Device).where(
            Device.organization_id == organization_id,
            Device.asset_id == asset_id,
        )

        return self.db.scalar(statement)

    def get_by_serial_number(
        self,
        *,
        organization_id: uuid.UUID,
        serial_number: str,
    ) -> Device | None:
        statement = select(Device).where(
            Device.organization_id == organization_id,
            Device.serial_number == serial_number,
        )

        return self.db.scalar(statement)

    def get_by_imei(
        self,
        *,
        organization_id: uuid.UUID,
        imei: str,
    ) -> Device | None:
        statement = select(Device).where(
            Device.organization_id == organization_id,
            Device.imei == imei,
        )

        return self.db.scalar(statement)

    def get_by_hive_id(
        self,
        *,
        organization_id: uuid.UUID,
        hive_id: str,
    ) -> Device | None:
        statement = select(Device).where(
            Device.organization_id == organization_id,
            Device.hive_id == hive_id,
        )

        return self.db.scalar(statement)

    def list_for_organization(
        self,
        organization_id: uuid.UUID,
    ) -> Sequence[Device]:
        statement = (
            select(Device)
            .where(Device.organization_id == organization_id)
            .order_by(Device.created_at.desc())
        )

        return self.db.scalars(statement).all()

    def user_has_permission(
        self,
        *,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        permission_code: str,
    ) -> bool:
        statement = (
            select(Permission.id)
            .join(
                RolePermission,
                RolePermission.permission_id == Permission.id,
            )
            .join(
                MembershipRole,
                MembershipRole.role_id == RolePermission.role_id,
            )
            .join(
                OrganizationMembership,
                OrganizationMembership.id
                == MembershipRole.membership_id,
            )
            .where(
                OrganizationMembership.organization_id
                == organization_id,
                OrganizationMembership.user_id == user_id,
                OrganizationMembership.status
                == MembershipStatus.ACTIVE,
                Permission.code == permission_code,
            )
            .limit(1)
        )

        return self.db.scalar(statement) is not None