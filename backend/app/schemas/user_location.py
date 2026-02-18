from uuid import UUID
from pydantic import BaseModel, Field


class UserLocationUpdate(BaseModel):
    user_id: UUID
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class UserLocationResponse(BaseModel):
    id: UUID
    user_id: UUID
    latitude: float
    longitude: float
    updated_at: str
