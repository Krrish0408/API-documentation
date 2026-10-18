// ╔══════════════════════════════════════════════════════════════════╗
// ║  app.js — DocMind AI — Complete Frontend Logic & Auth          ║
// ║  Features: JWT Auth · RBAC · Streaming · Voice · PDF Export    ║
// ╚══════════════════════════════════════════════════════════════════╝

// ─── Auth State ─────────────────────────────────────────────────────────────
let authToken    = localStorage.getItem('docmind_token') || '';
let currentUser  = null;
let userPerms    = null;

// ─── App State ──────────────────────────────────────────────────────────────
let streamingEnabled  = true;
let isRecording       = false;
let recognition       = null;
let chatHistory       = [];
let suggestionsTimer  = null;

const SUGGESTION_BANK = {
  auth:        ["How do I authenticate?", "What auth methods are supported?", "How to use API key?", "OAuth flow explanation"],
  error:       ["What does 401 error mean?", "How to handle rate limiting?", "Common error codes", "Retry strategy recommendations"],
  endpoint:    ["What endpoints are available?", "What is the base URL?", "How to call the search endpoint?", "List all GET endpoints"],
  param:       ["What parameters are required?", "What is the response format?", "Query parameters schema", "Request body structure"],
  limit:       ["What are the rate limits?", "How many requests per minute?", "Is there a free tier?", "Request quota details"],
  example:     ["Show me an example request", "Give me a curl example", "Postman collection format", "Sample code in Python"],
  default:     ["What can this API do?", "How do I get started?", "What is the authentication method?", "Show available endpoints"],
};

// ─── Central Authenticated Fetch ────────────────────────────────────────────
async function authFetch(url, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  if (authToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  const opts = { ...options, headers };
  
  const res = await fetch(url, opts);
  if (res.status === 401) {
    currentUser = null;
    authToken = '';
    localStorage.removeItem('docmind_token');
    if (typeof updateAuthUI === 'function') updateAuthUI();
    if (typeof openAuthModal === 'function') openAuthModal('login');
    throw new Error('Authentication required');
  }
  return res;
}

// ─── Verify Session ─────────────────────────────────────────────────────────
async function verifySession() {
  if (!authToken) {
    if (typeof updateAuthUI === 'function') updateAuthUI();
    return;
  }
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      userPerms   = data.permissions;
      if (typeof updateAuthUI === 'function') updateAuthUI();
      loadApiList();
    } else {
      currentUser = null;
      authToken = '';
      localStorage.removeItem('docmind_token');
      if (typeof updateAuthUI === 'function') updateAuthUI();
    }
  } catch (err) {
    console.error('Session verification failed:', err);
  }
}

// ─── Init ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  verifySession();
  loadApiList();
  initStreamToggle();
  initVoiceInput();
  initSmartSuggestions();
  initUploadForm();
  initAutoDetect();
  initTesterTab();
  initPdfExport();
});

