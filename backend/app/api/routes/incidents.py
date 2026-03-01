from fastapi import APIRouter, HTTPException, status

from app.schemas.incident import IncidentCreate, IncidentResponse, IncidentUpdate
from app.services import incident_service as svc

router = APIRouter()


@router.get("/incidents", summary="List incidents")
def list_incidents_route(status_filter: str | None = None, limit: int = 50):
    return {"incidents": svc.list_incidents(status_filter=status_filter, limit=limit)}


@router.get("/incidents/{incident_id}", response_model=IncidentResponse, summary="Get incident by ID")
def get_incident_route(incident_id: str):
    incident = svc.get_incident_by_id(incident_id)
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident


@router.post(
    "/incidents",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create incident",
)
def create_incident_route(body: IncidentCreate):
    return svc.create_incident(
        title=body.title,
        description=body.description,
        severity=body.severity,
        latitude=body.latitude,
        longitude=body.longitude,
        address=body.address,
        created_by=str(body.created_by) if body.created_by else None,
    )


@router.patch("/incidents/{incident_id}", response_model=IncidentResponse, summary="Update incident (status, severity, etc.)")
def update_incident_route(incident_id: str, body: IncidentUpdate):
    data = body.model_dump(exclude_unset=True)
    if not data:
        incident = svc.get_incident_by_id(incident_id)
        if not incident:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
        return incident
    updated = svc.update_incident(incident_id, **data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return updated


@router.delete("/incidents/{incident_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete incident")
def delete_incident_route(incident_id: str):
    if not svc.delete_incident(incident_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
