import io
import json
import asyncio
import threading
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from services.qna_engine import generate_answer, stream_answer
from services.vector_store import get_all_api_names
from services.auth_guard import require_authenticated_user, require_developer_or_admin

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: Optional[str] = None


class AskQuestionRequest(BaseModel):
    question: str
    api_name: str
    conversation_history: Optional[List[Dict[str, Any]]] = []


class CompareRequest(BaseModel):
    question: str
    api1: str
    api2: str
    conversation_history: Optional[List[Dict[str, Any]]] = []


class ExportPDFRequest(BaseModel):
    api_name: str
    messages: List[ChatMessage]


@router.post("/chat")
async def ask_question(
    request: AskQuestionRequest,
    user: Dict[str, Any] = Depends(require_authenticated_user)
):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if not request.api_name.strip():
        raise HTTPException(status_code=400, detail="Please select an API")
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            lambda: generate_answer(request.question, request.api_name, request.conversation_history or [])
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat generation failed: {str(e)}")


@router.post("/chat/stream")
async def ask_question_stream(
    request: AskQuestionRequest,
    user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """Real-time Groq streaming via Thread + asyncio.Queue bridge."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if not request.api_name.strip():
        raise HTTPException(status_code=400, detail="Please select an API")

    async def event_stream():
        loop = asyncio.get_running_loop()
        queue = asyncio.Queue()
        DONE = object()

        def producer():
            try:
                for chunk in stream_answer(request.question, request.api_name, request.conversation_history or []):
                    loop.call_soon_threadsafe(queue.put_nowait, chunk)
            except Exception as exc:
                loop.call_soon_threadsafe(queue.put_nowait, Exception(str(exc)))
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, DONE)

        t = threading.Thread(target=producer, daemon=True)
        t.start()

        while True:
            item = await queue.get()
            if item is DONE:
                break
            if isinstance(item, Exception):
                yield f"data: {json.dumps({'error': str(item), 'done': True})}\n\n"
                return
            yield f"data: {json.dumps({'text': item, 'done': False})}\n\n"

        t.join(timeout=2.0)
        yield f"data: {json.dumps({'text': '', 'done': True})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/compare")
async def compare_apis(
    request: CompareRequest,
    user: Dict[str, Any] = Depends(require_developer_or_admin)
):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if not request.api1.strip() or not request.api2.strip():
        raise HTTPException(status_code=400, detail="Please select both APIs to compare")
    if request.api1 == request.api2:
        raise HTTPException(status_code=400, detail="Please select two different APIs")
    try:
        loop = asyncio.get_running_loop()
        r1, r2 = await asyncio.gather(
            loop.run_in_executor(None, lambda: generate_answer(request.question, request.api1, request.conversation_history or [])),
            loop.run_in_executor(None, lambda: generate_answer(request.question, request.api2, request.conversation_history or [])),
        )
        return {
            "question": request.question,
            "api1": request.api1,
            "api2": request.api2,
            "answer1": r1.get("answer", ""),
            "answer2": r2.get("answer", ""),
            "tokens1": r1.get("tokens_used", 0),
            "tokens2": r2.get("tokens_used", 0),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compare failed: {str(e)}")


@router.get("/apis")
async def list_available_apis():
    try:
        return {"apis": get_all_api_names()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _sanitize_pdf_text(text: str) -> str:
    """Replaces Unicode punctuation and encodes cleanly for standard PDF fonts."""
    if not text:
        return ""
    replacements = {
        "\u2014": "-",   # em dash
        "\u2013": "-",   # en dash
        "\u2018": "'",   # left single quote
        "\u2019": "'",   # right single quote
        "\u201c": '"',   # left double quote
        "\u201d": '"',   # right double quote
        "\u2022": "*",   # bullet
        "\u2026": "...", # ellipsis
        "\u00a0": " ",   # non-breaking space
    }
    for orig, rep in replacements.items():
        text = text.replace(orig, rep)
    return text.encode("latin-1", errors="replace").decode("latin-1")


@router.post("/export-pdf")
async def export_chat_pdf(
    request: ExportPDFRequest,
    user: Dict[str, Any] = Depends(require_authenticated_user)
):
    try:
        from fpdf import FPDF
    except ImportError:
        raise HTTPException(status_code=500, detail="fpdf2 is not installed. Run `pip install fpdf2`.")

    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages to export")

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Header Banner
    pdf.set_font("Helvetica", "B", 15)
    pdf.set_fill_color(25, 25, 45)
    pdf.set_text_color(255, 255, 255)
    header_title = _sanitize_pdf_text(f"  DocMind AI - {request.api_name} QnA Export")
    pdf.cell(0, 12, header_title, fill=True, ln=True)

    # Subtitle
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(140, 140, 160)
    sub_title = _sanitize_pdf_text(f"  Exported on {datetime.now().strftime('%d %b %Y, %I:%M %p')} | User: {user.get('name', 'User')} ({user.get('role', 'VIEWER')})")
    pdf.cell(0, 6, sub_title, ln=True)
    pdf.ln(4)

    for msg in request.messages:
        is_user = msg.role == "user"

        # Sender Label
        pdf.set_font("Helvetica", "B", 10)
        if is_user:
            pdf.set_text_color(100, 90, 220)  # Purple/Indigo for user
            pdf.cell(0, 6, "  You", ln=True)
        else:
            pdf.set_text_color(40, 160, 120)  # Teal/Green for Assistant
            pdf.cell(0, 6, "  DocMind Assistant", ln=True)

        # Message Content
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(40, 40, 50)

        # Sanitize text for standard font encoding
        clean_content = _sanitize_pdf_text(msg.content)
        pdf.multi_cell(0, 5, clean_content)

        # Timestamp
        if msg.timestamp:
            pdf.set_font("Helvetica", "I", 7)
            pdf.set_text_color(160, 160, 170)
            clean_ts = _sanitize_pdf_text(f"  {msg.timestamp}")
            pdf.cell(0, 4, clean_ts, ln=True)

        # Divider
        pdf.set_draw_color(220, 220, 230)
        pdf.line(10, pdf.get_y() + 2, 200, pdf.get_y() + 2)
        pdf.ln(4)

    # Footer
    pdf.set_y(-12)
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_text_color(160, 160, 170)
    pdf.cell(0, 8, _sanitize_pdf_text(f"DocMind AI | Page {pdf.page_no()}"), align="C")

    safe_name = request.api_name.replace(" ", "_").replace("/", "_")
    filename = f"{safe_name}_chat_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    pdf_bytes = bytes(pdf.output())

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )