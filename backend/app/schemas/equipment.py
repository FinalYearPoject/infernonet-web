from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field


class EquipmentCreate(BaseModel):
    name: str = Field(..., max_length=255)
    type: str = Field(..., max_length=100)
    status: str = Field(default="available", pattern="^(available|in_use|maintenance|unavailable)$")
    organization_id: UUID
    incident_id: UUID | None = None
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    metadata: dict | None = None


class EquipmentUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    type: str | None = Field(None, max_length=100)
    status: str | None = Field(None, pattern="^(available|in_use|maintenance|unavailable)$")
    incident_id: UUID | None = None
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    metadata: dict | None = None


class EquipmentResponse(BaseModel):
    id: UUID
    name: str
    type: str
    status: str
    organization_id: UUID
    incident_id: UUID | None
    latitude: float | None
    longitude: float | None
    metadata: dict
    created_at: datetime
    updated_at: datetime
