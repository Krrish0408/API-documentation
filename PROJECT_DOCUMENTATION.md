# 📘 DocMind AI — Next-Gen API Documentation & Developer Platform
### Complete Architectural, Tech Stack, Auth.js & Operational Guide

---

## 🌟 1. Project Overview

**DocMind AI** is an enterprise-grade, full-stack AI Developer Platform that ingests, indexes, and queries complex API documentation (PDFs, Markdown, OpenAPI 3.x, and Swagger 2.0 specs).

The platform features a modern **Next.js (App Router)** frontend interface secured by **Auth.js (NextAuth)** with Role-Based Access Control (RBAC), Server-Sent Events (SSE) streaming, interactive multi-language SDK and README synthesis, and a live HTTP API request testing playground.

---

## 🛠️ 2. Comprehensive Tech Stack Breakdown

| Layer / Component | Technology / Library | Version | Purpose & Rationale |
|---|---|---|---|
| **Frontend Framework** | **Next.js (App Router)** | `14.2.15` | Modern React framework with server and client components, fast routing, and edge middleware. |
| **Frontend Runtime** | **React** & **React DOM** | `18.3.1` | Declarative UI rendering, hooks, and responsive lifecycle state management. |
| **Authentication & RBAC** | **Auth.js / NextAuth** | `4.24.10` / `5.x` | Industry-standard authentication, JWT session strategy, edge route guards, and role enforcement. |
| **Styling & Design** | **Tailwind CSS** & **PostCSS** | `3.4.14` | High-performance utility CSS, Dark/Light mode theming, and glassmorphism styling. |
| **Icons & Visuals** | **Lucide React** | `0.453.0` | Comprehensive, consistent icon system for developer interfaces and badges. |
| **Backend Framework** | **FastAPI** | `0.109.2` | High-performance asynchronous Python web framework for REST & Server-Sent Events (SSE). |
| **ASGI Server** | **Uvicorn** | `0.27.1` | Lightning-fast ASGI production web server with standard event loop and worker support. |
| **Data Validation** | **Pydantic v2** | `2.6.1` | Strict data serialization, request/response models, and validation schemas. |
| **Vector Database** | **ChromaDB** | `0.4.24` | Local, embedded vector database utilizing HNSW indexing with cosine similarity metric (5–50ms retrieval). |
| **Embeddings Model** | **Sentence-Transformers** (`all-MiniLM-L6-v2`) | `2.7.0` | Dense 384-dimensional semantic embeddings running completely locally on CPU/GPU. |
| **LLM Inference** | **Groq SDK** (`llama-3.3-70b-versatile` & `llama-3.1-8b-instant`) | `0.4.2` | Ultra-low latency Llama-3.3 model inference for QnA, SDK code generation, and documentation. |
| **PDF Extraction** | **PyMuPDF (Fitz)** | `1.23.22` | Ultra-fast document parsing and page-by-page text extraction for PDF API manuals. |
| **Spec Parsing** | **PyYAML** & **Python JSON** | `6.0.1` | Native OpenAPI 3.x and Swagger 2.0 YAML and JSON endpoint extraction. |
| **HTTP Client / API Tester** | **HTTPX** | `0.26.0` | Asynchronous HTTP client powering the live API tester with custom headers and bodies. |
| **PDF Generation** | **FPDF2** | `2.7.9` | Dynamic PDF generation for exporting QnA chat history and comprehensive documentation. |
| **Security Guard** | **Python Base64/JWT** | Standard Library | FastAPI RBAC middleware enforcing roles and verifying proxy tokens. |
| **Package Manager / Runtime** | **uv**, **Python 3.11**, **npm** | `0.11.26` / `3.11.15` / `11.16.0` | Fast Python and JavaScript package management. |

---

## 🔐 3. Authentication & Authorization (Auth.js & RBAC)

DocMind AI implements **Role-Based Access Control (RBAC)** across the entire stack:

### Role Permissions Matrix:

| Feature / Capability | 👑 ADMIN | 💻 DEVELOPER | 👁️ VIEWER |
|---|:---:|:---:|:---:|
| **Ask Questions & AI Chat Streaming** | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **Generate SDK Code (4 Languages) & README** | ✅ Allowed | ✅ Allowed | ❌ Restricted |
| **Side-by-Side Dual API Comparison** | ✅ Allowed | ✅ Allowed | ❌ Restricted |
| **Live HTTP Endpoint Testing Playground** | ✅ Allowed | ✅ Allowed | ❌ Restricted |
| **Ingest & Upload New Documentation** | 👑 Full Access | ❌ Restricted | ❌ Restricted |
| **Delete ChromaDB Vector Collections** | 👑 Full Access | ❌ Restricted | ❌ Restricted |

### Pre-Configured Demo Accounts (1-Click Login):
- **Administrator**: `admin@docmind.ai` (Password: `admin123` | Role: `ADMIN`)
- **Developer**: `dev@docmind.ai` (Password: `dev123` | Role: `DEVELOPER`)
- **Viewer**: `viewer@docmind.ai` (Password: `viewer123` | Role: `VIEWER`)
- *Custom accounts can also be created directly via the sign-in form.*

---

## 🏛️ 4. System Architecture

