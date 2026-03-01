from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)
    full_name: str = Field(..., max_length=255)
    role: str = Field(..., pattern="^(firefighter|coordinator|civilian)$")
    phone: str | None = None
    organization_id: UUID | None = None
    avatar_url: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = Field(None, max_length=255)
    role: str | None = Field(None, pattern="^(firefighter|coordinator|civilian)$")
    phone: str | None = None
    organization_id: UUID | None = None
    avatar_url: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    phone: str | None
    organization_id: UUID | None
    avatar_url: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
