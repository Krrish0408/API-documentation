"""
services/auth_guard.py — Complete Role-Based Access Control (RBAC) & JWT Security Guard.
Provides token creation, password hashing, user registration, authentication, and FastAPI route protection.
"""

import os
import json
import time
import hmac
import hashlib
import base64
from typing import Optional, Dict, Any, List
from fastapi import Request, HTTPException, Depends, status
from fastapi.security import HTTPBearer

# Security scheme for OpenAPI Swagger documentation
security_scheme = HTTPBearer(auto_error=False)

# Predefined RBAC Roles
ROLE_ADMIN = "ADMIN"
ROLE_DEVELOPER = "DEVELOPER"
ROLE_VIEWER = "VIEWER"
VALID_ROLES = [ROLE_ADMIN, ROLE_DEVELOPER, ROLE_VIEWER]

# Secret key for JWT signature
AUTH_SECRET = os.getenv("AUTH_SECRET", os.getenv("NEXTAUTH_SECRET", "docmind-super-secret-jwt-key-2026"))
TOKEN_EXPIRY_SECONDS = 7 * 24 * 3600  # 7 days

USERS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "users.json")

# Default Demo Users
DEFAULT_USERS: Dict[str, Dict[str, Any]] = {
    "admin@docmind.ai": {
        "email": "admin@docmind.ai",
        "name": "Alex Vance (Admin)",
        "password_hash": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b:955db0b81ef1989b30e4e60f553ecf1d04378cd9c8ecfb6e147e63fa5ac470f9",  # admin123
        "role": ROLE_ADMIN,
        "created_at": "2026-01-01T00:00:00Z"
    },
    "dev@docmind.ai": {
        "email": "dev@docmind.ai",
        "name": "Sarah Chen (Dev)",
        "password_hash": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b:310c14b74548cf5f63d6f1bfd8e9c4c478c93a02a901844b205f2c4fe8e0e7a8",  # dev123
        "role": ROLE_DEVELOPER,
        "created_at": "2026-01-01T00:00:00Z"
    },
    "viewer@docmind.ai": {
        "email": "viewer@docmind.ai",
        "name": "Morgan Blake (Viewer)",
        "password_hash": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b:3a1b32bdf67ea3ddb6a9e144a10e82c5f1146316279f64aa274d8961726a8ea5",  # viewer123
        "role": ROLE_VIEWER,
        "created_at": "2026-01-01T00:00:00Z"
    }
}


def _hash_password(password: str, salt: Optional[str] = None) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with salt."""
    if not salt:
        salt = os.urandom(16).hex()
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return f"{salt}:{key}"


def _verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verify password against stored salt:hash string."""
    try:
        if ":" not in stored_hash:
            return plain_password == stored_hash
        salt, key = stored_hash.split(":", 1)
        test_key = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        ).hex()
        return hmac.compare_digest(key, test_key)
    except Exception:
        return False


def _ensure_users_storage():
    """Ensure data/ directory and users.json exist with seeded demo accounts."""
    os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
    if not os.path.exists(USERS_FILE):
        # Generate initial hashes for demo accounts
        users_to_save = {}
        passwords = {
            "admin@docmind.ai": "admin123",
            "dev@docmind.ai": "dev123",
            "viewer@docmind.ai": "viewer123"
        }
        for email, u in DEFAULT_USERS.items():
            user_copy = dict(u)
            user_copy["password_hash"] = _hash_password(passwords[email])
            users_to_save[email] = user_copy

        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(users_to_save, f, indent=2)


def get_all_users() -> Dict[str, Dict[str, Any]]:
    """Retrieve all users from persistence."""
    _ensure_users_storage()
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return DEFAULT_USERS


def save_user(user_data: Dict[str, Any]):
    """Save or update user in persistent storage."""
    _ensure_users_storage()
    users = get_all_users()
    users[user_data["email"].lower()] = user_data
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2)


# ─── JWT Utilities ────────────────────────────────────────────────────────────

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')


def _b64url_decode(s: str) -> bytes:
    padded = s + '=' * ((4 - len(s) % 4) % 4)
    return base64.urlsafe_b64decode(padded.encode('utf-8'))


