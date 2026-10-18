"use client";

import React from "react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "./Providers";
import { 
  Sparkles, 
  Moon, 
  Sun, 
  LogOut, 
  ShieldCheck, 
  UserCheck, 
  Layers, 
  KeyRound,
  ChevronDown
} from "lucide-react";

interface NavbarProps {
  apis: string[];
  activeApi: string;
  onSelectApi: (api: string) => void;
  onRefreshApis: () => void;
}

export function Navbar({ apis, activeApi, onSelectApi, onRefreshApis }: NavbarProps) {
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();

  const userRole = ((session?.user as any)?.role || "DEVELOPER").toUpperCase();
  const userName = session?.user?.name || "Developer";
  const userEmail = session?.user?.email || "dev@docmind.ai";

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <ShieldCheck className="w-3 h-3 text-rose-400" />
            ADMIN
          </span>
        );
      case "DEVELOPER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <UserCheck className="w-3 h-3 text-indigo-400" />
            DEVELOPER
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            VIEWER
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                DocMind AI
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Auth.js v5
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Intelligent API QnA & Developer Agent
            </p>
          </div>
        </div>

        {/* Center: Active API Selector */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400 font-medium">Target API:</span>
            <select
              value={activeApi}
              onChange={(e) => onSelectApi(e.target.value)}
              className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer max-w-[180px] truncate"
            >
              <option value="" className="bg-slate-900 text-slate-400">
                -- Select API --
              </option>
              {apis.map((api) => (
                <option key={api} value={api} className="bg-slate-900 text-white">
                  {api}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: User Profile, Role Badge, Theme Toggle & Sign Out */}
        <div className="flex items-center gap-3">
          
          {/* Role Badge */}
          <div className="hidden sm:block">
            {getRoleBadge(userRole)}
          </div>

          {/* User Info */}
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-xs font-semibold text-slate-200">{userName}</span>
            <span className="text-[10px] text-slate-400">{userEmail}</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 transition-colors border border-slate-700/50"
            title="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </button>

          {/* Sign Out Button */}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all hover:scale-105 active:scale-95"
            title="Sign out of DocMind"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>

        </div>
      </div>
    </header>
  );
}
