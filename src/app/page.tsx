"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChatProvider, useChat } from "@/lib/chatStore";
import Login from "@/components/Login";
import Sidebar from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import { Terminal } from "lucide-react";

function ChatWorkspace() {
  const { 
    currentUser, isConnecting, alertMessage, closeAlert, confirmMessage, closeConfirm,
    theme, matrixRain, crtEffect
  } = useChat();

  const [compilingTheme, setCompilingTheme] = useState<string | null>(null);
  const [compileLogs, setCompileLogs] = useState<string[]>([]);
  const isFirstMount = useRef(true);

  useEffect(() => {
    // Avoid running compiler on initial load, only on actual theme switches
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (!theme) return;

    setCompilingTheme(theme);
    setCompileLogs([`$ npx compile-theme --target=${theme}`]);

    const logLines = [
      "Checking file layout directories... OK",
      "Reading config theme settings registry...",
      "Compiling syntax highlighted CSS tables...",
      "Linking variables tokens and glow styles...",
      "Spawning layout custom rendering engine...",
      `✓ Theme compiler completed. Theme '${theme.toUpperCase()}' active.`
    ];

    let idx = 0;
    const timer = setInterval(() => {
      if (idx < logLines.length) {
        setCompileLogs(prev => [...prev, logLines[idx]]);
        idx++;
      } else {
        clearInterval(timer);
        setTimeout(() => {
          setCompilingTheme(null);
        }, 350);
      }
    }, 150);

    return () => {
      clearInterval(timer);
    };
  }, [theme]);

  return (
    <>
      {/* 1. Initial page boot connection loading */}
      {isConnecting ? (
        <div className="min-h-screen bg-[#07080b] flex flex-col items-center justify-center font-mono text-cyan-400 select-none p-6 text-center">
          <div className="flex flex-col items-center gap-3 animate-pulse">
            <Terminal size={36} className="text-cyan-400 animate-spin" />
            <span className="text-xs uppercase tracking-widest font-bold">
              ESTABLISHING SECURE DEV_CONNECT SSH LINK...
            </span>
          </div>
        </div>
      ) : !currentUser ? (
        <Login />
      ) : (
        <div className="flex h-[100dvh] w-full overflow-hidden bg-theme-bg text-slate-300 font-mono relative">
          <Sidebar />
          <ChatArea />
        </div>
      )}

      {/* Global Animated System Custom Alert Modal */}
      {alertMessage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-backdrop-fade">
          <div 
            className={`w-full max-w-sm bg-[#0d0e12] border rounded-xl p-6 shadow-2xl animate-modal-slide ${
              alertMessage.type === "error" 
                ? "border-red-500/50 shadow-red-950/20" 
                : alertMessage.type === "success" 
                  ? "border-green-500/50 shadow-green-950/20" 
                  : "border-cyan-500/50 shadow-cyan-950/20"
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4 text-xs font-bold uppercase tracking-wider">
              <span className={
                alertMessage.type === "error" 
                  ? "text-red-500 animate-pulse" 
                  : alertMessage.type === "success" 
                    ? "text-green-400" 
                    : "text-cyan-400"
              }>
                {alertMessage.type === "error" ? "🛑 [SYSTEM_ERR]" : alertMessage.type === "success" ? "✓ [SYSTEM_SUCCESS]" : "ℹ [SYSTEM_MSG]"}
              </span>
            </div>

            {/* Modal Body */}
            <div className="flex flex-col gap-2 my-3">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest leading-snug">
                {alertMessage.title}
              </h3>
              <p className="text-[10px] text-slate-400 leading-relaxed font-mono whitespace-pre-wrap break-words">
                {alertMessage.message}
              </p>
            </div>

            {/* Modal Actions */}
            <button
              onClick={closeAlert}
              className={`w-full py-2 border rounded font-bold text-[10px] tracking-wider uppercase transition-all duration-200 active:scale-[0.98] cursor-pointer mt-2 ${
                alertMessage.type === "error" 
                  ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500" 
                  : alertMessage.type === "success" 
                    ? "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 hover:border-green-400" 
                    : "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400"
              }`}
            >
              [DISMISS_NOTIF]
            </button>
          </div>
        </div>
      )}

      {/* Global Confirmation Dialog Modal */}
      {confirmMessage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs select-none animate-backdrop-fade">
          <div className="w-full max-w-sm bg-[#0d0e12] border border-cyan-500/30 rounded-xl p-6 shadow-2xl animate-modal-slide shadow-cyan-950/20">
            {/* Modal Header */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <span>❓ [CONFIRM_ACTION]</span>
            </div>

            {/* Modal Body */}
            <div className="flex flex-col gap-2 my-3">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest leading-snug">
                {confirmMessage.title}
              </h3>
              <p className="text-[10px] text-slate-400 leading-relaxed font-mono whitespace-pre-wrap break-words">
                {confirmMessage.message}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  confirmMessage.onCancel?.();
                  closeConfirm();
                }}
                className="flex-1 py-2 border border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-slate-400 font-bold text-[10px] tracking-wider uppercase rounded transition-all duration-200 active:scale-[0.98] cursor-pointer"
              >
                [CANCEL]
              </button>
              <button
                onClick={() => {
                  confirmMessage.onConfirm();
                  closeConfirm();
                }}
                className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-[10px] tracking-wider uppercase rounded transition-all duration-200 active:scale-[0.98] cursor-pointer shadow-md"
              >
                [CONFIRM]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Developer themed visual enhancements overlays */}
      {crtEffect && <div className="crt-overlay crt-overlay-active" />}
      {matrixRain && <MatrixRainCanvas themeName={theme} />}
      {compilingTheme && <ThemeCompiler logs={compileLogs} themeName={compilingTheme} />}
    </>
  );
}

function MatrixRainCanvas({ themeName }: { themeName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let resizeTimer: number;
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resizeCanvas, 100);
    });

    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = Array(columns).fill(1);

    const themeColors: Record<string, string> = {
      dracula: "#ff79c6",
      onedark: "#61afef",
      matrix: "#00ff00",
      monokai: "#a6e22e",
      github: "#58a6ff",
      cyberpunk: "#00f0ff",
      synthwave: "#ff7edb",
    };

    const color = themeColors[themeName] || "#ff79c6";
    const charString = "01<>{}[]()+=;:/*!@#&%?$ abcdefghijklmnopqrstuvwxyz_";
    const chars = charString.split("");

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = color;
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillText(char, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 33);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [themeName]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none opacity-[0.06] z-[999] pointer-events-none" />;
}

function ThemeCompiler({ logs, themeName }: { logs: string[]; themeName: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="fixed inset-0 bg-[#07080b] z-[999999] flex flex-col justify-center items-start p-6 md:p-12 font-mono text-xs select-none">
      <div className="w-full max-w-xl mx-auto flex flex-col gap-3 bg-[#0d0e12] border border-cyan-500/30 rounded-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">IDE Theme Compiler</span>
          </div>
          <span className="text-[9px] text-green-400 font-bold bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20 uppercase animate-pulse">Running</span>
        </div>
        
        <div 
          ref={containerRef}
          className="flex flex-col gap-1 text-[11px] h-48 overflow-y-auto font-mono scrollbar-none py-1 select-text scroll-smooth"
        >
          {logs && logs.filter(Boolean).map((log, index) => (
            <div key={index} className="leading-relaxed whitespace-pre-wrap break-all">
              {log && log.startsWith("✓") ? (
                <span className="text-green-400 font-bold">{log}</span>
              ) : log && log.startsWith("$") ? (
                <span className="text-cyan-400">{log}</span>
              ) : (
                <span className="text-slate-400">{log}</span>
              )}
            </div>
          ))}
        </div>
        
        <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-[10px] text-slate-500">
          <span>GCC Compiler v9.2.0</span>
          <span>Progress: {logs ? Math.round((logs.length / 7) * 100) : 0}%</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ChatProvider>
      <ChatWorkspace />
    </ChatProvider>
  );
}
