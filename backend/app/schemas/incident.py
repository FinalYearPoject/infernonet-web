from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field


class IncidentCreate(BaseModel):
    title: str = Field(..., max_length=500)
    description: str | None = None
    severity: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: str | None = None
    created_by: UUID | None = None


class IncidentUpdate(BaseModel):
    title: str | None = Field(None, max_length=500)
    description: str | None = None
    status: str | None = Field(None, pattern="^(reported|active|contained|resolved)$")
    severity: str | None = Field(None, pattern="^(low|medium|high|critical)$")
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    address: str | None = None
    resolved_at: str | None = None


class IncidentResponse(BaseModel):
    id: UUID
    title: str
    description: str | None
    status: str
    severity: str
    latitude: float
    longitude: float
    address: str | None
    reported_at: datetime
    created_by: UUID | None
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime


class IncidentUpdateCreate(BaseModel):
    content: str = Field(..., min_length=1)
    user_id: UUID | None = None
    status_before: str | None = None
    status_after: str | None = None


class IncidentUpdateResponse(BaseModel):
    id: UUID
    incident_id: UUID
    user_id: UUID | None
    content: str
    status_before: str | None
    status_after: str | None
    created_at: datetime
