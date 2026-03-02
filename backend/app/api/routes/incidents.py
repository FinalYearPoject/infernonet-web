from fastapi import APIRouter, Depends, HTTPException, status

from app.api.routes.auth import get_current_user
from app.schemas.incident import IncidentCreate, IncidentResponse, IncidentUpdate
from app.services import channel_service as channel_svc
from app.services import incident_service as svc

router = APIRouter()


@router.get("/incidents", summary="List incidents")
def list_incidents_route(
    status_filter: str | None = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    return {
        "incidents": svc.list_incidents(
            status_filter=status_filter,
            limit=limit,
            role=current_user["role"],
            user_id=str(current_user["id"]),
        )
    }


@router.get("/incidents/{incident_id}", response_model=IncidentResponse, summary="Get incident by ID")
def get_incident_route(
    incident_id: str,
    current_user: dict = Depends(get_current_user),
):
    incident = svc.get_incident_by_id(
        incident_id,
        role=current_user["role"],
        user_id=str(current_user["id"]),
    )
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident


@router.post(
    "/incidents",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create incident",
)
def create_incident_route(body: IncidentCreate, current_user: dict = Depends(get_current_user)):
    created = svc.create_incident(
        title=body.title,
        description=body.description,
        severity=body.severity,
        latitude=body.latitude,
        longitude=body.longitude,
        address=body.address,
        created_by=str(current_user["id"]),
        created_by_role=current_user["role"],
    )
    # Auto-create public channel for the incident (all civilians can write)
    channel_svc.create_channel(
        name=f"Incident: {body.title[:200]}",
        incident_id=str(created["id"]),
        team_id=None,
        is_public=True,
        created_by=str(current_user["id"]),
    )
    return created


@router.patch("/incidents/{incident_id}", response_model=IncidentResponse, summary="Update incident (status, severity, etc.)")
def update_incident_route(
    incident_id: str,
    body: IncidentUpdate,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("coordinator", "firefighter"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only coordinators and firefighters can update incidents")
    incident = svc.get_incident_by_id(incident_id)
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    data = body.model_dump(exclude_unset=True)
    if not data:
        return incident
    updated = svc.update_incident(incident_id, **data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return updated


@router.delete("/incidents/{incident_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete incident")
def delete_incident_route(
    incident_id: str,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "coordinator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only coordinators can delete incidents")
    if not svc.delete_incident(incident_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
