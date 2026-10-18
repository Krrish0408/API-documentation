"""
services/vector_store.py — Fast Local ChromaDB Vector Store with SentenceTransformers
Provides embedding generation, document chunk storage, and cosine similarity retrieval.
"""

import os
import re
import time
from typing import List, Dict, Any, Optional

# Set offline environment variables for Hugging Face and ChromaDB
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from config import CHROMA_DB_PATH, EMBEDDING_MODEL_NAME

# ─── Fast Offline Embedding Model Loader ──────────────────────────────────────
_embedding_model: Optional[SentenceTransformer] = None


def get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        try:
            # Attempt fast load from local cache first
            _embedding_model = SentenceTransformer(
                EMBEDDING_MODEL_NAME,
                model_kwargs={"local_files_only": True}
            )
        except Exception:
            # Fallback to standard load/download if not yet cached
            _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _embedding_model


# ─── Local ChromaDB Persistent Client ─────────────────────────────────────────
_chroma_client = chromadb.PersistentClient(
    path=CHROMA_DB_PATH,
    settings=Settings(anonymized_telemetry=False, is_persistent=True)
)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _clean_name(name: str) -> str:
    """
    Format collection name to satisfy ChromaDB requirements:
    3-63 characters, lowercase alphanumeric and hyphens, starting/ending with alphanumeric.
    """
    if not name or not name.strip():
        return "api-docs"
    cleaned = re.sub(r'[^a-zA-Z0-9-]', '-', name.strip())
    cleaned = re.sub(r'-{2,}', '-', cleaned).strip('-').lower()
    cleaned = cleaned[:63]
    if len(cleaned) < 3:
        cleaned = (cleaned + "---")[:3]
    return cleaned


def _get_collection(api_name: str):
    """Get or create ChromaDB collection for a given API name."""
    col_name = _clean_name(api_name)
    return _chroma_client.get_or_create_collection(
        name=col_name,
        metadata={"hnsw:space": "cosine", "display_name": api_name}
    )


def _embed_batch(texts: List[str]) -> List[List[float]]:
    """Batch embed multiple text chunks in a single vectorized forward pass."""
    if not texts:
        return []
    model = get_embedding_model()
    truncated = [t[:8000] for t in texts]
    return model.encode(truncated, batch_size=32, show_progress_bar=False).tolist()


def _embed(text: str) -> List[float]:
    """Generate 384-dim dense vector embedding using all-MiniLM-L6-v2."""
    embeddings = _embed_batch([text])
    return embeddings[0] if embeddings else []


# ─── Public API ───────────────────────────────────────────────────────────────

def store_document_chunks(chunks: List[str], api_name: str, source_filename: str) -> int:
    """
    Stores text chunks in the corresponding ChromaDB collection with vector embeddings.
    Uses high-speed batch encoding for maximum throughput.
    Returns the total number of chunks stored.
    """
    collection = _get_collection(api_name)
    timestamp = str(int(time.time()))

    valid_chunks: List[str] = []
    ids: List[str] = []
    metadatas: List[Dict[str, Any]] = []

    for i, chunk in enumerate(chunks):
        chunk_clean = chunk.strip()
        if not chunk_clean:
            continue
        valid_chunks.append(chunk_clean)
        ids.append(f"{_clean_name(source_filename)}_{timestamp}_{i}")
        metadatas.append({
            "source_file": source_filename,
            "api_name": api_name,
            "chunk_index": i,
            "timestamp": timestamp,
        })

    if not ids:
        return 0

    embeddings = _embed_batch(valid_chunks)

    # Upsert in safe batches of 200 to prevent payload limits
    batch_size = 200
    for j in range(0, len(ids), batch_size):
        collection.upsert(
            ids=ids[j:j+batch_size],
            embeddings=embeddings[j:j+batch_size],
            documents=valid_chunks[j:j+batch_size],
            metadatas=metadatas[j:j+batch_size]
        )

    return len(ids)


def find_relevant_chunks(question: str, api_name: str, how_many: int = 3) -> List[str]:
    """
    Performs cosine similarity search to retrieve the top-N most relevant context chunks.
    """
    collection = _get_collection(api_name)
    count = collection.count()
    if count == 0:
        return []

    n = min(how_many, count)
    query_vector = _embed(question)

    results = collection.query(
        query_embeddings=[query_vector],
        n_results=n,
        include=["documents", "metadatas", "distances"]
    )

    if results and results.get("documents") and results["documents"][0]:
        return results["documents"][0]
    return []


def get_all_api_names() -> List[str]:
    """
    Returns list of all active API names stored in local ChromaDB.
    """
    names = []
    for c in _chroma_client.list_collections():
        c_name = c.name if hasattr(c, "name") else str(c)
        if c_name not in ("def", "default"):
            names.append(c_name)
    return sorted(list(set(names)))


def get_api_chunk_count(api_name: str) -> int:
    """Returns number of chunks stored for an API."""
    try:
        col = _get_collection(api_name)
        return col.count()
    except Exception:
        return 0


def delete_api_documents(api_name: str) -> bool:
    """Deletes all indexed documents and vector collection for a specific API."""
    try:
        col_name = _clean_name(api_name)
        _chroma_client.delete_collection(col_name)
        return True
    except Exception:
        return False


# Compatibility Aliases
def get_text_embedding(text: str) -> List[float]:
    return _embed(text)


def clean_namespace_name(name: str) -> str:
    return _clean_name(name)