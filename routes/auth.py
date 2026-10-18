"""
routes/auth.py — Authentication & RBAC API endpoints.
Provides login, registration, current user session info, and demo account presets.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, HTTPException, Depends, status
from services.auth_guard import (
    authenticate_user,
    register_user,
    create_access_token,
    get_current_user,
    require_authenticated_user,
    ROLE_ADMIN,
    ROLE_DEVELOPER,
    ROLE_VIEWER,
    VALID_ROLES
)

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = ROLE_DEVELOPER


class UserResponse(BaseModel):
    email: str
    name: str
    role: str


class AuthResponse(BaseModel):
    status: str = "success"
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """
    Authenticates a user with email & password.
    Returns a signed JWT access token and user profile.
    """
    if not request.email or not request.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required."
        )

    user = authenticate_user(request.email, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please check your credentials."
        )

    token = create_access_token(user)
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    """
    Creates a new user account with specified name, email, password, and role.
    """
    if not request.name.strip():
        raise HTTPException(status_code=400, detail="Name is required.")
    if not request.email.strip() or "@" not in request.email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    if len(request.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters long.")

    role = (request.role or ROLE_DEVELOPER).strip().upper()
    if role not in VALID_ROLES:
        role = ROLE_DEVELOPER

    user = register_user(request.name, request.email, request.password, role)
    token = create_access_token(user)

    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }


@router.get("/me")
async def get_my_profile(user: Dict[str, Any] = Depends(require_authenticated_user)):
    """
    Returns current authenticated user details, assigned role, and permissions matrix.
    """
    role = user.get("role", ROLE_DEVELOPER).upper()
    permissions = {
        "can_chat": True,
        "can_export_pdf": True,
        "can_generate_sdk": role in [ROLE_ADMIN, ROLE_DEVELOPER],
        "can_generate_readme": role in [ROLE_ADMIN, ROLE_DEVELOPER],
        "can_test_api": role in [ROLE_ADMIN, ROLE_DEVELOPER],
        "can_compare_apis": role in [ROLE_ADMIN, ROLE_DEVELOPER],
        "can_upload": role == ROLE_ADMIN,
        "can_delete_api": role == ROLE_ADMIN,
    }
    return {
        "status": "authenticated",
        "user": {
            "email": user["email"],
            "name": user["name"],
            "role": role,
        },
        "permissions": permissions
    }


@router.get("/demo-users")
async def list_demo_users():
    """
    Provides pre-configured demo credentials for 1-click login on the frontend.
    """
    return {
        "demo_accounts": [
            {
                "role": "ADMIN",
                "label": "Administrator",
                "email": "admin@docmind.ai",
                "password": "admin123",
                "badge": "👑 Admin",
                "description": "Full Access: Upload docs, manage collections, SDK generator, Live tester"
            },
            {
                "role": "DEVELOPER",
                "label": "Developer",
                "email": "dev@docmind.ai",
                "password": "dev123",
                "badge": "💻 Developer",
                "description": "Development Access: Chat, SDK Studio, API playground, API comparisons"
            },
            {
                "role": "VIEWER",
                "label": "Viewer",
                "email": "viewer@docmind.ai",
                "password": "viewer123",
                "badge": "👁️ Viewer",
                "description": "Read-only: QnA streaming, API documentation exploration, PDF exports"
            }
        ]
    }


@router.post("/logout")
async def logout():
    """Client side logout confirmation."""
    return {"status": "success", "message": "Successfully logged out."}
