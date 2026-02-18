from uuid import UUID
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


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1)
    user_id: UUID | None = None


class ChannelMemberAdd(BaseModel):
    user_id: UUID


class MessageResponse(BaseModel):
    id: UUID
    channel_id: UUID
    user_id: UUID | None
    content: str
    created_at: str
    edited_at: str | None
