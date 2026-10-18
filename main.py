import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import config
from routes import auth, upload, chat, test_api, generate
from services.vector_store import get_all_api_names

app = FastAPI(
    title="DocMind AI — API Documentation Agent",
    description="Full-stack AI assistant with Authentication and RBAC for querying, testing, and generating SDKs from API documentation.",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    """Health check endpoint providing runtime, auth, and database statistics."""
    apis = get_all_api_names()
    has_groq = bool(config.GROQ_API_KEY)
    return {
        "status": "online",
        "version": "3.0.0",
        "auth_enabled": True,
        "active_apis": apis,
        "api_count": len(apis),
        "groq_configured": has_groq,
        "embedding_model": config.EMBEDDING_MODEL_NAME
    }


# Register route controllers
app.include_router(auth.router,     prefix="/api/auth", tags=["Authentication & RBAC"])
app.include_router(upload.router,   prefix="/api",      tags=["Document Upload & Parsing"])
app.include_router(chat.router,     prefix="/api",      tags=["QnA & Chat"])
app.include_router(test_api.router, prefix="/api",      tags=["Live API Tester"])
app.include_router(generate.router, prefix="/api",      tags=["SDK & README Generator"])

# Mount static frontend assets
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)