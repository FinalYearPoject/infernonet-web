from uuid import UUID
from pydantic import BaseModel, Field


class OrganizationCreate(BaseModel):
    name: str = Field(..., max_length=255)
    type: str = Field(..., max_length=50)
    contact_phone: str | None = None
    address: str | None = None


class OrganizationUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    type: str | None = Field(None, max_length=50)
    contact_phone: str | None = None
    address: str | None = None


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    type: str
    contact_phone: str | None
    address: str | None
    created_at: str
    updated_at: str
