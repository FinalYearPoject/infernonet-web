from uuid import UUID
from pydantic import BaseModel, Field


class TeamCreate(BaseModel):
    name: str = Field(..., max_length=255)
    organization_id: UUID
    incident_id: UUID | None = None


class TeamUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    incident_id: UUID | None = None


class TeamMemberAdd(BaseModel):
    user_id: UUID
    role_in_team: str = Field(default="member", max_length=50)


class TeamResponse(BaseModel):
    id: UUID
    name: str
    organization_id: UUID
    incident_id: UUID | None
    created_at: str
    updated_at: str
