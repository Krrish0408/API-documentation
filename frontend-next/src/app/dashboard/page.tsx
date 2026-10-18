"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { 
  MessageSquare, 
  UploadCloud, 
  Layers, 
  Code2, 
  Terminal, 
  ShieldCheck, 
  Send, 
  Mic, 
  MicOff, 
  Download, 
  Trash2, 
  RefreshCw, 
  Check, 
  Copy, 
  Sparkles, 
  Search, 
  Play, 
  FileText, 
  FileCode, 
  FileUp, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  Info,
  ExternalLink,
  ChevronRight,
  Sliders
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function DashboardPage() {
  const { data: session } = useSession();
  const userRole = ((session?.user as any)?.role || "DEVELOPER").toUpperCase();
  const userEmail = session?.user?.email || "dev@docmind.ai";

  // Navigation State
  const [activeTab, setActiveTab] = useState<"chat" | "upload" | "apis" | "generator" | "tester" | "security">("chat");

  // API Collections State
  const [apis, setApis] = useState<string[]>([]);
  const [activeApi, setActiveApi] = useState<string>("");

  // Chat State
  const [messages, setMessages] = useState<Array<{ role: string; content: string; timestamp?: string }>>([]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Upload State
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadApiName, setUploadApiName] = useState("");
  const [uploadStatus, setUploadStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [isDetectingName, setIsDetectingName] = useState(false);

  // Compare Mode State
  const [compareApi1, setCompareApi1] = useState("");
  const [compareApi2, setCompareApi2] = useState("");
  const [compareQuestion, setCompareQuestion] = useState("");
  const [compareResult, setCompareResult] = useState<{ ans1: string; ans2: string; tokens1?: number; tokens2?: number } | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // SDK & README Generator State
  const [genLanguage, setGenLanguage] = useState("all");
  const [generatedCode, setGeneratedCode] = useState("");
  const [generatedReadme, setGeneratedReadme] = useState("");
  const [isGeneratingSdk, setIsGeneratingSdk] = useState(false);
  const [isGeneratingReadme, setIsGeneratingReadme] = useState(false);
  const [sdkCopied, setSdkCopied] = useState(false);
  const [readmeCopied, setReadmeCopied] = useState(false);

  // API Tester State
  const [testMethod, setTestMethod] = useState("GET");
  const [testUrl, setTestUrl] = useState("");
  const [testHeaders, setTestHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
  const [testBody, setTestBody] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "info" | "success" | "error" }>({ show: false, message: "", type: "info" });

  const showToast = (message: string, type: "info" | "success" | "error" = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 4000);
  };

  // 1. Fetch available APIs on mount
  const fetchApis = async () => {
    try {
      const res = await fetch(`${API_BASE}/apis`);
      if (res.ok) {
        const data = await res.json();
        const apiList = data.apis || [];
        setApis(apiList);
        if (apiList.length > 0 && !activeApi) {
          setActiveApi(apiList[0]);
        }
      }
    } catch (e: any) {
      console.error("Failed to load APIs:", e);
    }
  };

  useEffect(() => {
    fetchApis();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingAnswer]);

  // 2. Chat QnA Submission (with SSE streaming fallback)
  const handleSendMessage = async (customText?: string) => {
    const question = customText || inputQuestion.trim();
    if (!question) return;
    if (!activeApi) {
      showToast("Please select or upload an API documentation first", "error");
      setActiveTab("apis");
      return;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const newHistory = [...messages, { role: "user", content: question, timestamp }];
    setMessages(newHistory);
    setInputQuestion("");
    setIsStreaming(true);
    setStreamingAnswer("");

    try {
      // Stream with SSE
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Email": userEmail,
          "X-User-Role": userRole,
        },
        body: JSON.stringify({
          question,
          api_name: activeApi,
          conversation_history: newHistory,
        }),
      });

      if (!response.ok) {
        // Fallback to synchronous endpoint
        const fallbackRes = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Email": userEmail,
            "X-User-Role": userRole,
          },
          body: JSON.stringify({
            question,
            api_name: activeApi,
            conversation_history: newHistory,
          }),
        });
        const data = await fallbackRes.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.answer || "No response received", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
        ]);
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.error) {
                  fullText += `\n\n❌ ${parsed.error}`;
                  setStreamingAnswer(fullText);
                } else if (parsed.text) {
                  fullText += parsed.text;
                  setStreamingAnswer(fullText);
                }
              } catch {
                // partial chunk
              }
            }
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: fullText || "Completed.", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ]);
      setStreamingAnswer("");
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Error connecting to server: ${err.message}`, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  // 3. Voice Input Toggle
  const toggleVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      showToast("Speech recognition is not supported in this browser.", "error");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
      showToast("🎙️ Listening... Speak now", "info");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputQuestion(transcript);
      setIsRecording(false);
      showToast(`Recognized: "${transcript}"`, "success");
    };

    recognition.onerror = () => {
      setIsRecording(false);
      showToast("Voice input failed or was cancelled.", "error");
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  // 4. Document Upload & Auto-Detect
  const handleAutoDetect = async () => {
    if (!uploadFiles.length) {
      showToast("Please select a file first", "error");
      return;
    }
    setIsDetectingName(true);
    const fd = new FormData();
    fd.append("file", uploadFiles[0]);

    try {
      const res = await fetch(`${API_BASE}/detect-name`, {
        method: "POST",
        headers: {
          "X-User-Email": userEmail,
          "X-User-Role": userRole,
        },
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.detected_name) {
        setUploadApiName(data.detected_name);
        showToast(`Auto-detected: "${data.detected_name}"`, "success");
      }
    } catch {
      showToast("Auto detection failed", "error");
    } finally {
      setIsDetectingName(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFiles.length) {
      showToast("Please select at least one documentation file", "error");
      return;
    }
    if (!uploadApiName.trim()) {
      showToast("Please enter an API Name", "error");
      return;
    }

    setUploadStatus({ type: "loading", message: "Parsing document & generating vector embeddings..." });

    const fd = new FormData();
    fd.append("file", uploadFiles[0]);
    fd.append("api_name", uploadApiName.trim());

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: {
          "X-User-Email": userEmail,
          "X-User-Role": userRole,
        },
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadStatus({ type: "success", message: `Indexed ${data.chunks_stored} semantic chunks into '${uploadApiName}'!` });
        showToast(`API '${uploadApiName}' indexed successfully!`, "success");
        fetchApis();
        setActiveApi(uploadApiName.trim());
        setUploadFiles([]);
      } else {
        setUploadStatus({ type: "error", message: data.detail || "Upload failed." });
        showToast(data.detail || "Upload failed", "error");
      }
    } catch (err: any) {
      setUploadStatus({ type: "error", message: `Server error: ${err.message}` });
    }
  };

  // 5. Delete API Collection (RBAC Admin Only)
  const handleDeleteApi = async (apiNameToDelete: string) => {
    if (userRole !== "ADMIN") {
      showToast("Permission Denied: Only ADMIN role can delete API collections.", "error");
      return;
    }
    if (!confirm(`Are you sure you want to delete collection '${apiNameToDelete}'?`)) return;

    try {
      const res = await fetch(`${API_BASE}/apis/${encodeURIComponent(apiNameToDelete)}`, {
        method: "DELETE",
        headers: {
          "X-User-Email": userEmail,
          "X-User-Role": userRole,
        },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`API '${apiNameToDelete}' deleted.`, "success");
        fetchApis();
        if (activeApi === apiNameToDelete) {
          setActiveApi(apis.filter((a) => a !== apiNameToDelete)[0] || "");
        }
      } else {
        showToast(data.detail || "Delete failed", "error");
      }
    } catch (e: any) {
      showToast(`Error: ${e.message}`, "error");
    }
  };

  // 6. Compare APIs Execution
  const handleCompareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compareQuestion.trim() || !compareApi1 || !compareApi2) {
      showToast("Please choose two APIs and type a comparison question", "error");
      return;
    }
    setIsComparing(true);
    setCompareResult(null);

    try {
      const res = await fetch(`${API_BASE}/compare`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Email": userEmail,
          "X-User-Role": userRole,
        },
        body: JSON.stringify({
          question: compareQuestion,
          api1: compareApi1,
          api2: compareApi2,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCompareResult({
          ans1: data.answer1,
          ans2: data.answer2,
          tokens1: data.tokens1,
          tokens2: data.tokens2,
        });
      } else {
        showToast(data.detail || "Comparison failed", "error");
      }
    } catch (e: any) {
      showToast(`Compare failed: ${e.message}`, "error");
    } finally {
      setIsComparing(false);
    }
  };

  // 7. SDK & README Generation
  const handleGenerateSdk = async () => {
    if (!activeApi) {
      showToast("Please select an active API first", "error");
      return;
    }
    setIsGeneratingSdk(true);
    setGeneratedCode("");

    try {
      const res = await fetch(`${API_BASE}/generate-sdk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Email": userEmail,
          "X-User-Role": userRole,
        },
        body: JSON.stringify({ api_name: activeApi, language: genLanguage }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedCode(data.code);
        showToast(`SDK generated successfully (${data.tokens_used} tokens)`, "success");
      } else {
        showToast(data.detail || "SDK generation failed", "error");
      }
    } catch (e: any) {
      showToast(`Error: ${e.message}`, "error");
    } finally {
      setIsGeneratingSdk(false);
    }
  };

  const handleDownloadSdk = async () => {
    if (!generatedCode) return;
    try {
      const res = await fetch(`${API_BASE}/download-sdk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_name: activeApi, language: genLanguage, code: generatedCode }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeApi}_sdk.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("SDK code downloaded!", "success");
    } catch (e: any) {
      showToast(`Download failed: ${e.message}`, "error");
    }
  };

  const handleGenerateReadme = async () => {
    if (!activeApi) {
      showToast("Please select an active API first", "error");
      return;
    }
    setIsGeneratingReadme(true);
    setGeneratedReadme("");

    try {
      const res = await fetch(`${API_BASE}/generate-readme`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Email": userEmail,
          "X-User-Role": userRole,
        },
        body: JSON.stringify({ api_name: activeApi }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedReadme(data.readme);
        showToast(`README.md generated successfully!`, "success");
      } else {
        showToast(data.detail || "README generation failed", "error");
      }
    } catch (e: any) {
      showToast(`Error: ${e.message}`, "error");
    } finally {
      setIsGeneratingReadme(false);
    }
  };

  const handleDownloadReadme = async () => {
    if (!generatedReadme) return;
    try {
      const res = await fetch(`${API_BASE}/download-readme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_name: activeApi, readme: generatedReadme }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeApi}_README.md`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("README.md downloaded!", "success");
    } catch (e: any) {
      showToast(`Download failed: ${e.message}`, "error");
    }
  };

  // 8. API Endpoint Tester Execution
  const handleRunApiTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testUrl.trim()) {
      showToast("Please enter an endpoint URL", "error");
      return;
    }

    let parsedHeaders = {};
    if (testHeaders.trim()) {
      try {
        parsedHeaders = JSON.parse(testHeaders);
      } catch {
        showToast("Headers must be valid JSON", "error");
        return;
      }
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(`${API_BASE}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: testMethod,
          url: testUrl,
          headers: parsedHeaders,
          body: testBody.trim() || null,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      showToast(`Request finished with status: ${data.status_code}`, data.success ? "success" : "error");
    } catch (e: any) {
      setTestResult({ success: false, status_code: 0, response_time_ms: 0, body: { error: e.message } });
    } finally {
      setIsTesting(false);
    }
  };

  // 9. PDF Export
  const handleExportPdf = async () => {
    if (!messages.length) {
      showToast("No chat messages to export", "error");
      return;
    }
    showToast("Generating PDF transcript...", "info");
    try {
      const res = await fetch(`${API_BASE}/export-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_name: activeApi || "General", messages }),
      });
      if (!res.ok) {
        showToast("PDF generation failed on server", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeApi || "DocMind"}_chat_export.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("PDF downloaded successfully!", "success");
    } catch (e: any) {
      showToast(`Error: ${e.message}`, "error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f19] text-slate-100 selection:bg-indigo-500 selection:text-white">
      
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-xs font-semibold animate-slide-up ${
          toast.type === "success" 
            ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/40" 
            : toast.type === "error" 
            ? "bg-rose-950/90 text-rose-300 border-rose-500/40" 
            : "bg-slate-900/90 text-indigo-300 border-indigo-500/40"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Info className="w-4 h-4 text-indigo-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        apis={apis}
        activeApi={activeApi}
        onSelectApi={(api) => {
          setActiveApi(api);
          showToast(`Active API set to '${api}'`, "info");
        }}
        onRefreshApis={fetchApis}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-6">
        
        {/* Left Sidebar Navigation */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-2">
          
          <div className="p-3 rounded-2xl glass-card border border-slate-800/80 flex flex-col gap-1.5 shadow-lg">
            
            <button
              onClick={() => setActiveTab("chat")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "chat"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4" />
                <span>AI Chat & QnA</span>
              </div>
              {messages.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900/60 text-indigo-200">
                  {messages.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("upload")}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "upload"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>Ingest Docs</span>
            </button>

            <button
              onClick={() => setActiveTab("apis")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "apis"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4" />
                <span>APIs & Compare</span>
              </div>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900/60 text-slate-300">
                {apis.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("generator")}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "generator"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>SDK / Docs Studio</span>
            </button>

            <button
              onClick={() => setActiveTab("tester")}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "tester"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Live API Tester</span>
            </button>

            <button
              onClick={() => setActiveTab("security")}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "security"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Security & RBAC</span>
            </button>

          </div>

          {/* Quick Stats Widget */}
          <div className="p-4 rounded-2xl glass-card border border-slate-800/80 hidden md:block">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              System Overview
            </h3>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Active Target:</span>
                <span className="font-semibold text-indigo-400 max-w-[110px] truncate">{activeApi || "None"}</span>
              </div>
              <div className="flex justify-between">
                <span>Indexed Collections:</span>
                <span className="font-semibold text-slate-200">{apis.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Vector Embeddings:</span>
                <span className="font-semibold text-emerald-400">all-MiniLM-L6-v2</span>
              </div>
              <div className="flex justify-between">
                <span>LLM Engine:</span>
                <span className="font-semibold text-purple-400">Llama 3.3 70B</span>
              </div>
            </div>
          </div>

        </aside>

        {/* Right Content Panels */}
        <main className="flex-1 min-w-0 flex flex-col rounded-2xl glass-card border border-slate-800/80 shadow-2xl overflow-hidden min-h-[600px]">
          
          {/* TAB 1: AI CHAT */}
          {activeTab === "chat" && (
            <div className="flex-1 flex flex-col h-full">
              
              {/* Chat Sub-Header */}
              <div className="p-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-slate-950/40">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">Active Documentation:</span>
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {activeApi || "No API Selected"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs">
                    {["all", "python", "javascript", "java", "curl"].map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setLangFilter(lang)}
                        className={`px-2 py-1 rounded-md capitalize font-medium transition-colors ${
                          langFilter === lang ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {lang === "all" ? "All" : lang === "javascript" ? "JS" : lang}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleExportPdf}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
                    title="Export Chat to PDF"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      if (confirm("Clear chat conversation?")) setMessages([]);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-colors border border-slate-700"
                    title="Clear Conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Chat Messages List */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 max-h-[520px]">
                {messages.length === 0 && !streamingAnswer && (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
                      <Sparkles className="w-8 h-8 animate-pulse" />
                    </div>
                    <h3 className="text-base font-bold text-slate-200">
                      Ask Any Question About {activeApi || "Your APIs"}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mt-1 mb-6">
                      DocMind understands natural English and Hinglish queries, syntax-highlights code examples, and explains endpoints in detail.
                    </p>

                    {/* Quick Query Chips */}
                    <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg">
                      {[
                        "How do I authenticate with Bearer token?",
                        "List all GET endpoints available",
                        "Show a runnable Python code example",
                        "How to handle 401 & 429 error rate limits?",
                        "JavaScript mein fetch example dikhao",
                      ].map((chip) => (
                        <button
                          key={chip}
                          onClick={() => handleSendMessage(chip)}
                          className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-indigo-600/20 border border-slate-800 hover:border-indigo-500/40 text-xs text-slate-300 transition-all hover:scale-105"
                        >
                          ⚡ {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rendered Messages */}
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-semibold text-slate-400">
                        {msg.role === "user" ? "You" : "DocMind Assistant"}
                      </span>
                      {msg.timestamp && (
                        <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                      )}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20"
                          : "bg-slate-900/90 text-slate-200 border border-slate-800/80 rounded-tl-none whitespace-pre-wrap font-sans"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Live SSE Streaming Output */}
                {isStreaming && (
                  <div className="flex flex-col items-start animate-fade-in">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-semibold text-indigo-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                        DocMind AI is typing...
                      </span>
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-none px-4 py-3 bg-slate-900/90 text-slate-200 border border-indigo-500/30 whitespace-pre-wrap text-sm leading-relaxed">
                      {streamingAnswer || "Searching knowledge vector base..."}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 sm:p-4 border-t border-slate-800/80 bg-slate-950/60">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputQuestion}
                    onChange={(e) => setInputQuestion(e.target.value)}
                    placeholder={
                      isRecording
                        ? "Listening to voice input..."
                        : "Ask anything about endpoints, parameters, authentication, code..."
                    }
                    className="flex-1 px-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />

                  {/* Mic Voice Input Button */}
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    className={`p-2.5 rounded-xl border transition-all ${
                      isRecording
                        ? "bg-rose-500 text-white border-rose-400 animate-pulse"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
                    }`}
                    title="Voice Input (Speech-to-Text)"
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={isStreaming || !inputQuestion.trim()}
                    className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold shadow-md shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </form>
              </div>

            </div>
          )}

          {/* TAB 2: INGEST / UPLOAD DOCS */}
          {activeTab === "upload" && (
            <div className="p-6 sm:p-8 max-w-2xl mx-auto w-full space-y-6">
              
              <div>
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-indigo-400" />
                  Ingest API Documentation
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Upload PDF manuals, OpenAPI YAML/JSON, Markdown, or text files to index into ChromaDB.
                </p>
              </div>

              {/* RBAC Notice */}
              {userRole === "VIEWER" && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Notice: You are currently signed in with <strong>VIEWER</strong> role. Uploads and deletions require <strong>ADMIN</strong> privileges.</span>
                </div>
              )}

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                
                {/* Drag and Drop Box */}
                <div
                  onClick={() => document.getElementById("file-upload")?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-900/30 hover:bg-slate-900/60"
                >
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    accept=".pdf,.yaml,.yml,.json,.md,.markdown,.txt"
                    onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">
                    Click to browse or drag & drop files here
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports OpenAPI 3.x, Swagger 2.0 (YAML/JSON), PDF API manuals, Markdown & TXT
                  </p>

                  {/* Selected files preview */}
                  {uploadFiles.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                      {uploadFiles.map((f, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          📄 {f.name} ({Math.round(f.size / 1024)} KB)
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* API Name Input & Auto Detect */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    API Identifier Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={uploadApiName}
                      onChange={(e) => setUploadApiName(e.target.value)}
                      placeholder="e.g. stripe-api, github-api, discord-v10"
                      className="flex-1 px-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleAutoDetect}
                      disabled={isDetectingName || !uploadFiles.length}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 disabled:opacity-40 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>{isDetectingName ? "Detecting..." : "Auto-Detect"}</span>
                    </button>
                  </div>
                </div>

                {/* Status indicator */}
                {uploadStatus.type !== "idle" && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    uploadStatus.type === "success" 
                      ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                      : uploadStatus.type === "error"
                      ? "bg-rose-950/40 border-rose-500/30 text-rose-300"
                      : "bg-indigo-950/40 border-indigo-500/30 text-indigo-300"
                  }`}>
                    {uploadStatus.type === "loading" && <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>}
                    {uploadStatus.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {uploadStatus.type === "error" && <AlertCircle className="w-4 h-4 text-rose-400" />}
                    <span>{uploadStatus.message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={uploadStatus.type === "loading" || !uploadFiles.length || !uploadApiName.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 disabled:opacity-40 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload & Index Knowledge Vector</span>
                </button>

              </form>

            </div>
          )}

          {/* TAB 3: APIS & COMPARISON */}
          {activeTab === "apis" && (
            <div className="p-6 sm:p-8 space-y-8">
              
              {/* Section 1: Active Collections */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-400" />
                      Indexed API Collections ({apis.length})
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Manage indexed ChromaDB vector collections or select the active API.
                    </p>
                  </div>
                  <button
                    onClick={fetchApis}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    title="Refresh API List"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {apis.map((apiName) => (
                    <div
                      key={apiName}
                      onClick={() => {
                        setActiveApi(apiName);
                        showToast(`Active API set to '${apiName}'`, "info");
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        activeApi === apiName
                          ? "bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/10"
                          : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm truncate">{apiName}</span>
                        {activeApi === apiName && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-500 text-white">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        <span className="text-[11px] text-slate-400">Vector Collection</span>
                        {userRole === "ADMIN" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteApi(apiName);
                            }}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                            title="Delete Collection"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Side-by-Side API Comparison */}
              <div className="pt-6 border-t border-slate-800/80">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  Side-by-Side API Comparison Studio
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Query two different APIs concurrently to evaluate endpoints, response structures, and parameters.
                </p>

                <form onSubmit={handleCompareSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">First API</label>
                      <select
                        value={compareApi1}
                        onChange={(e) => setCompareApi1(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">-- Choose API 1 --</option>
                        {apis.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">Second API</label>
                      <select
                        value={compareApi2}
                        onChange={(e) => setCompareApi2(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">-- Choose API 2 --</option>
                        {apis.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">Comparison Query</label>
                    <input
                      type="text"
                      value={compareQuestion}
                      onChange={(e) => setCompareQuestion(e.target.value)}
                      placeholder="e.g. How does authentication work? or What are the user endpoints?"
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isComparing || !compareApi1 || !compareApi2 || !compareQuestion.trim()}
                    className="py-2.5 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 disabled:opacity-40 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isComparing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                        <span>Evaluating Dual LLM Queries...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Run Concurrent Comparison</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Compare Results Output */}
                {compareResult && (
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                    
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-indigo-400">{compareApi1}</span>
                        <span className="text-[10px] text-slate-500">{compareResult.tokens1 || 0} tokens</span>
                      </div>
                      <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {compareResult.ans1}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-purple-500/30">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-purple-400">{compareApi2}</span>
                        <span className="text-[10px] text-slate-500">{compareResult.tokens2 || 0} tokens</span>
                      </div>
                      <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {compareResult.ans2}
                      </div>
                    </div>

                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: SDK & README STUDIO */}
          {activeTab === "generator" && (
            <div className="p-6 sm:p-8 space-y-8">
              
              <div>
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-indigo-400" />
                  SDK & Documentation Studio
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Synthesize production-ready client code libraries and comprehensive GitHub README files.
                </p>
              </div>

              {/* Sub-section 1: SDK Code Generator */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Generate Client SDK</h3>
                    <p className="text-[11px] text-slate-400">Target API: <strong>{activeApi || "None"}</strong></p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={genLanguage}
                      onChange={(e) => setGenLanguage(e.target.value)}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="all">All Languages (Python, JS, cURL)</option>
                      <option value="python">Python Client (requests/httpx)</option>
                      <option value="javascript">JavaScript / Node.js (fetch)</option>
                      <option value="java">Java SDK (HttpClient)</option>
                      <option value="curl">cURL Commands</option>
                    </select>

                    <button
                      onClick={handleGenerateSdk}
                      disabled={isGeneratingSdk || !activeApi}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isGeneratingSdk ? "Generating..." : "⚡ Generate SDK"}
                    </button>
                  </div>
                </div>

                {generatedCode && (
                  <div className="space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Generated Code Output:</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedCode);
                            setSdkCopied(true);
                            setTimeout(() => setSdkCopied(false), 2000);
                            showToast("Code copied to clipboard!", "success");
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1"
                        >
                          {sdkCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{sdkCopied ? "Copied" : "Copy"}</span>
                        </button>
                        <button
                          onClick={handleDownloadSdk}
                          className="px-2 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download File</span>
                        </button>
                      </div>
                    </div>
                    <pre className="text-xs text-slate-200 max-h-72 overflow-y-auto">
                      <code>{generatedCode}</code>
                    </pre>
                  </div>
                )}
              </div>

              {/* Sub-section 2: README Documentation Generator */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Generate README.md</h3>
                    <p className="text-[11px] text-slate-400">Complete with Auth, Endpoints table, Error codes & Quickstart</p>
                  </div>

                  <button
                    onClick={handleGenerateReadme}
                    disabled={isGeneratingReadme || !activeApi}
                    className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {isGeneratingReadme ? "Generating..." : "📖 Generate README.md"}
                  </button>
                </div>

                {generatedReadme && (
                  <div className="space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Generated Markdown Output:</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedReadme);
                            setReadmeCopied(true);
                            setTimeout(() => setReadmeCopied(false), 2000);
                            showToast("README copied to clipboard!", "success");
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1"
                        >
                          {readmeCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{readmeCopied ? "Copied" : "Copy"}</span>
                        </button>
                        <button
                          onClick={handleDownloadReadme}
                          className="px-2 py-1 rounded bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/30 text-[11px] font-semibold flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download .md</span>
                        </button>
                      </div>
                    </div>
                    <pre className="text-xs text-slate-200 max-h-72 overflow-y-auto">
                      <code>{generatedReadme}</code>
                    </pre>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 5: LIVE API TESTER */}
          {activeTab === "tester" && (
            <div className="p-6 sm:p-8 space-y-6">
              
              <div>
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-indigo-400" />
                  Live Interactive HTTP Tester
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Send real requests to endpoints and inspect status codes, headers, and payloads in real time.
                </p>
              </div>

              <form onSubmit={handleRunApiTest} className="space-y-4">
                
                {/* Method & URL Input */}
                <div className="flex gap-2">
                  <select
                    value={testMethod}
                    onChange={(e) => setTestMethod(e.target.value)}
                    className="w-28 px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-indigo-400 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>

                  <input
                    type="url"
                    value={testUrl}
                    onChange={(e) => setTestUrl(e.target.value)}
                    placeholder="https://api.example.com/v1/users"
                    className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />

                  <button
                    type="submit"
                    disabled={isTesting || !testUrl.trim()}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 disabled:opacity-40 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {isTesting ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>Run</span>
                  </button>
                </div>

                {/* Headers & Body Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Request Headers (JSON)
                    </label>
                    <textarea
                      value={testHeaders}
                      onChange={(e) => setTestHeaders(e.target.value)}
                      rows={5}
                      className="w-full p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Request Body (JSON)
                    </label>
                    <textarea
                      value={testBody}
                      onChange={(e) => setTestBody(e.target.value)}
                      rows={5}
                      placeholder='{\n  "name": "Alex",\n  "status": "active"\n}'
                      className="w-full p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>
                </div>

              </form>

              {/* Response Viewer */}
              {testResult && (
                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        testResult.status_code >= 200 && testResult.status_code < 300
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}>
                        HTTP {testResult.status_code}
                      </span>
                      <span className="text-xs text-slate-400">
                        {testResult.response_time_ms} ms
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">Execution Complete</span>
                  </div>

                  <pre className="text-xs text-slate-200 max-h-72 overflow-y-auto">
                    <code>{JSON.stringify(testResult.body, null, 2)}</code>
                  </pre>
                </div>
              )}

            </div>
          )}

          {/* TAB 6: SECURITY & RBAC MATRIX */}
          {activeTab === "security" && (
            <div className="p-6 sm:p-8 space-y-6">
              
              <div>
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  Security, Authentication & Role Matrix
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Auth.js v5 JWT Session status and Role-Based Access Control (RBAC) permissions.
                </p>
              </div>

              {/* Active Session Card */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Active User Session (Auth.js)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block">Authenticated User:</span>
                    <span className="font-semibold text-slate-200">{session?.user?.name || "Developer"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Email Address:</span>
                    <span className="font-semibold text-slate-200">{userEmail}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Assigned Role:</span>
                    <span className="font-bold text-indigo-400">{userRole}</span>
                  </div>
                </div>
              </div>

              {/* RBAC Matrix Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Role-Based Access Control (RBAC) Matrix
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3">Feature / Capability</th>
                        <th className="p-3 text-center">👑 ADMIN</th>
                        <th className="p-3 text-center">💻 DEVELOPER</th>
                        <th className="p-3 text-center">👁️ VIEWER</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                      <tr>
                        <td className="p-3 font-medium text-white">Ask Questions & AI Chat Streaming</td>
                        <td className="p-3 text-center text-emerald-400">✓ Allowed</td>
                        <td className="p-3 text-center text-emerald-400">✓ Allowed</td>
                        <td className="p-3 text-center text-emerald-400">✓ Allowed</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium text-white">Generate SDK Code & README.md</td>
                        <td className="p-3 text-center text-emerald-400">✓ Allowed</td>
                        <td className="p-3 text-center text-emerald-400">✓ Allowed</td>
                        <td className="p-3 text-center text-slate-500">— Restricted</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium text-white">Side-by-Side Dual API Comparison</td>
                        <td className="p-3 text-center text-emerald-400">✓ Allowed</td>
                        <td className="p-3 text-center text-emerald-400">✓ Allowed</td>
                        <td className="p-3 text-center text-slate-500">— Restricted</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium text-white">Live HTTP Endpoint Testing Playground</td>
                        <td className="p-3 text-center text-emerald-400">✓ Allowed</td>
                        <td className="p-3 text-center text-emerald-400">✓ Allowed</td>
                        <td className="p-3 text-center text-slate-500">— Restricted</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium text-white">Ingest & Upload New Documentation</td>
                        <td className="p-3 text-center text-emerald-400 font-bold">✓ Full Access</td>
                        <td className="p-3 text-center text-slate-500">— Restricted</td>
                        <td className="p-3 text-center text-slate-500">— Restricted</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium text-white">Delete ChromaDB Vector Collections</td>
                        <td className="p-3 text-center text-emerald-400 font-bold">✓ Full Access</td>
                        <td className="p-3 text-center text-slate-500">— Restricted</td>
                        <td className="p-3 text-center text-slate-500">— Restricted</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

    </div>
  );
}
