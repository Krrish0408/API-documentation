import fitz  # PyMuPDF for reading PDFs
import yaml  # For reading YAML Swagger / OpenAPI files
import json  # For reading JSON Swagger / OpenAPI files
import os
import re
from typing import List, Tuple
from config import MAX_CHUNK_SIZE, CHUNK_OVERLAP


def split_text_into_chunks(text: str, chunk_size: int = MAX_CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """
    Takes a long text and splits it into smaller overlapping chunks.
    Preserves context across chunk boundaries.
    """
    if not text or not text.strip():
        return []

    chunks = []
    start = 0
    clean_text = text.strip()

    while start < len(clean_text):
        end = start + chunk_size
        chunk = clean_text[start:end]

        # Only keep chunks that have meaningful content
        if len(chunk.strip()) > 30:
            chunks.append(chunk.strip())

        # Move forward by chunk_size minus overlap
        if end >= len(clean_text):
            break
        start = max(start + 1, end - overlap)

    return chunks


def parse_pdf(file_path: str) -> List[str]:
    """
    Extract text from each page of a PDF document and split into chunks.
    """
    try:
        pdf_document = fitz.open(file_path)
    except Exception as e:
        raise ValueError(f"Failed to open PDF file: {str(e)}")

    all_text = []
    for page_number in range(len(pdf_document)):
        page = pdf_document[page_number]
        page_text = page.get_text()
        if page_text and page_text.strip():
            all_text.append(f"--- Page {page_number + 1} ---\n" + page_text.strip())

    pdf_document.close()
    combined = "\n\n".join(all_text)
    return split_text_into_chunks(combined)


def parse_markdown(file_path: str) -> List[str]:
    """
    Read a Markdown (.md) or plain text (.txt) file and split into chunks.
    """
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as file:
            text = file.read()
    except Exception as e:
        raise ValueError(f"Failed to read file: {str(e)}")

    return split_text_into_chunks(text)


def parse_swagger(file_path: str) -> List[str]:
    """
    Read an OpenAPI / Swagger file (YAML or JSON format).
    Extracts high-level API metadata and structured chunks for each endpoint.
    Supports both OpenAPI 3.x and Swagger 2.0 specifications.
    """
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as file:
            raw_content = file.read()
    except Exception as e:
        raise ValueError(f"Failed to read specification file: {str(e)}")

    # Try JSON parsing first, fallback to YAML
    api_data = None
    try:
        api_data = json.loads(raw_content)
    except Exception:
        try:
            api_data = yaml.safe_load(raw_content)
        except Exception as e:
            # If not valid JSON or YAML, fallback to plain text parsing
            return split_text_into_chunks(raw_content)

    if not isinstance(api_data, dict):
        return split_text_into_chunks(raw_content)

    chunks = []

    # 1. Extract API Info & Base URL
    api_info = api_data.get("info", {}) if isinstance(api_data.get("info"), dict) else {}
    title = api_info.get("title", "API Documentation")
    version = api_info.get("version", "1.0.0")
    description = api_info.get("description", "No description provided.")

    # Determine Base URL from OpenAPI 3.x servers or Swagger 2.0 host/basePath
    base_url = "Not specified"
    servers = api_data.get("servers")
    if isinstance(servers, list) and len(servers) > 0 and isinstance(servers[0], dict):
        base_url = servers[0].get("url", "Not specified")
    elif "host" in api_data:
        schemes = api_data.get("schemes", ["https"])
        scheme = schemes[0] if isinstance(schemes, list) and schemes else "https"
        host = api_data.get("host", "")
        base_path = api_data.get("basePath", "")
        base_url = f"{scheme}://{host}{base_path}"

    overview_chunk = f"""
API Title: {title}
Version: {version}
Base URL: {base_url}
Description: {description}
    """.strip()
    chunks.append(overview_chunk)

    # 2. Extract Security / Auth Schemes
    security_defs = api_data.get("components", {}).get("securitySchemes") or api_data.get("securityDefinitions")
    if isinstance(security_defs, dict) and security_defs:
        sec_chunk = f"API Security & Authentication Schemes:\n{json.dumps(security_defs, indent=2)}"
        chunks.append(sec_chunk)

    # 3. Extract Each Endpoint
    paths = api_data.get("paths", {})
    if isinstance(paths, dict):
        valid_methods = {"get", "post", "put", "delete", "patch", "options", "head"}
        for endpoint_path, methods_info in paths.items():
            if not isinstance(methods_info, dict):
                continue

            for http_method, details in methods_info.items():
                if http_method.lower() not in valid_methods or not isinstance(details, dict):
                    continue

                summary = details.get("summary", "No summary")
                desc = details.get("description", "No description")
                tags = details.get("tags", [])
                parameters = details.get("parameters", [])
                request_body = details.get("requestBody", {})
                responses = details.get("responses", {})
                response_codes = list(responses.keys()) if isinstance(responses, dict) else []

                endpoint_chunk = f"""
Endpoint: {http_method.upper()} {endpoint_path}
Summary: {summary}
Description: {desc}
Tags: {', '.join(tags) if isinstance(tags, list) else ''}
Parameters: {json.dumps(parameters, indent=2) if parameters else 'None'}
Request Body: {json.dumps(request_body, indent=2) if request_body else 'None'}
Responses: {json.dumps(response_codes, indent=2)}
                """.strip()

                chunks.append(endpoint_chunk)

    # Fallback to plain text splitting if no endpoint chunks were generated
    if not chunks or len(chunks) <= 1:
        return split_text_into_chunks(raw_content)

    return chunks


def detect_api_name_from_file(file_path: str, filename: str = "") -> Tuple[str, str]:
    """
    Attempts to detect a clean, human-readable API name from file content or filename.
    Returns (detected_name, source) e.g. ('stripe-api', 'spec') or ('github-api', 'filename').
    """
    file_ext = os.path.splitext(file_path)[1].lower()

    # 1. Try reading spec title for YAML/JSON
    if file_ext in [".yaml", ".yml", ".json"]:
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            data = None
            try:
                data = json.loads(content)
            except Exception:
                data = yaml.safe_load(content)

            if isinstance(data, dict):
                title = data.get("info", {}).get("title")
                if title and isinstance(title, str) and len(title.strip()) > 1:
                    clean = re.sub(r'[^a-zA-Z0-9\s-]', '', title).strip()
                    clean = re.sub(r'\s+', '-', clean).lower()
                    return clean[:40], "spec"
        except Exception:
            pass

    # 2. Try markdown / text first heading
    if file_ext in [".md", ".markdown", ".txt"]:
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                for _ in range(20):
                    line = f.readline()
                    if not line:
                        break
                    match = re.match(r'^#+\s+(.+)$', line.strip())
                    if match:
                        heading = match.group(1).strip()
                        clean = re.sub(r'[^a-zA-Z0-9\s-]', '', heading).strip()
                        clean = re.sub(r'\s+', '-', clean).lower()
                        return clean[:40], "heading"
        except Exception:
            pass

    # 3. Fallback to filename
    base_name = filename or os.path.basename(file_path)
    base_no_ext = os.path.splitext(base_name)[0]
    clean_fn = re.sub(r'[^a-zA-Z0-9-]', '-', base_no_ext)
    clean_fn = re.sub(r'-{2,}', '-', clean_fn).strip('-').lower()
    return clean_fn[:40] if clean_fn else "api-docs", "filename"


def parse_document(file_path: str) -> List[str]:
    """
    Main entry point for document parsing.
    Dispatches to appropriate format handler based on file extension.
    """
    file_extension = os.path.splitext(file_path)[1].lower()

    if file_extension == ".pdf":
        return parse_pdf(file_path)
    elif file_extension in [".md", ".markdown", ".txt"]:
        return parse_markdown(file_path)
    elif file_extension in [".yaml", ".yml", ".json"]:
        return parse_swagger(file_path)
    else:
        raise ValueError(
            f"File type '{file_extension}' is not supported. "
            f"Supported formats: PDF, Markdown (.md), Plain Text (.txt), OpenAPI/Swagger (.yaml, .yml, .json)"
        )