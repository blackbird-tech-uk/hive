from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from hive.db.session import get_db
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
    db: Session = Depends(get_db),
) -> list[AssignmentResponse]:
    service = AssignmentService(db)
    return service.list()


@router.post(
    "",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_assignment(
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
) -> AssignmentResponse:
    service = AssignmentService(db)

    try:
        return service.create(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
