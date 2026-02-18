from fastapi import APIRouter, HTTPException, status

from app.schemas.channel import ChannelCreate, ChannelMemberAdd, MessageCreate
from app.services import channel_service as svc

router = APIRouter()


@router.get("/channels", summary="List channels (by incident or team)")
def list_channels(incident_id: str | None = None, team_id: str | None = None, limit: int = 100):
    return {"channels": svc.list_channels(incident_id=incident_id, team_id=team_id, limit=limit)}


@router.get("/channels/{channel_id}", summary="Get channel by ID")
def get_channel(channel_id: str):
    ch = svc.get_channel_by_id(channel_id)
    if not ch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    return ch


@router.post("/channels", status_code=status.HTTP_201_CREATED, summary="Create channel (incident, team, or general)")
def create_channel(body: ChannelCreate):
    return svc.create_channel(
        name=body.name,
        incident_id=str(body.incident_id) if body.incident_id else None,
        team_id=str(body.team_id) if body.team_id else None,
        is_public=body.is_public,
        created_by=str(body.created_by) if body.created_by else None,
    )


@router.post("/channels/{channel_id}/members", status_code=status.HTTP_204_NO_CONTENT, summary="Add channel member")
def add_channel_member(channel_id: str, body: ChannelMemberAdd):
    ch = svc.get_channel_by_id(channel_id)
    if not ch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    svc.add_channel_member(channel_id, str(body.user_id))


@router.get("/channels/{channel_id}/messages", summary="List channel messages")
def list_messages(channel_id: str, limit: int = 100, offset: int = 0):
    ch = svc.get_channel_by_id(channel_id)
    if not ch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    return {"messages": svc.list_messages(channel_id, limit=limit, offset=offset)}


@router.post("/channels/{channel_id}/messages", status_code=status.HTTP_201_CREATED, summary="Send message")
def create_message(channel_id: str, body: MessageCreate):
    ch = svc.get_channel_by_id(channel_id)
    if not ch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    return svc.create_message(
        channel_id=channel_id,
        content=body.content,
        user_id=str(body.user_id) if body.user_id else None,
    )
