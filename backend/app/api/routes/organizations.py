from fastapi import APIRouter, HTTPException, status

from app.schemas.organization import OrganizationCreate, OrganizationResponse, OrganizationUpdate
from app.services import organization_service as svc

router = APIRouter()


@router.get("/organizations", summary="List organizations")
def list_organizations(limit: int = 100):
    return {"organizations": svc.list_organizations(limit=limit)}


@router.get("/organizations/{org_id}", response_model=OrganizationResponse, summary="Get organization by ID")
def get_organization(org_id: str):
    org = svc.get_organization_by_id(org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


@router.post(
    "/organizations",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create organization",
)
def create_organization(body: OrganizationCreate):
    return svc.create_organization(
        name=body.name,
        type=body.type,
        contact_phone=body.contact_phone,
        address=body.address,
    )


@router.patch("/organizations/{org_id}", response_model=OrganizationResponse, summary="Update organization")
def update_organization(org_id: str, body: OrganizationUpdate):
    if not svc.get_organization_by_id(org_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    updated = svc.update_organization(org_id, body.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return updated


@router.delete("/organizations/{org_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete organization")
def delete_organization(org_id: str):
    if not svc.delete_organization(org_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
