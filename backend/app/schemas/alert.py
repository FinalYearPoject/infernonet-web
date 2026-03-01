from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field


class AlertCreate(BaseModel):
    incident_id: UUID | None = None
    title: str = Field(..., max_length=500)
    message: str = Field(..., min_length=1)
    severity: str = Field(default="info", pattern="^(info|warning|critical)$")
    created_by: UUID | None = None
    expires_at: str | None = None


class AlertResponse(BaseModel):
    id: UUID
    incident_id: UUID | None
    title: str
    message: str
    severity: str
    created_by: UUID | None
    created_at: datetime
    expires_at: datetime | None
