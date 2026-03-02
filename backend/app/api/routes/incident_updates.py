from fastapi import APIRouter, Depends, HTTPException, status

from app.api.routes.auth import get_current_user
from app.schemas.incident import IncidentUpdateCreate
from app.services import incident_updates_service as svc

router = APIRouter()


@router.get("/incidents/{incident_id}/updates", summary="List incident timeline updates")
def list_incident_updates(incident_id: str, limit: int = 100):
    return {"updates": svc.list_incident_updates(incident_id, limit=limit)}


@router.post("/incidents/{incident_id}/updates", status_code=status.HTTP_201_CREATED, summary="Add incident update")
def create_incident_update(
    incident_id: str,
    body: IncidentUpdateCreate,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] == "civilian":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coordinators and firefighters can add timeline updates",
        )
    return svc.create_incident_update(
        incident_id=incident_id,
        content=body.content,
        user_id=str(current_user["id"]),
        status_before=body.status_before,
        status_after=body.status_after,
    )
