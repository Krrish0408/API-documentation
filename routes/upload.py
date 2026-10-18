import os
import shutil
from typing import Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from services.document_parser import parse_document, detect_api_name_from_file
from services.vector_store import store_document_chunks, delete_api_documents
from services.auth_guard import require_admin_role, require_authenticated_user
from config import UPLOAD_FOLDER

router = APIRouter()

ALLOWED_EXTENSIONS = [".pdf", ".md", ".markdown", ".txt", ".yaml", ".yml", ".json"]


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    api_name: str = Form(...),
    user: Dict[str, Any] = Depends(require_admin_role)
):
    """
    Accepts a documentation file upload, parses it into structured chunks,
    generates vector embeddings, and stores them in ChromaDB.
    Enforces ADMIN role permission.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    clean_filename = os.path.basename(file.filename)
    file_extension = os.path.splitext(clean_filename)[1].lower()

    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file_extension}' not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    if not api_name.strip():
        raise HTTPException(status_code=400, detail="API name cannot be empty")

    saved_file_path = os.path.join(UPLOAD_FOLDER, clean_filename)
    try:
        with open(saved_file_path, "wb") as saved_file:
            shutil.copyfileobj(file.file, saved_file)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(error)}")

    try:
        text_chunks = parse_document(saved_file_path)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to read document: {str(error)}")

    if not text_chunks:
        raise HTTPException(status_code=400, detail="Document appears to be empty or could not be parsed")

    try:
        number_of_chunks = store_document_chunks(text_chunks, api_name.strip(), clean_filename)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to store in vector database: {str(error)}")

    return {
        "success": True,
        "message": "Document processed and indexed successfully!",
        "file_name": clean_filename,
        "api_name": api_name.strip(),
        "chunks_stored": number_of_chunks,
        "uploaded_by": user.get("email", "admin")
    }


@router.post("/detect-name")
async def detect_name(
    file: UploadFile = File(...),
    user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """
    Auto-detects a clean API name from uploaded spec / doc file or filename.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    clean_filename = os.path.basename(file.filename)
    saved_file_path = os.path.join(UPLOAD_FOLDER, clean_filename)

    try:
        with open(saved_file_path, "wb") as saved_file:
            shutil.copyfileobj(file.file, saved_file)
        detected_name, source = detect_api_name_from_file(saved_file_path, clean_filename)
        return {
            "success": True,
            "detected_name": detected_name,
            "source": source
        }
    except Exception as error:
        return {
            "success": False,
            "detected_name": os.path.splitext(clean_filename)[0].lower(),
            "source": "fallback"
        }


@router.delete("/apis/{api_name}")
async def delete_api(
    api_name: str,
    user: Dict[str, Any] = Depends(require_admin_role)
):
    """
    Deletes an API vector collection from ChromaDB.
    Enforces ADMIN role permission.
    """
    if not api_name.strip():
        raise HTTPException(status_code=400, detail="API name cannot be empty")

    success = delete_api_documents(api_name.strip())
    if success:
        return {
            "success": True,
            "message": f"API '{api_name}' deleted successfully",
            "deleted_by": user.get("email", "admin")
        }
    else:
        raise HTTPException(status_code=404, detail=f"API '{api_name}' not found or could not be deleted")