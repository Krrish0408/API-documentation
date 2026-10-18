import os
from datetime import datetime
from fpdf import FPDF

class PDFReport(FPDF):
    def header(self):
        self.set_fill_color(26, 26, 46)
        self.rect(0, 0, 210, 14, "F")
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(255, 255, 255)
        self.set_xy(10, 3)
        self.cell(0, 8, "DocMind AI - Full Project Architecture & Tech Stack Manual", 0, 0, "L")
        self.set_xy(10, 3)
        self.cell(190, 8, datetime.now().strftime("%B %Y"), 0, 0, "R")
        self.ln(14)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(140, 140, 150)
        self.cell(0, 6, f"DocMind AI Documentation  |  Page {self.page_no()}/{{nb}}", 0, 0, "C")

    def chapter_title(self, num, title):
        self.set_font("Helvetica", "B", 13)
        self.set_fill_color(240, 242, 248)
        self.set_text_color(30, 41, 59)
        self.cell(0, 8, f"  {num}. {title}", 0, 1, "L", fill=True)
        self.ln(3)

    def section_title(self, title):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(79, 70, 229)
        self.cell(0, 6, title, 0, 1, "L")
        self.ln(1)

    def body_text(self, text):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(51, 65, 85)
        self.multi_cell(0, 4.5, text)
        self.ln(2)

    def table_row(self, col1, col2, col3, col4, is_header=False):
        if is_header:
            self.set_font("Helvetica", "B", 8)
            self.set_fill_color(30, 41, 59)
            self.set_text_color(255, 255, 255)
        else:
            self.set_font("Helvetica", "", 8)
            self.set_fill_color(248, 250, 252)
            self.set_text_color(51, 65, 85)
        
        self.cell(40, 6, col1, 1, 0, "L", fill=True)
        self.cell(42, 6, col2, 1, 0, "L", fill=True)
        self.cell(20, 6, col3, 1, 0, "C", fill=True)
        self.cell(88, 6, col4, 1, 1, "L", fill=True)

