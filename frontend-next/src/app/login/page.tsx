"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Sparkles, 
  ShieldCheck, 
  Terminal, 
  Eye, 
  Lock, 
  Mail, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@docmind.ai");
  const [password, setPassword] = useState("admin123");
  const [role, setRole] = useState("ADMIN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleQuickSelect = (selEmail: string, selPass: string, selRole: string) => {
    setEmail(selEmail);
    setPassword(selPass);
    setRole(selRole);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        role,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid credentials. Please try again.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-[#0b0f19]">
      
      {/* Ambient background glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="relative w-full max-w-md">
        
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 shadow-xl shadow-indigo-500/25 mb-3 border border-indigo-400/30">
            <Sparkles className="w-7 h-7 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            DocMind AI
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Enterprise API Intelligence & Developer Platform
          </p>
        </div>

        {/* Glassmorphism Auth Card */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-800/80">
          
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" />
              Sign In to Your Workspace
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select a quick preset role or enter your credentials
            </p>
          </div>

          {/* Quick Role Switcher Chips */}
          <div className="mb-6">
            <label className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-2">
              1-Click Role Presets
            </label>
            <div className="grid grid-cols-3 gap-2">
              
              {/* Admin Chip */}
              <button
                type="button"
                onClick={() => handleQuickSelect("admin@docmind.ai", "admin123", "ADMIN")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  role === "ADMIN"
                    ? "bg-rose-500/15 border-rose-500/50 text-rose-300 shadow-sm shadow-rose-500/20"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <ShieldCheck className={`w-4 h-4 mb-1 ${role === "ADMIN" ? "text-rose-400" : "text-slate-400"}`} />
                <span className="text-[11px] font-bold">Admin</span>
                <span className="text-[9px] opacity-75">Full Access</span>
              </button>

              {/* Developer Chip */}
              <button
                type="button"
                onClick={() => handleQuickSelect("dev@docmind.ai", "dev123", "DEVELOPER")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  role === "DEVELOPER"
                    ? "bg-indigo-500/15 border-indigo-500/50 text-indigo-300 shadow-sm shadow-indigo-500/20"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <Terminal className={`w-4 h-4 mb-1 ${role === "DEVELOPER" ? "text-indigo-400" : "text-slate-400"}`} />
                <span className="text-[11px] font-bold">Developer</span>
                <span className="text-[9px] opacity-75">QnA & SDKs</span>
              </button>

              {/* Viewer Chip */}
              <button
                type="button"
                onClick={() => handleQuickSelect("viewer@docmind.ai", "viewer123", "VIEWER")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  role === "VIEWER"
                    ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/20"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <Eye className={`w-4 h-4 mb-1 ${role === "VIEWER" ? "text-emerald-400" : "text-slate-400"}`} />
                <span className="text-[11px] font-bold">Viewer</span>
                <span className="text-[9px] opacity-75">Read Only</span>
              </button>

            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. user@docmind.ai"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Assigned Role (RBAC)
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
              >
                <option value="ADMIN">ADMIN — Full management & deletion rights</option>
                <option value="DEVELOPER">DEVELOPER — QnA, Code Gen, Live API testing</option>
                <option value="VIEWER">VIEWER — Documentation explorer & read-only</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Enter DocMind Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer security badge */}
          <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Protected with Auth.js v5 JWT Session Security</span>
          </div>

        </div>

      </div>
    </div>
  );
}
