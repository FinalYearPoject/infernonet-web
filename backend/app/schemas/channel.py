from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class ChannelCreate(BaseModel):
    name: str = Field(..., max_length=255)
    incident_id: UUID | None = None
    team_id: UUID | None = None
    is_public: bool = False
    created_by: UUID | None = None

    @model_validator(mode="after")
    def channel_scope(self):
        if self.incident_id is not None and self.team_id is not None:
            raise ValueError("Channel must be for incident OR team OR general, not both incident_id and team_id")
        return self


class ChannelUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    is_public: bool | None = None


class ChannelResponse(BaseModel):
    id: UUID
    name: str
    incident_id: UUID | None
    team_id: UUID | None
    is_public: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime


class ChannelMemberAdd(BaseModel):
    user_id: UUID


class ChannelMemberResponse(BaseModel):
    channel_id: UUID
    user_id: UUID
    joined_at: datetime


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1)
    user_id: UUID | None = None


class MessageUpdate(BaseModel):
    content: str = Field(..., min_length=1)


class MessageResponse(BaseModel):
    id: UUID
    channel_id: UUID
    user_id: UUID | None
    content: str
    created_at: datetime
    edited_at: datetime | None