def generate_pdf():
    pdf = PDFReport(orientation="P", unit="mm", format="A4")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Title
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 10, "DocMind AI - Project Documentation", 0, 1, "L")

    pdf.set_font("Helvetica", "I", 10)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 6, "Production-Grade AI Documentation Assistant, Vector Search & Code Generator", 0, 1, "L")
    pdf.ln(4)

    # 1. Executive Summary
    pdf.chapter_title(1, "Executive Summary & System Overview")
    pdf.body_text(
        "DocMind AI is an advanced, production-grade AI Agent designed to ingest, index, and query complex API documentation across multiple industry formats (PDFs, Markdown, OpenAPI 3.x, and Swagger 2.0 specs). "
        "It empowers developers to query APIs using natural English or conversational Hinglish, compare endpoints between different APIs side-by-side, test live HTTP endpoints directly in the browser, and automatically generate production-ready SDK client libraries (Python, JavaScript, Java, cURL) and complete README.md files."
    )

    # 2. Tech Stack Table
    pdf.chapter_title(2, "Complete Tech Stack & Dependencies")
    pdf.table_row("Layer", "Technology / Library", "Version", "Role & Rationale", is_header=True)
    pdf.table_row("Backend API", "FastAPI", "0.109.2", "Async REST endpoints & Server-Sent Events (SSE)")
    pdf.table_row("ASGI Server", "Uvicorn", "0.27.1", "High-throughput asynchronous web server")
    pdf.table_row("Data Schema", "Pydantic v2", "2.6.1", "Strict request validation and data serialization")
    pdf.table_row("Vector DB", "ChromaDB", "0.4.24", "Local persistent vector storage with cosine similarity")
    pdf.table_row("Embeddings", "Sentence-Transformers", "2.7.0", "Dense 384-dim local embeddings (all-MiniLM-L6-v2)")
    pdf.table_row("LLM Inference", "Groq Cloud API", "0.4.2", "Ultra-fast Llama 3.3 70B & 3.1 8B inference")
    pdf.table_row("PDF Parser", "PyMuPDF (Fitz)", "1.23.22", "High-speed document parsing & text extraction")
    pdf.table_row("Spec Parser", "PyYAML / json", "6.0.1", "Native OpenAPI 3.x & Swagger 2.0 parsing")
    pdf.table_row("HTTP Client", "HTTPX", "0.26.0", "Asynchronous HTTP client for live endpoint testing")
    pdf.table_row("PDF Export", "FPDF2", "2.7.9", "Dynamic PDF generation for chat history and reports")
    pdf.table_row("Frontend UI", "HTML5 / CSS3 / ES6+", "Native", "Clean responsive dark/light UI with voice recognition")
    pdf.ln(4)

    # 3. System Architecture
    pdf.chapter_title(3, "System Architecture & Processing Pipeline")
    pdf.body_text(
        "The DocMind AI architecture consists of three interconnected processing pipelines:\n"
        "1. Ingestion Pipeline: Ingests uploaded API specs, extracts structured endpoint metadata (methods, paths, parameters, responses), and chunks documents with overlap. Dense 384-dimensional embeddings are generated in batches via all-MiniLM-L6-v2 and stored in ChromaDB.\n"
        "2. Retrieval & QnA Pipeline: Automatically detects user query language (English vs. Hinglish) and target programming language (Python, JS, Java, cURL). Executes cosine similarity vector retrieval against ChromaDB, builds grounded system prompts, and streams real-time tokens via SSE.\n"
        "3. Automation & Testing Pipeline: Synthesizes production client SDKs and README.md files on demand, and allows interactive execution of live HTTP requests with custom headers and payload validation."
    )

    # 4. REST API Specification
    pdf.chapter_title(4, "REST API Endpoints Reference")
    pdf.table_row("Method & Route", "Description", "Input Format", "Output Format", is_header=True)
    pdf.table_row("POST /api/upload", "Uploads & indexes API docs", "Multipart Form", "JSON (chunks stored)")
    pdf.table_row("POST /api/detect-name", "Auto-detects API name", "Multipart Form", "JSON (detected name)")
    pdf.table_row("GET /api/apis", "Lists all indexed APIs", "None", "JSON (api list)")
    pdf.table_row("DELETE /api/apis/{name}", "Deletes an indexed API", "Path Param", "JSON (confirmation)")
    pdf.table_row("POST /api/chat", "Synchronous grounded QnA", "JSON body", "JSON (answer + tokens)")
    pdf.table_row("POST /api/chat/stream", "Real-time streaming QnA", "JSON body", "Server-Sent Events (SSE)")
    pdf.table_row("POST /api/compare", "Side-by-side API comparison", "JSON body", "JSON (dual answers)")
    pdf.table_row("POST /api/generate-sdk", "Generates client SDK code", "JSON body", "JSON (code + language)")
    pdf.table_row("POST /api/generate-readme", "Generates README.md docs", "JSON body", "JSON (markdown)")
    pdf.table_row("POST /api/download-sdk", "Downloads SDK source file", "JSON body", "File Attachment (.py/.js)")
    pdf.table_row("POST /api/download-readme", "Downloads README.md file", "JSON body", "File Attachment (.md)")
    pdf.table_row("POST /api/test", "Executes live HTTP requests", "JSON body", "JSON (status, time, body)")
    pdf.table_row("POST /api/export-pdf", "Exports chat to PDF", "JSON body", "PDF Stream")
    pdf.table_row("GET /api/health", "System health & statistics", "None", "JSON (status & counts)")
    pdf.ln(4)

    # 5. Setup & Operational Guide
    pdf.chapter_title(5, "Setup, Execution & Verification")
    pdf.body_text(
        "To run DocMind AI in a local development or production environment:\n"
        "1. Environment: Python 3.10+ (Python 3.11 recommended).\n"
        "2. Virtual Environment: uv venv .venv && source .venv/bin/activate\n"
        "3. Dependency Installation: uv pip install -r requirements.txt\n"
        "4. Configuration: Configure GROQ_API_KEY in .env file.\n"
        "5. Launch Server: uvicorn main:app --host 0.0.0.0 --port 8000 --reload\n"
        "6. Access Interface: Navigate to http://localhost:8000 in your browser."
    )

    output_pdf = "DocMind_AI_Project_Documentation.pdf"
    pdf.output(output_pdf)
    print(f"Successfully generated PDF: {output_pdf} ({os.path.getsize(output_pdf)} bytes)")

if __name__ == "__main__":
    generate_pdf()
