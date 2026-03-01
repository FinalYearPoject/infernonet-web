from fastapi import APIRouter, HTTPException, status

from app.schemas.equipment import EquipmentCreate, EquipmentResponse, EquipmentUpdate
from app.services import equipment_service as svc

router = APIRouter()


@router.get("/equipment", summary="List equipment (filter by status, organization, incident)")
def list_equipment(
    organization_id: str | None = None,
    equipment_status: str | None = None,
    incident_id: str | None = None,
    limit: int = 100,
):
    return {
        "equipment": svc.list_equipment(
            organization_id=organization_id,
            status=equipment_status,
            incident_id=incident_id,
            limit=limit,
        )
    }


@router.get("/equipment/{equipment_id}", response_model=EquipmentResponse, summary="Get equipment by ID")
def get_equipment(equipment_id: str):
    eq = svc.get_equipment_by_id(equipment_id)
    if not eq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")
    return eq


@router.post(
    "/equipment",
    response_model=EquipmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create equipment",
)
def create_equipment(body: EquipmentCreate):
    return svc.create_equipment(
        name=body.name,
        type=body.type,
        organization_id=str(body.organization_id),
        status=body.status,
        incident_id=str(body.incident_id) if body.incident_id else None,
        latitude=body.latitude,
        longitude=body.longitude,
        metadata=body.metadata,
    )


@router.patch(
    "/equipment/{equipment_id}",
    response_model=EquipmentResponse,
    summary="Update equipment (status, location, incident)",
)
def update_equipment(equipment_id: str, body: EquipmentUpdate):
    data = body.model_dump(exclude_unset=True)
    if data.get("incident_id") is not None:
        data["incident_id"] = str(data["incident_id"])
    if not data:
        eq = svc.get_equipment_by_id(equipment_id)
        if not eq:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")
        return eq
    updated = svc.update_equipment(equipment_id, **data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")
    return updated


@router.delete("/equipment/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete equipment")
def delete_equipment(equipment_id: str):
    if not svc.delete_equipment(equipment_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")
