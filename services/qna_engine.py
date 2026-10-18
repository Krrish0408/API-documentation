import os
import re
from typing import Optional, Dict, Any, List, Generator
from groq import Groq
from config import GROQ_API_KEY, DEFAULT_MODEL, DEFAULT_MODEL_FAST
from services.vector_store import find_relevant_chunks

_groq_client: Optional[Groq] = None


def get_groq_client() -> Optional[Groq]:
    """Lazy initialize the Groq client with API key validation."""
    global _groq_client
    if _groq_client is None:
        key = os.getenv("GROQ_API_KEY", "").strip() or GROQ_API_KEY
        if key:
            _groq_client = Groq(api_key=key)
    return _groq_client


# ─── Language Detection ───────────────────────────────────────────────────────
HINGLISH_RE = re.compile(
    r'\b(kya|kaise|kyun|mujhe|batao|karo|hai|hoga|chahiye|aur|nahi|matlab|'
    r'samjho|dena|krna|kr|bata|yeh|iska|uska|iske|uske|bhai|yaar|theek|'
    r'accha|pls|plz|hain|kar|mein|se|ke|ka|ki|ko|pe|par|ho|tha|thi|the|'
    r'jaise|waise|phir|pehle|baad|upar|neeche|seedha|likh|dikha|samjha)\b',
    re.IGNORECASE
)

# ─── Code Language Detection ─────────────────────────────────────────────────
CODE_LANG_RE = {
    'Python': re.compile(r'\b(python|py|django|flask|fastapi|pandas|numpy)\b', re.IGNORECASE),
    'JavaScript': re.compile(r'\b(javascript|js|node|nodejs|react|vue|angular|typescript|ts|axios|fetch)\b', re.IGNORECASE),
    'Java': re.compile(r'\b(java|spring|maven|gradle|springboot)\b', re.IGNORECASE),
    'Go': re.compile(r'\b(golang|go lang)\b', re.IGNORECASE),
    'PHP': re.compile(r'\b(php|laravel|wordpress)\b', re.IGNORECASE),
    'Ruby': re.compile(r'\b(ruby|rails)\b', re.IGNORECASE),
    'Rust': re.compile(r'\b(rust|cargo)\b', re.IGNORECASE),
    'C#': re.compile(r'\b(c#|csharp|dotnet|\.net)\b', re.IGNORECASE),
    'cURL': re.compile(r'\b(curl|bash|shell|terminal|command line)\b', re.IGNORECASE),
    'Swift': re.compile(r'\b(swift|ios|xcode)\b', re.IGNORECASE),
    'Kotlin': re.compile(r'\b(kotlin|android)\b', re.IGNORECASE),
}


def detect_language(text: str) -> str:
    """Detect if user is writing in Hinglish or English."""
    return 'hinglish' if HINGLISH_RE.search(text) else 'english'


def detect_code_language(text: str) -> Optional[str]:
    """Detect if user wants code in a specific language. Returns None if not specified."""
    for lang, pattern in CODE_LANG_RE.items():
        if pattern.search(text):
            return lang
    return None


# ─── System Prompt Builder ────────────────────────────────────────────────────
def build_system_prompt(detected_lang: str, code_lang: Optional[str],
                        context_text: str, history: List[Dict[str, Any]]) -> str:

    if detected_lang == 'hinglish':
        lang_instr = (
            "CRITICAL RULE — Language:\n"
            "User Hinglish mein likh raha hai (Hindi + English mix).\n"
            "Tum bhi Hinglish mein jawab do — bilkul naturally.\n"
            "Example: 'Authentication ke liye pehle API key generate karni hogi. "
            "Yeh kuch is tarah kaam karta hai:'\n"
            "KABHI pure English mein jawab mat dena jab user Hinglish mein pooche."
        )
    else:
        lang_instr = (
            "CRITICAL RULE — Language:\n"
            "Respond in clear, concise, professional English."
        )

    if code_lang:
        code_instr = f"""ABSOLUTE MANDATORY RULE — CODE LANGUAGE:
THE USER WANTS **{code_lang.upper()}** CODE ONLY.
- Output ONLY {code_lang} code blocks
- DO NOT write Python if user asked Java
- DO NOT write JavaScript if user asked Python  
- DO NOT give multiple languages
- One clean, complete {code_lang} example is enough
- Start with ```{code_lang.lower()} and end with ```"""
    else:
        code_instr = """CODE RULE:
- Only add code if question clearly needs it (how to call, example, etc.)
- If needed: provide Python first, then JavaScript — keep examples concise and copy-paste ready
- No code needed for: "what is X", "explain Y", "list endpoints" type questions"""

    history_ctx = ""
    if history:
        history_ctx = "\n\nCONVERSATION HISTORY (for context):\n"
        for msg in history[-6:]:
            role = "User" if msg.get('role') == 'user' else "Assistant"
            content = msg.get('content', '')
            if len(content) > 300:
                content = content[:300] + "..."
            history_ctx += f"{role}: {content}\n\n"
        history_ctx += (
            "Use this history to avoid repetition and build on previous answers when the user asks follow-up questions."
        )

    return f"""You are DocMind AI — an expert API Documentation Assistant.
Your goal is to provide accurate, developer-ready answers strictly grounded in the provided API documentation.

{lang_instr}

{code_instr}

RESPONSE STYLE:
1. Answer directly and concisely.
2. The first sentence should directly address the question.
3. Use markdown bullet points and tables for structured data.
4. Provide fully working code snippets with placeholders like `YOUR_API_KEY` and `BASE_URL`.

{history_ctx}

API DOCUMENTATION CONTEXT:
{context_text}"""


