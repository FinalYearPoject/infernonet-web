from fastapi import APIRouter, HTTPException, status

from app.schemas.alert import AlertCreate, AlertResponse
from app.services import alert_service as svc

router = APIRouter()


@router.get("/alerts", summary="List alerts (optionally by incident)")
def list_alerts(incident_id: str | None = None, limit: int = 100):
    return {"alerts": svc.list_alerts(incident_id=incident_id, limit=limit)}


@router.get("/alerts/{alert_id}", response_model=AlertResponse, summary="Get alert by ID")
def get_alert(alert_id: str):
    alert = svc.get_alert_by_id(alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return alert


@router.post(
    "/alerts",
    response_model=AlertResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create emergency alert",
)
def create_alert(body: AlertCreate):
    return svc.create_alert(
        title=body.title,
        message=body.message,
        incident_id=str(body.incident_id) if body.incident_id else None,
        severity=body.severity,
        created_by=str(body.created_by) if body.created_by else None,
        expires_at=body.expires_at,
    )


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete alert")
def delete_alert(alert_id: str):
    if not svc.delete_alert(alert_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