```
+-----------------------------------------------------------------------------------+
|                           NEXT.JS APP ROUTER FRONTEND                             |
|                                                                                   |
|  [ Auth.js (NextAuth) Session & RBAC ]  <--->  [ Edge Middleware (Guards) ]       |
|      ├── Credentials Provider (Admin / Dev / Viewer)                              |
|      └── JWT Session Tokens with Encrypted Role Claims                            |
|                                                                                   |
|  [ Modern UI Views (Tailwind CSS + Lucide Icons) ]                                |
|      ├── 💬 AI Assistant (SSE Streaming, Voice Mic, Markdown Highlighting)       |
|      ├── 📤 Document Ingestion (Drag-and-drop, Auto-detect, Parse Progress)       |
|      ├── 🔌 API Explorer & Comparison (Dual Concurrent LLM Answers)               |
|      ├── ⚡ SDK & README Studio (Multi-language Code Gen & 1-Click Download)      |
|      ├── 🧪 Live HTTP Playground (Interactive Request Tester & Timing)            |
|      └── 🛡️ Security & Role Permissions Matrix                                    |
+------------------------------------------+----------------------------------------+
                                           | Authenticated API Requests & SSE Stream
                                           v
+-----------------------------------------------------------------------------------+
|                             FASTAPI BACKEND ROUTERS                               |
|                                                                                   |
|  [ Auth Guard & Security Layer (services/auth_guard.py) ]                         |
|      ├── require_authenticated_user / require_admin_role                          |
|      ├── Public: /api/health, /api/apis                                           |
|      ├── Authenticated: /api/chat, /api/chat/stream, /api/generate-*, /api/test   |
|      └── Admin Only: /api/upload, DELETE /api/apis/{name}                         |
|                                                                                   |
|  [ Core Services ]                                                                |
|      ├── Document Parser (PyMuPDF, YAML/JSON OpenAPI 3 & Swagger 2)               |
|      ├── Vector Store (Local ChromaDB + SentenceTransformers all-MiniLM-L6-v2)    |
|      └── QnA Engine (Groq Llama 3.3 70B & 3.1 8B, Language Detection)            |
+-----------------------------------------------------------------------------------+
```

---

## 📂 5. Project Directory Structure

```
api/
├── main.py                     # FastAPI application entrypoint & static mount
├── config.py                   # Centralized configuration, paths & model settings
├── requirements.txt            # Python dependencies (with pinned numpy<2.0.0)
├── download_apis.py            # Utility to download 10 popular OpenAPI specs
├── generate_docs_pdf.py        # PDF documentation generation script
├── PROJECT_DOCUMENTATION.md    # Complete markdown technical documentation
├── DocMind_AI_Project_Documentation.pdf # Comprehensive compiled PDF manual
├── .env                        # Environment keys (GROQ_API_KEY)
│
├── frontend-next/              # Next.js Modern App Router UI with Auth.js
│   ├── package.json            # Next.js, React, NextAuth, Tailwind dependencies
│   ├── next.config.js          # Next.js configuration
│   ├── tailwind.config.js      # Tailwind theme configuration
│   ├── .env.local              # NextAuth URLs and secrets
│   └── src/
│       ├── auth.ts             # Auth.js / NextAuth configuration
│       ├── middleware.ts       # Edge route protection middleware
│       ├── lib/
│       │   └── authOptions.ts  # NextAuth Credentials Provider & callbacks
│       ├── components/
│       │   ├── Navbar.tsx      # Top Navigation with role badge & theme toggle
│       │   └── Providers.tsx   # Session & Theme context providers
│       └── app/
│           ├── layout.tsx      # Root layout
│           ├── page.tsx        # Entrypoint redirection
│           ├── globals.css     # Global theme & glassmorphism styling
│           ├── login/
│           │   └── page.tsx    # Modern Glassmorphism Sign-In page with 1-click presets
│           ├── dashboard/
│           │   └── page.tsx    # Full-featured interactive developer dashboard
│           └── api/
│               └── auth/
│                   └── [...nextauth]/
│                       └── route.ts # Auth.js API route handlers
│
├── services/
│   ├── __init__.py
│   ├── auth_guard.py           # Role-Based Access Control (RBAC) security guard
│   ├── document_parser.py      # Multi-format document parser & chunker
│   ├── vector_store.py         # ChromaDB persistence & vector cosine retrieval
│   └── qna_engine.py           # Prompt builder, language detector & Groq LLM integration
│
├── routes/
│   ├── __init__.py
│   ├── upload.py               # /api/upload, /api/detect-name, DELETE /api/apis/{name} (Admin guarded)
│   ├── chat.py                 # /api/chat, /api/chat/stream, /api/compare, /api/export-pdf
│   ├── generate.py             # /api/generate-sdk, /api/generate-readme, /api/download-*
│   └── test_api.py             # /api/test (Live HTTP endpoint tester)
│
├── api_docs/                   # Sample API documentation files (YAML, JSON, PDF)
├── data/                       # Local persistent ChromaDB vector store & uploads
└── models/                     # Local cached SentenceTransformer embedding model
```

---

## 🚀 6. How to Run the Project

### Running Both Backend and Frontend:

#### Terminal 1: Start the FastAPI Backend
```bash
# 1. Activate the Python virtual environment
source .venv/bin/activate

# 2. Start the backend server on port 8000
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### Terminal 2: Start the Next.js Frontend
```bash
# 1. Navigate to the frontend directory
cd frontend-next

# 2. Start the Next.js development server on port 3000
npm run dev
```

Open your browser and navigate to:
👉 **`http://localhost:3000`**

Sign in instantly with one of the 1-click role presets:
- **👑 Admin**: `admin@docmind.ai` (Password: `admin123`)
- **💻 Developer**: `dev@docmind.ai` (Password: `dev123`)
- **👁️ Viewer**: `viewer@docmind.ai` (Password: `viewer123`)
