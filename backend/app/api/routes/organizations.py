from fastapi import APIRouter, HTTPException, status

from app.schemas.organization import OrganizationCreate
from app.services import organization_service as svc

router = APIRouter()


@router.get("/organizations", summary="List organizations")
def list_organizations(limit: int = 100):
    return {"organizations": svc.list_organizations(limit=limit)}


@router.get("/organizations/{org_id}", summary="Get organization by ID")
def get_organization(org_id: str):
    org = svc.get_organization_by_id(org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


@router.post("/organizations", status_code=status.HTTP_201_CREATED, summary="Create organization")
def create_organization(body: OrganizationCreate):
    return svc.create_organization(
        name=body.name,
        type=body.type,
        contact_phone=body.contact_phone,
        address=body.address,
    )
