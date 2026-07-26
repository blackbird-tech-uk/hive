from __future__ import annotations

import asyncio
import uuid
import logging
import jwt

logger = logging.getLogger(__name__)

from fastapi import APIRouter, WebSocket, WebSocketDisconnect


from sqlalchemy.orm import Session

from hive.core.realtime import device_connection_manager
from hive.core.security import decode_access_token
from hive.db.session import SessionLocal
from hive.modules.organizations.service import OrganizationService
from hive.modules.users.repository import UserRepository

router = APIRouter(
    prefix="/realtime",
    tags=["Realtime"],
)


@router.websocket(
    "/organizations/{organization_id}/devices"
)
async def device_updates(
    websocket: WebSocket,
    organization_id: uuid.UUID,
) -> None:
    token = websocket.query_params.get("token")

    if not token:
        await websocket.close(code=1008)
        return

    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")

        if not subject:
            await websocket.close(code=1008)
            return

        user_id = uuid.UUID(subject)

    except (
        jwt.InvalidTokenError,
        ValueError,
        TypeError,
    ):
        await websocket.close(code=1008)
        return

    db: Session = SessionLocal()

    try:
        user = UserRepository(db).get_by_id(user_id)

        if user is None or not user.is_active:
            await websocket.close(code=1008)
            return

        OrganizationService(db).get_organization_for_user(
            organization_id=organization_id,
            actor=user,
        )

        await device_connection_manager.connect(
            organization_id=organization_id,
            websocket=websocket,
        )

        while True:
            await asyncio.sleep(30)

            await websocket.send_json(
                {
                    "type": "ping",
                }
            )

    except WebSocketDisconnect:
        pass

    except Exception:
        logger.exception(
            "Realtime WebSocket failed for organization %s",
            organization_id,
        )

        try:
            await websocket.close(code=1011)
        except RuntimeError:
            pass

    finally:
        device_connection_manager.disconnect(
            organization_id=organization_id,
            websocket=websocket,
        )
        db.close()