# ─── Main Functions ───────────────────────────────────────────────────────────

def generate_answer(question: str, api_name: str, conversation_history: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Generate a complete answer (non-streaming).
    Supports: language detection, code language detection, conversation memory.
    """
    if conversation_history is None:
        conversation_history = []

    detected_lang = detect_language(question)
    code_lang = detect_code_language(question)

    client = get_groq_client()
    if not client:
        err_msg = (
            "GROQ_API_KEY configure nahi hai. Kripya .env file mein GROQ_API_KEY daalein."
            if detected_lang == 'hinglish'
            else "GROQ_API_KEY is not configured. Please add your Groq API key to the .env file."
        )
        return {
            "answer": err_msg,
            "sources_used": [],
            "tokens_used": 0,
            "detected_lang": detected_lang,
            "code_lang": code_lang,
        }

    relevant_chunks = find_relevant_chunks(question, api_name, how_many=3)

    if not relevant_chunks:
        no_doc_msg = (
            f"API '{api_name}' ke liye koi documentation nahi mili. Pehle docs upload karein."
            if detected_lang == 'hinglish'
            else f"No documentation found for API '{api_name}'. Please upload documentation first."
        )
        return {
            "answer": no_doc_msg,
            "sources_used": [],
            "tokens_used": 0,
            "detected_lang": detected_lang,
            "code_lang": code_lang,
        }

    context_text = "\n\n---\n\n".join(relevant_chunks)
    system_prompt = build_system_prompt(detected_lang, code_lang, context_text, conversation_history)

    messages = [{"role": "system", "content": system_prompt}]
    for msg in conversation_history[-4:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": question})

    use_model = DEFAULT_MODEL if code_lang else DEFAULT_MODEL_FAST
    if len(question) > 80 or any(w in question.lower() for w in ['compare', 'explain', 'difference', 'how does']):
        use_model = DEFAULT_MODEL

    try:
        response = client.chat.completions.create(
            model=use_model,
            messages=messages,
            temperature=0.1,
            max_tokens=1024,
        )
        return {
            "answer": response.choices[0].message.content,
            "sources_used": relevant_chunks,
            "tokens_used": response.usage.total_tokens if response.usage else 0,
            "detected_lang": detected_lang,
            "code_lang": code_lang,
        }
    except Exception as e:
        return {
            "answer": f"Generation Error: {str(e)}",
            "sources_used": relevant_chunks,
            "tokens_used": 0,
            "detected_lang": detected_lang,
            "code_lang": code_lang,
        }


def stream_answer(question: str, api_name: str, conversation_history: Optional[List[Dict[str, Any]]] = None) -> Generator[str, None, None]:
    """
    Real-time streaming generator from Groq.
    Yields text delta chunks as they arrive.
    """
    if conversation_history is None:
        conversation_history = []

    detected_lang = detect_language(question)
    code_lang = detect_code_language(question)

    client = get_groq_client()
    if not client:
        err_msg = (
            "GROQ_API_KEY configure nahi hai. Kripya .env file mein GROQ_API_KEY daalein."
            if detected_lang == 'hinglish'
            else "GROQ_API_KEY is not configured. Please set your Groq API key in .env file."
        )
        yield err_msg
        return

    relevant_chunks = find_relevant_chunks(question, api_name, how_many=3)

    if not relevant_chunks:
        no_doc_msg = (
            f"API '{api_name}' ke liye koi documentation nahi mili. Pehle docs upload karein."
            if detected_lang == 'hinglish'
            else f"No documentation found for API '{api_name}'. Please upload documentation first."
        )
        yield no_doc_msg
        return

    context_text = "\n\n---\n\n".join(relevant_chunks)
    system_prompt = build_system_prompt(detected_lang, code_lang, context_text, conversation_history)

    messages = [{"role": "system", "content": system_prompt}]
    for msg in conversation_history[-4:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": question})

    use_model = DEFAULT_MODEL if code_lang else DEFAULT_MODEL_FAST
    if len(question) > 80 or any(w in question.lower() for w in ['compare', 'explain', 'difference', 'how does']):
        use_model = DEFAULT_MODEL

    try:
        response = client.chat.completions.create(
            model=use_model,
            messages=messages,
            temperature=0.1,
            max_tokens=1024,
            stream=True,
        )

        for chunk in response:
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as e:
        yield f"\n\n[Error during streaming: {str(e)}]"