// ─── 1. API List ────────────────────────────────────────────────────────────
async function loadApiList() {
  try {
    const res  = await fetch("/api/apis");
    const data = await res.json();
    const sel  = document.getElementById("api-select");
    if (!sel) return;

    sel.innerHTML = '<option value="">— Select an API —</option>';
    (data.apis || []).forEach(name => {
      const opt   = document.createElement("option");
      opt.value   = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error("API list load failed:", err);
  }
}

// ─── 2. Streaming Toggle ────────────────────────────────────────────────────
function initStreamToggle() {
  const toggle = document.getElementById("stream-toggle");
  if (!toggle) return;
  toggle.checked = streamingEnabled;
  toggle.addEventListener("change", (e) => {
    streamingEnabled = e.target.checked;
    showToast(streamingEnabled ? "⚡ Streaming Enabled" : "📦 Batch Mode Enabled");
  });
}

// ─── 3. Voice Input ─────────────────────────────────────────────────────────
function initVoiceInput() {
  const micBtn = document.getElementById("mic-btn");
  if (!micBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.title = "Speech Recognition not supported in this browser";
    micBtn.style.opacity = "0.3";
    micBtn.style.cursor  = "not-allowed";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous     = false;
  recognition.interimResults = true;
  recognition.lang           = navigator.language || "en-US";

  recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add("recording");
    showToast("🎤 Listening...");
  };

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(r => r[0].transcript)
      .join("");
    const input = document.getElementById("user-input");
    if (input) input.value = transcript;
  };

  recognition.onerror = (event) => {
    console.error("Speech Recognition Error:", event.error);
    isRecording = false;
    micBtn.classList.remove("recording");
    showToast("⚠️ Voice error: " + event.error);
  };

  recognition.onend = () => {
    isRecording = false;
    micBtn.classList.remove("recording");
  };

  micBtn.addEventListener("click", () => {
    if (!recognition) return;
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
}

// ─── 4. Smart Suggestions ───────────────────────────────────────────────────
function initSmartSuggestions() {
  const input = document.getElementById("user-input");
  const box   = document.getElementById("suggestions-box");
  if (!input || !box) return;

  input.addEventListener("input", (e) => {
    clearTimeout(suggestionsTimer);
    const query = e.target.value.trim();

    if (query.length < 2) {
      box.style.display = "none";
      return;
    }

    suggestionsTimer = setTimeout(() => {
      renderSuggestions(query, box, input);
    }, 250);
  });

  document.addEventListener("click", (e) => {
    if (!box.contains(e.target) && e.target !== input) {
      box.style.display = "none";
    }
  });
}

function renderSuggestions(query, box, input) {
  const lower = query.toLowerCase();
  let matches = [];

  for (const [category, list] of Object.entries(SUGGESTION_BANK)) {
    if (lower.includes(category) || category === "default") {
      matches.push(...list);
    }
  }

  const filtered = matches.filter(s =>
    s.toLowerCase().includes(lower) || lower.length < 4
  ).slice(0, 4);

  if (filtered.length === 0) {
    box.style.display = "none";
    return;
  }

  box.innerHTML = filtered.map(s => `
    <div class="suggestion-item" data-suggestion="${encodeURIComponent(s)}">
      <span class="suggestion-icon">💡</span>
      <span class="suggestion-text">${escapeHtml(s)}</span>
    </div>
  `).join("");

  box.querySelectorAll(".suggestion-item").forEach(item => {
    item.addEventListener("click", () => {
      input.value = decodeURIComponent(item.dataset.suggestion);
      box.style.display = "none";
      input.focus();
    });
  });

  box.style.display = "block";
}

// ─── 5. Auto Detect API Name ────────────────────────────────────────────────
function initAutoDetect() {
  const fileInput = document.getElementById("doc-file");
  const nameInput = document.getElementById("api-name");
  const detectBtn = document.getElementById("detect-name-btn");
  if (!fileInput || !nameInput) return;

  fileInput.addEventListener("change", async () => {
    if (!fileInput.files || fileInput.files.length === 0) return;
    if (nameInput.value.trim() !== "") return;

    await triggerAutoDetect(fileInput.files[0], nameInput);
  });

  if (detectBtn) {
    detectBtn.addEventListener("click", async () => {
      if (!fileInput.files || fileInput.files.length === 0) {
        showToast("⚠️ Select a file first");
        return;
      }
      await triggerAutoDetect(fileInput.files[0], nameInput);
    });
  }
}

async function triggerAutoDetect(file, nameInput) {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res  = await authFetch("/api/detect-name", { method: "POST", body: formData });
    const data = await res.json();
    if (data.detected_name) {
      nameInput.value = data.detected_name;
      showToast(`✨ Auto-detected: "${data.detected_name}" (${data.source})`);
    }
  } catch (err) {
    const base = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    nameInput.value = base;
  }
}

// ─── 6. Upload Form ─────────────────────────────────────────────────────────
function initUploadForm() {
  const form = document.getElementById("upload-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (currentUser && currentUser.role !== 'ADMIN') {
      showToast('🔒 Admin role required to upload documentation');
      return;
    }
    const fileInput = document.getElementById("doc-file");
    const nameInput = document.getElementById("api-name");
    const uploadBtn = document.getElementById("upload-btn");
    const statusEl  = document.getElementById("upload-status");

    if (!fileInput.files[0]) {
      showToast("⚠️ Please select a file");
      return;
    }
    if (!nameInput.value.trim()) {
      showToast("⚠️ Please enter an API name");
      return;
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("api_name", nameInput.value.trim());

    uploadBtn.disabled    = true;
    uploadBtn.textContent = "⏳ Uploading & Indexing...";
    if (statusEl) statusEl.textContent = "Parsing document and generating vector embeddings...";

    try {
      const res  = await authFetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        showToast(`✅ ${data.message} (${data.chunks_stored} chunks)`);
        form.reset();
        await loadApiList();
        if (statusEl) statusEl.textContent = `Indexed ${data.chunks_stored} chunks for "${data.api_name}"`;
      } else {
        showToast(`❌ Error: ${data.detail || "Upload failed"}`);
        if (statusEl) statusEl.textContent = `Error: ${data.detail}`;
      }
    } catch (err) {
      showToast("❌ Network error during upload");
      if (statusEl) statusEl.textContent = "Network error";
    } finally {
      uploadBtn.disabled    = false;
      uploadBtn.textContent = "📤 Upload & Process";
    }
  });
}

