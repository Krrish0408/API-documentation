import io
import json
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
from config import DEFAULT_MODEL
from services.qna_engine import get_groq_client
from services.vector_store import find_relevant_chunks
from services.auth_guard import require_developer_or_admin, require_authenticated_user

router = APIRouter()


class GenerateRequest(BaseModel):
    api_name: str
    language: Optional[str] = "all"


class ReadmeRequest(BaseModel):
    api_name: str


class SdkDownloadRequest(BaseModel):
    api_name: str
    language: str
    code: str


class ReadmeDownloadRequest(BaseModel):
    api_name: str
    readme: str


@router.post("/generate-sdk")
async def generate_sdk(
    request: GenerateRequest,
    user: Dict[str, Any] = Depends(require_developer_or_admin)
):
    """
    Automatically generates a complete SDK/code library
    for the uploaded API documentation.
    Requires DEVELOPER or ADMIN role.
    """
    if not request.api_name.strip():
        raise HTTPException(status_code=400, detail="API name required")

    client = get_groq_client()
    if not client:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured in .env")

    # Get all relevant chunks from vector DB
    chunks = find_relevant_chunks(
        "endpoints authentication parameters request response headers",
        request.api_name.strip(),
        how_many=8
    )

    if not chunks:
        raise HTTPException(
            status_code=404,
            detail=f"No documentation found for API '{request.api_name}'. Please upload documentation first."
        )

    context = "\n\n---\n\n".join(chunks)

    # Build language-specific prompt
    if request.language == "python":
        lang_instruction = """Generate a complete, production-ready Python SDK class.
Include:
- A main API client class with __init__ taking base_url and api_key
- Methods for every endpoint found in the docs
- Proper error handling with try/except
- requests or httpx library usage
- Docstrings for every method
- A runnable usage example at the bottom in `if __name__ == '__main__':`
Output ONLY the Python code, no conversational filler."""

    elif request.language == "javascript":
        lang_instruction = """Generate a complete JavaScript/Node.js SDK module.
Include:
- A class with constructor taking baseUrl and apiKey
- Async/await methods for every endpoint
- Modern fetch API usage
- Proper error handling
- JSDoc comments
- Runnable usage example at the bottom
Output ONLY the JavaScript code, no conversational filler."""

    elif request.language == "java":
        lang_instruction = """Generate a complete Java SDK class.
Include:
- A class with constructor taking baseUrl and apiKey
- Methods for every endpoint using java.net.http.HttpClient
- Proper exception handling
- Usage example in main method
Output ONLY the Java code, no conversational filler."""

    elif request.language == "curl":
        lang_instruction = """Generate complete cURL commands for every endpoint.
Include:
- One curl command per endpoint
- Proper headers including Authorization
- Example request body where needed
- Comments explaining each command
Output ONLY the curl commands with comments, no conversational filler."""

    else:
        lang_instruction = """Generate complete SDKs in ALL of these languages:
1. Python (complete client class with methods)
2. JavaScript (complete class with async/await)
3. cURL (commands for all endpoints)

Format each section with a clear header:
=== PYTHON SDK ===
[code here]

=== JAVASCRIPT SDK ===
[code here]

=== CURL COMMANDS ===
[code here]"""

    prompt = f"""You are an expert SDK code generator.
Based on the provided API documentation, generate clean, production-ready client code.

API DOCUMENTATION:
{context}

TASK:
{lang_instruction}

Guidelines:
- Use placeholder values like `YOUR_API_KEY`, `YOUR_BASE_URL` where needed.
- Make the code runnable and well-structured.
- Ensure all major endpoints from documentation are implemented."""

    try:
        response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=4096,
        )
        code = response.choices[0].message.content
        return {
            "success": True,
            "language": request.language,
            "api_name": request.api_name,
            "code": code,
            "tokens_used": response.usage.total_tokens if response.usage else 0,
            "generated_by": user.get("email")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SDK Generation error: {str(e)}")


@router.post("/generate-readme")
async def generate_readme(
    request: ReadmeRequest,
    user: Dict[str, Any] = Depends(require_developer_or_admin)
):
    """
    Automatically generates a developer-friendly README.md
    for the uploaded API documentation.
    Requires DEVELOPER or ADMIN role.
    """
    if not request.api_name.strip():
        raise HTTPException(status_code=400, detail="API name required")

    client = get_groq_client()
    if not client:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured in .env")

    chunks = find_relevant_chunks(
        "overview authentication endpoints parameters response errors rate limits",
        request.api_name.strip(),
        how_many=8
    )

    if not chunks:
        raise HTTPException(
            status_code=404,
            detail=f"No documentation found for API '{request.api_name}'. Please upload documentation first."
        )

    context = "\n\n---\n\n".join(chunks)

    prompt = f"""You are a technical documentation expert.
Generate a comprehensive, GitHub-ready README.md for this API.

API NAME: {request.api_name}

API DOCUMENTATION CONTEXT:
{context}

Include the following sections in your README.md:
# {request.api_name}

## 📖 Overview
(Concise summary of the API capabilities)

## 🌐 Base URL & Endpoints Summary
(Table of methods, paths, descriptions)

## 🔐 Authentication
(Clear guide with header/token examples)

## 🚀 Quick Start
(5-minute quick start with a working code snippet)

## 📡 API Reference & Endpoints
(Details for key endpoints with request/response examples)

## ⚠️ Error Handling & Status Codes
(Table of HTTP status codes and error responses)

## ⏱️ Rate Limits & Best Practices

Make it beautifully structured using markdown tables and syntax-highlighted code blocks.
Output ONLY the markdown content."""

    try:
        response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=4096,
        )
        readme = response.choices[0].message.content
        return {
            "success": True,
            "api_name": request.api_name,
            "readme": readme,
            "tokens_used": response.usage.total_tokens if response.usage else 0,
            "generated_by": user.get("email")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"README Generation error: {str(e)}")


@router.post("/download-sdk")
async def download_sdk_file(
    request: SdkDownloadRequest,
    user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """Download the generated SDK as a source code file."""
    extensions = {
        "python": ".py",
        "javascript": ".js",
        "java": ".java",
        "curl": ".sh",
        "all": ".txt"
    }
    ext = extensions.get(request.language.lower(), ".txt")
    filename = f"{request.api_name.replace(' ', '_')}_sdk{ext}"

    return StreamingResponse(
        io.BytesIO(request.code.encode("utf-8")),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/download-readme")
async def download_readme_file(
    request: ReadmeDownloadRequest,
    user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """Download the generated README as a markdown file."""
    if not request.readme.strip():
        raise HTTPException(status_code=400, detail="README content is empty")

    filename = f"{request.api_name.replace(' ', '_')}_README.md"
    return StreamingResponse(
        io.BytesIO(request.readme.encode("utf-8")),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )