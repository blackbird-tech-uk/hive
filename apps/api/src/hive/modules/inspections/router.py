from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from hive.db.session import get_db
from hive.modules.auth.dependencies import CurrentUser
from hive.modules.devices.service import DeviceNotFoundError, DevicePermissionDeniedError, DeviceService
from hive.modules.inspections.models import ScannerInspection
from hive.modules.inspections.schemas import InspectionCreate, InspectionResponse

router = APIRouter(prefix="/organizations/{organization_id}/devices/{device_id}/inspections", tags=["Scanner inspections"])


def require_device(db: Session, organization_id: UUID, device_id: UUID, actor: CurrentUser, write: bool = False) -> None:
    service = DeviceService(db)
    try:
        service.get_device(organization_id=organization_id, device_id=device_id, actor=actor)
        if write:
            service._require_permission(organization_id=organization_id, actor=actor, permission_code="devices.update")
    except DevicePermissionDeniedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except DeviceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("", response_model=list[InspectionResponse])
def list_inspections(organization_id: UUID, device_id: UUID, actor: CurrentUser, db: Session = Depends(get_db), limit: int = 50) -> list[ScannerInspection]:
    require_device(db, organization_id, device_id, actor)
    if not 1 <= limit <= 100:
        raise HTTPException(status_code=422, detail="Limit must be between 1 and 100")
    return list(db.scalars(select(ScannerInspection).where(ScannerInspection.organization_id == organization_id, ScannerInspection.device_id == device_id).order_by(ScannerInspection.inspected_at.desc()).limit(limit)).all())


@router.post("", response_model=InspectionResponse, status_code=status.HTTP_201_CREATED)
def create_inspection(organization_id: UUID, device_id: UUID, payload: InspectionCreate, actor: CurrentUser, db: Session = Depends(get_db)) -> ScannerInspection:
    require_device(db, organization_id, device_id, actor, write=True)
    inspection = ScannerInspection(organization_id=organization_id, device_id=device_id, inspected_by_user_id=actor.id, **payload.model_dump())
    db.add(inspection)
    db.commit()
    db.refresh(inspection)
    return inspection
