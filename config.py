import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Base directories
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str(DATA_DIR / "uploads"))
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", str(DATA_DIR / "chroma_db"))
HF_CACHE_DIR = os.getenv("HF_HOME", str(BASE_DIR / ".hf_cache"))

# Ensure base runtime directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CHROMA_DB_PATH, exist_ok=True)
os.makedirs(HF_CACHE_DIR, exist_ok=True)

# Set Hugging Face cache dir environment variable
os.environ.setdefault("HF_HOME", HF_CACHE_DIR)

# Groq LLM settings
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "llama-3.3-70b-versatile")
DEFAULT_MODEL_FAST = os.getenv("DEFAULT_MODEL_FAST", "llama-3.1-8b-instant")

# Embedding & chunking settings
LOCAL_MODEL_PATH = str(BASE_DIR / "models" / "all-MiniLM-L6-v2")
EMBEDDING_MODEL_NAME = LOCAL_MODEL_PATH if os.path.exists(LOCAL_MODEL_PATH) else "all-MiniLM-L6-v2"
MAX_CHUNK_SIZE = int(os.getenv("MAX_CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))