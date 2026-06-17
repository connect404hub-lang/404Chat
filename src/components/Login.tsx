"use client";

import React, { useState, useRef } from "react";
import { useChat } from "@/lib/chatStore";
import { compressImage } from "@/lib/imageCompressor";
import { Terminal, Upload, Cpu, Shield, Braces, Database, Bug, Radio, Lock } from "lucide-react";

// Predefined premium developer SVG avatars (rendered as React components)
export const PRESETS = [
  { id: "avatar-terminal", label: "Terminal", color: "#39ff14", icon: Terminal },
  { id: "avatar-cpu", label: "Kernel", color: "#00f0ff", icon: Cpu },
  { id: "avatar-shield", label: "SecOps", color: "#bd93f9", icon: Shield },
  { id: "avatar-braces", label: "FullStack", color: "#ff79c6", icon: Braces },
  { id: "avatar-database", label: "DBAdmin", color: "#ffb86c", icon: Database },
  { id: "avatar-bug", label: "QA_Debug", color: "#ff5555", icon: Bug },
];

export function AvatarRenderer({ avatar, size = 40, className = "" }: { avatar: string; size?: number; className?: string }) {
  // Check if base64 image
  if (avatar && avatar.startsWith("data:image/")) {
    return (
      <img
        src={avatar}
        alt="User Avatar"
        width={size}
        height={size}
        className={`rounded-full object-cover border border-slate-700 bg-slate-900 ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    );
  }

  // Find preset
  const preset = PRESETS.find((p) => p.id === avatar) || PRESETS[0];
  const IconComponent = preset.icon;

  // Map preset id to custom animation class
  let animationClass = "";
  if (preset.id === "avatar-terminal") animationClass = "animate-terminal-icon";
  else if (preset.id === "avatar-cpu") animationClass = "animate-cpu-icon";
  else if (preset.id === "avatar-shield") animationClass = "animate-shield-icon";
  else if (preset.id === "avatar-braces") animationClass = "animate-braces-icon";
  else if (preset.id === "avatar-database") animationClass = "animate-db-icon";
  else if (preset.id === "avatar-bug") animationClass = "animate-bug-icon";

  return (
    <div
      className={`rounded-full flex items-center justify-center border border-slate-700 select-none transition-all duration-300 hover:scale-105 ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: `${preset.color}15`,
        borderColor: preset.color,
        boxShadow: `0 0 10px ${preset.color}20`,
      }}
    >
      <IconComponent size={size * 0.55} className={animationClass} style={{ color: preset.color }} />
    </div>
  );
}