def create_access_token(user: Dict[str, Any], expires_delta: int = TOKEN_EXPIRY_SECONDS) -> str:
    """Creates a signed JWT with HS256 HMAC signature."""
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user.get("email"),
        "email": user.get("email"),
        "name": user.get("name", "User"),
        "role": user.get("role", ROLE_DEVELOPER).upper(),
        "iat": now,
        "exp": now + expires_delta
    }

    header_b64 = _b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(AUTH_SECRET.encode('utf-8'), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def verify_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Verifies and decodes a JWT token. Returns payload dict or None if invalid/expired."""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None

        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_sig = hmac.new(AUTH_SECRET.encode('utf-8'), signing_input, hashlib.sha256).digest()
        provided_sig = _b64url_decode(sig_b64)

        if not hmac.compare_digest(expected_sig, provided_sig):
            return None

        payload_bytes = _b64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode('utf-8'))

        # Check expiration
        exp = payload.get("exp")
        if exp and int(time.time()) > int(exp):
            return None

        return payload
    except Exception:
        return None


# ─── Auth Handlers ────────────────────────────────────────────────────────────

def authenticate_user(email: str, plain_password: str) -> Optional[Dict[str, Any]]:
    """Authenticates a user via email and password."""
    users = get_all_users()
    user = users.get(email.strip().lower())
    if not user:
        return None

    if _verify_password(plain_password, user.get("password_hash", "")):
        return {
            "email": user["email"],
            "name": user.get("name", "User"),
            "role": user.get("role", ROLE_DEVELOPER).upper(),
        }
    return None


def register_user(name: str, email: str, plain_password: str, role: str = ROLE_DEVELOPER) -> Dict[str, Any]:
    """Registers a new user account."""
    clean_email = email.strip().lower()
    users = get_all_users()
    if clean_email in users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    clean_role = role.strip().upper()
    if clean_role not in VALID_ROLES:
        clean_role = ROLE_DEVELOPER

    new_user = {
        "email": clean_email,
        "name": name.strip() or clean_email.split('@')[0],
        "password_hash": _hash_password(plain_password),
        "role": clean_role,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    save_user(new_user)
    return {
        "email": new_user["email"],
        "name": new_user["name"],
        "role": new_user["role"]
    }


def decode_auth_header(request: Request) -> Dict[str, Any]:
    """
    Extracts and validates user authentication context from incoming request.
    Supports:
    1. Bearer JWT tokens in Authorization header
    2. Next.js Auth proxy headers: `X-User-Email`, `X-User-Role`, `X-User-Name`
    """
    # 1. Check Authorization Bearer header
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        payload = verify_access_token(token)
        if payload:
            return {
                "authenticated": True,
                "email": payload.get("email", payload.get("sub")),
                "role": payload.get("role", ROLE_DEVELOPER).upper(),
                "name": payload.get("name", "User"),
                "source": "jwt"
            }

    # 2. Check for Next.js internal auth proxy headers (if deployed with Next.js edge proxy)
    x_user_email = request.headers.get("X-User-Email")
    if x_user_email:
        x_user_role = request.headers.get("X-User-Role", ROLE_DEVELOPER).upper()
        x_user_name = request.headers.get("X-User-Name", "Authenticated User")
        return {
            "authenticated": True,
            "email": x_user_email,
            "role": x_user_role,
            "name": x_user_name,
            "source": "proxy_header"
        }

    return {
        "authenticated": False,
        "email": None,
        "role": None,
        "name": None,
        "source": "anonymous"
    }


# ─── FastAPI Dependencies ─────────────────────────────────────────────────────

async def get_current_user(request: Request) -> Dict[str, Any]:
    """FastAPI dependency to extract and verify the current user session."""
    user = decode_auth_header(request)
    if not user.get("authenticated"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to access this resource.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return user


async def require_authenticated_user(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Ensures the request comes from an authenticated user (Admin, Developer, or Viewer)."""
    return user


async def require_admin_role(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Ensures the requesting user has the ADMIN role."""
    role = user.get("role", "").upper()
    if role != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Admin role required. Current role: '{role}'."
        )
    return user


async def require_developer_or_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Ensures the requesting user has either DEVELOPER or ADMIN role."""
    role = user.get("role", "").upper()
    if role not in (ROLE_ADMIN, ROLE_DEVELOPER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Developer or Admin role required. Current role: '{role}'."
        )
    return user
