from fastapi import APIRouter, HTTPException, status

from app.schemas.user_location import UserLocationResponse, UserLocationUpdate
from app.services import user_location_service as svc

router = APIRouter()


@router.get("/user-locations", summary="List user locations (for live map)")
def list_user_locations(user_id: str | None = None, limit: int = 500):
    return {"locations": svc.list_user_locations(user_id=user_id, limit=limit)}


@router.get(
    "/users/{user_id}/location",
    response_model=UserLocationResponse,
    summary="Get user's current location",
)
def get_user_location(user_id: str):
    loc = svc.get_user_location(user_id)
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    return loc


@router.put(
    "/user-locations",
    response_model=UserLocationResponse,
    summary="Update current user location (upsert)",
)
def upsert_user_location(body: UserLocationUpdate):
    return svc.upsert_user_location(
        user_id=str(body.user_id),
        latitude=body.latitude,
        longitude=body.longitude,
    )
