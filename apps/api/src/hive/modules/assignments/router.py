from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from hive.db.session import get_db
from hive.modules.auth.dependencies import CurrentUser
from hive.modules.assignments.schemas import (
    AssignmentCreate,
    AssignmentResponse,
)
from hive.modules.assignments.service import AssignmentService

router = APIRouter(
    prefix="/assignments",
    tags=["Assignments"],
)


@router.get("", response_model=list[AssignmentResponse])
def list_assignments(
    actor: CurrentUser,
    db: Session = Depends(get_db),
) -> list[AssignmentResponse]:
    service = AssignmentService(db)
    return service.list(actor)


@router.post(
    "",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_assignment(
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
    actor: CurrentUser = None,
) -> AssignmentResponse:
    service = AssignmentService(db)

    try:
        return service.create(payload, actor)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

