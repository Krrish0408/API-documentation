import httpx
import json
import time
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from services.auth_guard import require_developer_or_admin

router = APIRouter()


class TestAPIRequest(BaseModel):
    url: str
    method: str = "GET"
    headers: Optional[Dict[str, str]] = {}
    body: Optional[str] = None
    timeout: Optional[int] = 10


class TestAPIResponse(BaseModel):
    status_code: int
    response_time_ms: float
    headers: Dict[str, str]
    body: Any
    success: bool


@router.post("/test", response_model=TestAPIResponse)
async def test_api_endpoint(
    request: TestAPIRequest,
    user: Dict[str, Any] = Depends(require_developer_or_admin)
):
    """
    API Tester — executes HTTP request with method, headers, and body.
    Requires DEVELOPER or ADMIN role.
    """
    method = request.method.upper()
    if method not in ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]:
        raise HTTPException(status_code=400, detail=f"Method '{method}' is not supported.")

    if not request.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    parsed_body = None
    if request.body and request.body.strip():
        try:
            parsed_body = json.loads(request.body)
        except json.JSONDecodeError:
            parsed_body = request.body

    try:
        start_time = time.monotonic()

        async with httpx.AsyncClient(
            timeout=request.timeout,
            follow_redirects=True
        ) as client:
            response = await client.request(
                method=method,
                url=request.url,
                headers=request.headers or {},
                json=parsed_body if isinstance(parsed_body, dict) else None,
                content=parsed_body if isinstance(parsed_body, str) else None,
            )

        elapsed_ms = round((time.monotonic() - start_time) * 1000, 2)

        # Try to parse response body as JSON
        try:
            body = response.json()
        except Exception:
            body = response.text[:2000]

        return TestAPIResponse(
            status_code=response.status_code,
            response_time_ms=elapsed_ms,
            headers=dict(response.headers),
            body=body,
            success=response.status_code < 400
        )

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=408,
            detail=f"Request timeout exceeded ({request.timeout}s). The target server took too long to respond."
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to connect to {request.url}. Verify host availability and network connectivity."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Request execution failed: {str(e)}")