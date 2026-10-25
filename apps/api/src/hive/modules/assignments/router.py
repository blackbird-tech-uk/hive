from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from hive.db.session import get_db
from hive.modules.assignments.schemas import (
    AssignmentAreaUpdate,
    AssignmentCreate,
    AssignmentResponse,
)
from hive.modules.assignments.service import AssignmentService
from hive.modules.auth.dependencies import CurrentUser

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
    actor: CurrentUser,
    db: Session = Depends(get_db),
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



@router.patch("/{assignment_id}/area", response_model=AssignmentResponse)
def move_assignment_area(
    assignment_id: uuid.UUID,
    payload: AssignmentAreaUpdate,
    actor: CurrentUser,
    db: Session = Depends(get_db),
) -> AssignmentResponse:
    try:
        return AssignmentService(db).move_area(assignment_id, payload.map_area_id, actor)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
