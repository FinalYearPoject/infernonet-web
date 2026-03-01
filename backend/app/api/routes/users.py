from fastapi import APIRouter, HTTPException, status

from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services import user_service as svc

router = APIRouter()


@router.get("/users", summary="List users (role-based)")
def list_users(role: str | None = None, organization_id: str | None = None, limit: int = 100):
    return {"users": svc.list_users(role=role, organization_id=organization_id, limit=limit)}


@router.get("/users/{user_id}", response_model=UserResponse, summary="Get user by ID")
def get_user(user_id: str):
    user = svc.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register user (firefighter, coordinator, civilian)",
)
def create_user(body: UserCreate):
    existing = svc.get_user_by_email(body.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    return svc.create_user(
        email=body.email,
        password=body.password,
        full_name=body.full_name,
        role=body.role,
        phone=body.phone,
        organization_id=str(body.organization_id) if body.organization_id else None,
        avatar_url=body.avatar_url,
    )


@router.patch("/users/{user_id}", response_model=UserResponse, summary="Update user profile")
def update_user(user_id: str, body: UserUpdate):
    if not svc.get_user_by_id(user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    data = body.model_dump(exclude_unset=True)
    updated = svc.update_user(user_id, data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return updated


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete user")
def delete_user(user_id: str):
    if not svc.delete_user(user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