// ─── 7. Live API Tester Tab ─────────────────────────────────────────────────
function initTesterTab() {
  const runBtn = document.getElementById("run-test-btn");
  if (!runBtn) return;

  runBtn.addEventListener("click", async () => {
    if (currentUser && currentUser.role === 'VIEWER') {
      showToast('🔒 Developer or Admin role required for API testing');
      return;
    }
    const method  = document.getElementById("test-method")?.value || "GET";
    const url     = document.getElementById("test-url")?.value?.trim();
    const headers = document.getElementById("test-headers")?.value?.trim();
    const body    = document.getElementById("test-body")?.value?.trim();
    const output  = document.getElementById("test-output");

    if (!url) {
      showToast("⚠️ Enter an endpoint URL");
      return;
    }

    let parsedHeaders = {};
    if (headers) {
      try { parsedHeaders = JSON.parse(headers); }
      catch { showToast("⚠️ Headers must be valid JSON"); return; }
    }

    runBtn.disabled    = true;
    runBtn.textContent = "⏳ Running...";
    if (output) output.textContent = "Sending HTTP request...";

    try {
      const res = await authFetch("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, method, headers: parsedHeaders, body: body || null })
      });
      const data = await res.json();
      if (output) {
        output.textContent = JSON.stringify(data, null, 2);
      }
      showToast(`Status: ${data.status_code} (${data.response_time_ms}ms)`);
    } catch (err) {
      if (output) output.textContent = "Error: " + err.message;
    } finally {
      runBtn.disabled    = false;
      runBtn.textContent = "▶ Run Request";
    }
  });
}

// ─── 8. PDF Export ──────────────────────────────────────────────────────────
function initPdfExport() {
  const exportBtn = document.getElementById("export-pdf-btn");
  if (!exportBtn) return;

  exportBtn.addEventListener("click", async () => {
    const apiSelect = document.getElementById("api-select");
    const apiName   = apiSelect?.value;

    if (!apiName) {
      showToast("⚠️ Select an API first");
      return;
    }
    if (chatHistory.length === 0) {
      showToast("⚠️ No messages to export");
      return;
    }

    showToast("⏳ Generating PDF report...");
    try {
      const res = await authFetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_name: apiName, messages: chatHistory })
      });

      if (!res.ok) {
        const err = await res.json();
        showToast("❌ " + (err.detail || "PDF export failed"));
        return;
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${apiName}_DocMind_Chat.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("📕 PDF downloaded!");
    } catch (err) {
      showToast("❌ Network error during PDF export");
    }
  });
}

// ─── Utilities ──────────────────────────────────────────────────────────────
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(message) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = "1";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = "0"; }, 3000);
}