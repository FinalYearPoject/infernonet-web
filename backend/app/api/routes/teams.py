from fastapi import APIRouter, HTTPException, status

from app.schemas.team import TeamCreate, TeamMemberAdd, TeamMemberResponse, TeamResponse, TeamUpdate
from app.services import team_service as svc

router = APIRouter()


@router.get("/teams", summary="List teams")
def list_teams(
    organization_id: str | None = None,
    incident_id: str | None = None,
    member_id: str | None = None,
    limit: int = 100,
):
    return {
        "teams": svc.list_teams(
            organization_id=organization_id,
            incident_id=incident_id,
            member_id=member_id,
            limit=limit,
        )
    }


@router.get("/teams/{team_id}", response_model=TeamResponse, summary="Get team by ID")
def get_team(team_id: str):
    team = svc.get_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return team


@router.get("/teams/{team_id}/members", summary="List team members")
def list_team_members(team_id: str):
    team = svc.get_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return {"members": svc.list_team_members(team_id)}


@router.post(
    "/teams",
    response_model=TeamResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create team",
)
def create_team(body: TeamCreate):
    return svc.create_team(
        name=body.name,
        organization_id=str(body.organization_id),
        incident_id=str(body.incident_id) if body.incident_id else None,
    )


@router.patch("/teams/{team_id}", response_model=TeamResponse, summary="Update team (e.g. assign to incident)")
def update_team(team_id: str, body: TeamUpdate):
    data = body.model_dump(exclude_unset=True)
    if data.get("incident_id") is not None:
        data["incident_id"] = str(data["incident_id"])
    if not data:
        team = svc.get_team_by_id(team_id)
        if not team:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
        return team
    updated = svc.update_team(team_id, **data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return updated


@router.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete team")
def delete_team(team_id: str):
    if not svc.delete_team(team_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")


@router.post(
    "/teams/{team_id}/members",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add team member",
)
def add_team_member(team_id: str, body: TeamMemberAdd):
    team = svc.get_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return svc.add_team_member(team_id, str(body.user_id), role_in_team=body.role_in_team)


@router.delete(
    "/teams/{team_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove team member",
)
def remove_team_member(team_id: str, user_id: str):
    team = svc.get_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if not svc.remove_team_member(team_id, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
