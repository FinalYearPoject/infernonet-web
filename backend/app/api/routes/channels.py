from fastapi import APIRouter, Depends, HTTPException, status

from app.api.routes.auth import get_current_user
from app.schemas.channel import (
    ChannelCreate,
    ChannelMemberAdd,
    ChannelMemberResponse,
    ChannelResponse,
    ChannelUpdate,
    MessageCreate,
    MessageResponse,
    MessageUpdate,
)
from app.services import channel_service as svc

router = APIRouter()


def _civilian_cannot_access_private(ch: dict | None, current_user: dict) -> None:
    """Raise 404 if channel is missing or civilian is accessing a private channel."""
    if not ch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    if current_user["role"] == "civilian" and not ch.get("is_public"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")


@router.get("/channels", summary="List channels (by incident or team)")
def list_channels(
    incident_id: str | None = None,
    team_id: str | None = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
):
    return {
        "channels": svc.list_channels(
            incident_id=incident_id,
            team_id=team_id,
            limit=limit,
            role=current_user["role"],
        )
    }


@router.get("/channels/{channel_id}", response_model=ChannelResponse, summary="Get channel by ID")
def get_channel(channel_id: str, current_user: dict = Depends(get_current_user)):
    ch = svc.get_channel_by_id(channel_id)
    _civilian_cannot_access_private(ch, current_user)
    return ch


@router.post(
    "/channels",
    response_model=ChannelResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create channel (incident, team, or general)",
)
def create_channel(body: ChannelCreate, current_user: dict = Depends(get_current_user)):
    return svc.create_channel(
        name=body.name,
        incident_id=str(body.incident_id) if body.incident_id else None,
        team_id=str(body.team_id) if body.team_id else None,
        is_public=body.is_public,
        created_by=str(current_user["id"]),
    )


@router.patch("/channels/{channel_id}", response_model=ChannelResponse, summary="Update channel (name, visibility)")
def update_channel(channel_id: str, body: ChannelUpdate, current_user: dict = Depends(get_current_user)):
    ch = svc.get_channel_by_id(channel_id)
    _civilian_cannot_access_private(ch, current_user)
    updated = svc.update_channel(channel_id, body.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    return updated


@router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete channel")
def delete_channel(channel_id: str, current_user: dict = Depends(get_current_user)):
    ch = svc.get_channel_by_id(channel_id)
    _civilian_cannot_access_private(ch, current_user)
    if not svc.delete_channel(channel_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")


@router.get("/channels/{channel_id}/members", summary="List channel members")
def list_channel_members(channel_id: str, current_user: dict = Depends(get_current_user)):
    ch = svc.get_channel_by_id(channel_id)
    _civilian_cannot_access_private(ch, current_user)
    return {"members": svc.list_channel_members(channel_id)}


@router.post(
    "/channels/{channel_id}/members",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Add channel member",
)
def add_channel_member(channel_id: str, body: ChannelMemberAdd, current_user: dict = Depends(get_current_user)):
    ch = svc.get_channel_by_id(channel_id)
    _civilian_cannot_access_private(ch, current_user)
    svc.add_channel_member(channel_id, str(body.user_id))


@router.delete(
    "/channels/{channel_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove channel member",
)
def remove_channel_member(channel_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    ch = svc.get_channel_by_id(channel_id)
    _civilian_cannot_access_private(ch, current_user)
    if not svc.remove_channel_member(channel_id, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in channel")


@router.get("/channels/{channel_id}/messages", summary="List channel messages")
def list_messages(
    channel_id: str,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    ch = svc.get_channel_by_id(channel_id)
    _civilian_cannot_access_private(ch, current_user)
    return {"messages": svc.list_messages(channel_id, limit=limit, offset=offset)}


@router.post(
    "/channels/{channel_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send message",
)
def create_message(channel_id: str, body: MessageCreate, current_user: dict = Depends(get_current_user)):
    ch = svc.get_channel_by_id(channel_id)
    _civilian_cannot_access_private(ch, current_user)
    return svc.create_message(
        channel_id=channel_id,
        content=body.content,
        user_id=str(current_user["id"]),
    )


@router.patch(
    "/channels/{channel_id}/messages/{message_id}",
    response_model=MessageResponse,
    summary="Edit message (sets edited_at)",
)
def update_message(
    channel_id: str,
    message_id: str,
    body: MessageUpdate,
    current_user: dict = Depends(get_current_user),
):
    ch = svc.get_channel_by_id(channel_id)
    _civilian_cannot_access_private(ch, current_user)
    updated = svc.update_message(message_id, body.content)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    return updated


@router.delete(
    "/channels/{channel_id}/messages/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete message",
)
def delete_message(
    channel_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user),
):
    ch = svc.get_channel_by_id(channel_id)
    _civilian_cannot_access_private(ch, current_user)
    if not svc.delete_message(message_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