export default function Login() {
  const { login, signup } = useChat();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  
  // Inputs
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  
  // Avatar fields
  const [selectedAvatar, setSelectedAvatar] = useState(PRESETS[0].id);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  
  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [compressionLogs, setCompressionLogs] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleHandleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setHandle(clean);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCompressionLogs("Compiling image nodes...");
      const result = await compressImage(file, 400, 0.7);
      setCustomAvatar(result.base64);
      setSelectedAvatar("");
      const savedPercent = Math.round(((result.originalSize - result.compressedSize) / result.originalSize) * 100);
      setCompressionLogs(`Compressed: ${(result.originalSize / 1024).toFixed(1)}KB -> ${(result.compressedSize / 1024).toFixed(1)}KB (-${savedPercent}%)`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Image encoding compiled with errors: " + (err.message || "Unknown error"));
      setCompressionLogs("");
    }
  };

  const selectPreset = (presetId: string) => {
    setSelectedAvatar(presetId);
    setCustomAvatar(null);
    setCompressionLogs("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsSubmitting(true);

    if (!handle.trim()) {
      setErrorMsg("Developer Handle is required.");
      setIsSubmitting(false);
      return;
    }

    if (!password.trim()) {
      setErrorMsg("Password is required.");
      setIsSubmitting(false);
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      setIsSubmitting(false);
      return;
    }

    let success = false;
    if (mode === "signup") {
      if (!displayName.trim()) {
        setErrorMsg("Display Name is required.");
        setIsSubmitting(false);
        return;
      }
      const finalAvatar = customAvatar || selectedAvatar;
      success = await signup(handle, displayName, password, finalAvatar, mobileNumber || undefined);
    } else {
      success = await login(handle, password);
    }

    setIsSubmitting(false);
    if (!success) {
      // local error fallback details are alerted by the store directly
    }
  };

  return (
    <div className="login-matrix min-h-screen flex flex-col items-center justify-center bg-[#07080b] p-6 relative overflow-hidden font-mono text-slate-300">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 z-0 pointer-events-none" />

      <div className="w-full max-w-md bg-[#0d0e12] border border-cyan-500/30 rounded-xl p-8 relative z-10 shadow-[0_0_50px_rgba(0,240,255,0.1)] flex flex-col gap-6">
        
        {/* Terminal Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 select-none">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <span className="text-[10px] text-slate-500 tracking-wider font-bold uppercase">
            {mode === "signup" ? "SECURE_SIGNUP_SSH v3.0" : "SECURE_LOGIN_SSH v3.0"}
          </span>
          <div className="flex items-center gap-1.5 text-cyan-400">
            <Radio size={14} className="animate-pulse" />
            <span className="text-[9px] uppercase font-bold tracking-wider">SSH</span>
          </div>
        </div>

        {/* Branding Title */}
        <div className="text-center select-none my-1">
          <h1 className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 drop-shadow-[0_0_12px_rgba(0,240,255,0.2)]">
            DEV_CONNECT
          </h1>
          <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">Monospace Code Network</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Mode selection buttons */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-850 select-none">
            <button
              type="button"
              onClick={() => { setMode("signup"); setErrorMsg(""); }}
              className={`py-1.5 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer ${
                mode === "signup" 
                  ? "bg-[#111e15] border border-green-500/30 text-green-400" 
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => { setMode("login"); setErrorMsg(""); }}
              className={`py-1.5 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer ${
                mode === "login" 
                  ? "bg-[#111e15] border border-green-500/30 text-green-400" 
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Log In
            </button>
          </div>

          {/* Developer Handle */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex justify-between">
              <span>Developer Handle</span>
              <span className="text-[9px] text-slate-600">Regex: [a-z0-9_]</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-500 text-xs font-bold">@</span>
              <input
                type="text"
                value={handle}
                onChange={handleHandleChange}
                placeholder="sanjai_coder"
                maxLength={20}
                required
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-lg text-slate-200 outline-none transition-colors"
              />
            </div>
          </div>

          {mode === "signup" && (
            /* Display Name */
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Sanjai"
                maxLength={25}
                required
                className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-lg text-slate-200 outline-none transition-colors"
              />
            </div>
          )}

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">SSH Keyphrase (Password)</label>
            <div className="relative font-sans">
              <span className="absolute left-3 top-2 text-slate-500"><Lock size={12} /></span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-lg text-slate-200 outline-none transition-colors font-mono"
              />
            </div>
          </div>

          {mode === "signup" && (
            <>
              {/* Optional Mobile Number */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  Mobile Number (Optional)
                </label>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/[^0-9+]/g, ""))}
                  placeholder="+919876543210"
                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-lg text-slate-200 outline-none transition-colors"
                />
              </div>

              {/* Avatar Setup */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Choose Profile Photo</label>
                <div className="flex items-center gap-3 p-2 bg-slate-950 border border-slate-850 rounded-lg">
                  <AvatarRenderer avatar={customAvatar || selectedAvatar} size={50} />
                  <div className="flex-1 flex flex-col justify-center gap-0.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Live Preview</span>
                    {compressionLogs ? (
                      <span className="text-[9px] text-green-400 animate-pulse">{compressionLogs}</span>
                    ) : (
                      <span className="text-[9px] text-slate-600">Select preset or upload</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-1">
                  {PRESETS.map((p) => {
                    const isSelected = selectedAvatar === p.id && !customAvatar;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPreset(p.id)}
                        className="h-9 rounded-md flex items-center justify-center border transition-colors cursor-pointer bg-slate-900/40"
                        style={{ borderColor: isSelected ? p.color : "#1f2937" }}
                        title={p.label}
                      >
                        <p.icon size={15} style={{ color: isSelected ? p.color : "#64748b" }} />
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                    id="avatar-upload-initial"
                  />
                  <label
                    htmlFor="avatar-upload-initial"
                    className="flex items-center justify-center gap-1.5 py-1.5 px-3 border border-dashed border-slate-800 hover:border-cyan-400/50 rounded-lg text-[10px] text-slate-400 hover:text-cyan-400 cursor-pointer transition-colors"
                  >
                    <Upload size={12} />
                    <span>Upload Custom Image</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {errorMsg && (
            <div className="p-2.5 bg-red-950/20 border border-red-500/20 text-red-400 rounded-lg text-[10px] leading-relaxed">
              <span className="font-bold uppercase">[ERR]:</span> {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-[#07080b] font-bold text-[10px] uppercase tracking-widest rounded-lg cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-[#07080b] border-t-transparent rounded-full animate-spin" />
                <span>{mode === "signup" ? "COMPILING NODE..." : "CONNECTING LINK..."}</span>
              </>
            ) : (
              <span>{mode === "signup" ? "Establish Dev Connection" : "Verify Keyphrase & Connect"}</span>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
