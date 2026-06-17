"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChat, ChatType } from "@/lib/chatStore";
import { AvatarRenderer, PRESETS } from "./Login";
import { compressImage, downloadBase64Image } from "@/lib/imageCompressor";
import { 
  Plus, MessageSquare, Users, LogOut, Search, X,
  Edit2, Terminal, ChevronRight, Upload, Download
} from "lucide-react";
import StoriesBar from "./StoriesBar";
import CreateStoryModal from "./CreateStoryModal";
import StoryViewer from "./StoryViewer";

export default function Sidebar() {
  const { 
    currentUser, users, chats, activeChatId, selectChat, 
    createPrivateChat, createGroupChat, updateProfile, logout, isLocalOnly,
    typingStates, isLoadingChats, showAlert, showConfirm, stories, refreshStories, refreshChats, refreshUsers,
    theme, setTheme, matrixRain, setMatrixRain, crtEffect, setCrtEffect, gitMergeAnim, setGitMergeAnim
  } = useChat();

  const [searchQuery, setSearchQuery] = useState("");
  const [dmSearchQuery, setDmSearchQuery] = useState("");
  
  // Modals state
  const [showDmModal, setShowDmModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showDevConsole, setShowDevConsole] = useState(false);

  // Fullscreen Profile Photo state
  const [fullscreenAvatar, setFullscreenAvatar] = useState<{ avatar: string; name: string } | null>(null);

  // Stories Modals State
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [activeStoryUserId, setActiveStoryUserId] = useState<string | null>(null);
  const [viewedStoryIds, setViewedStoryIds] = useState<string[]>([]);

  // Sync viewed stories from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("devconnect_viewed_stories");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const timer = setTimeout(() => {
          setViewedStoryIds(parsed);
        }, 0);
        return () => clearTimeout(timer);
      } catch {}
    }
  }, [stories]);

  // Profile Edit fields
  const [editName, setEditName] = useState(currentUser?.username || "");
  const [editStatus, setEditStatus] = useState(currentUser?.status || "");
  const [editAvatar, setEditAvatar] = useState(currentUser?.avatar || "avatar-terminal");
  const [editMobileNumber, setEditMobileNumber] = useState(currentUser?.mobileNumber || "");
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [compressionLogs, setCompressionLogs] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Group Create fields
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]); // list of handles

  // Pull-to-refresh state hooks
  const [pullOffset, setPullOffset] = useState(0);
  const [pullState, setPullState] = useState<"idle" | "pulling" | "ready" | "refreshing" | "success">("idle");
  const [spinnerChar, setSpinnerChar] = useState("|");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  // Terminal spinner character animation cycle
  useEffect(() => {
    if (pullState !== "refreshing") return;
    const chars = ["|", "/", "-", "\\"];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % chars.length;
      setSpinnerChar(chars[idx]);
    }, 150);
    return () => clearInterval(interval);
  }, [pullState]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // Only pull if container is scrolled to the top
    if (container.scrollTop === 0 && pullState !== "refreshing" && pullState !== "success") {
      touchStartY.current = e.touches[0].clientY;
      setPullState("pulling");
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (pullState === "idle" || pullState === "refreshing" || pullState === "success") return;
    
    const clientY = e.touches[0].clientY;
    const diff = clientY - touchStartY.current;
    
    if (diff > 0) {
      // Logarithmic / dampened scaling resistance
      const offset = Math.min(diff * 0.45, 80);
      setPullOffset(offset);
      
      if (offset >= 55) {
        setPullState("ready");
      } else {
        setPullState("pulling");
      }
      
      // Prevent browser default pull-to-refresh behavior
      if (e.cancelable) e.preventDefault();
    } else {
      setPullOffset(0);
      setPullState("idle");
    }
  };

  const handleTouchEnd = async () => {
    if (pullState === "idle" || pullState === "refreshing" || pullState === "success") return;
    
    if (pullOffset >= 55) {
      setPullState("refreshing");
      setPullOffset(60); // visually lock during execution
      
      try {
        await Promise.all([refreshChats(), refreshUsers(), refreshStories()]);
        setPullState("success");
        setPullOffset(45);
        setTimeout(() => {
          setPullOffset(0);
          setPullState("idle");
        }, 1200);
      } catch (err) {
        setPullOffset(0);
        setPullState("idle");
      }
    } else {
      setPullOffset(0);
      setPullState("idle");
    }
  };

  if (!currentUser) return null;

  // Filter chats based on query
  const filteredChats = chats.filter((chat) => {
    if (chat.type === "group") {
      return chat.name?.toLowerCase().includes(searchQuery.toLowerCase());
    } else {
      // Find other member
      const otherMember = chat.members.find((m) => m._id !== currentUser._id);
      return (
        otherMember?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        otherMember?._id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  });

  const getChatDetails = (chat: ChatType) => {
    const typingUsers = (typingStates[chat._id] || []).filter((u) => u.userId !== currentUser._id);
    const isTyping = typingUsers.length > 0;

    let subtitleElement: React.ReactNode = "";

    if (isTyping) {
      subtitleElement = (
        <span className="text-[10px] text-green-400 font-bold animate-pulse">
          typing...
        </span>
      );
    } else if (chat.lastMessage) {
      const sender = chat.lastMessage.senderId === currentUser._id ? "You" : chat.lastMessage.senderName;
      let textContent = "";
      if (chat.lastMessage.image) {
        textContent = "[Photo]";
      } else if (chat.lastMessage.code) {
        textContent = `[Code: ${chat.lastMessage.codeLanguage}]`;
      } else {
        textContent = chat.lastMessage.text;
      }
      subtitleElement = (
        <span className="text-[10px] text-slate-500 truncate">
          {sender}: {textContent}
        </span>
      );
    } else {
      if (chat.type === "group") {
        subtitleElement = (
          <span className="text-[10px] text-slate-500 truncate">
            {chat.members.length} developers
          </span>
        );
      } else {
        const other = chat.members.find((m) => m._id !== currentUser._id) || {
          _id: "unknown",
          username: "Unknown Developer",
          status: "",
        };
        subtitleElement = (
          <span className="text-[10px] text-slate-500 truncate">
            {other.status || `@${other._id}`}
          </span>
        );
      }
    }

    if (chat.type === "group") {
      return {
        name: chat.name || "Group",
        avatar: chat.avatar || "avatar-braces",
        subtitleElement,
      };
    } else {
      const other = chat.members.find((m) => m._id !== currentUser._id) || {
        _id: "unknown",
        username: "Unknown Developer",
        avatar: "avatar-terminal",
      };
      return {
        name: other.username,
        avatar: other.avatar,
        subtitleElement,
      };
    }
  };

  const handleStartDm = async (recipientId: string) => {
    setIsCreatingChat(true);
    try {
      await createPrivateChat(recipientId);
      setDmSearchQuery("");
      setShowDmModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedMembers.length === 0) return;

    setIsCreatingGroup(true);
    try {
      // Use a purple/pink CPU/Group preset avatar for groups
      const success = await createGroupChat(groupName, selectedMembers, "avatar-braces");
      if (success) {
        setGroupName("");
        setSelectedMembers([]);
        setShowGroupModal(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const toggleMemberSelection = (handle: string) => {
    setSelectedMembers((prev) =>
      prev.includes(handle) ? prev.filter((m) => m !== handle) : [...prev, handle]
    );
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    const finalAvatar = customAvatar || editAvatar;
    const success = await updateProfile(editName, editStatus, finalAvatar, editMobileNumber);
    setIsUpdatingProfile(false);
    if (success) {
      setShowProfileEdit(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCompressionLogs("Compiling image nodes...");
      const result = await compressImage(file, 400, 0.7);
      setCustomAvatar(result.base64);
      setEditAvatar("");
      const savedPercent = Math.round(((result.originalSize - result.compressedSize) / result.originalSize) * 100);
      setCompressionLogs(`Compressed: ${(result.originalSize / 1024).toFixed(1)}KB -> ${(result.compressedSize / 1024).toFixed(1)}KB (-${savedPercent}%)`);
    } catch (err) {
      console.error(err);
      showAlert("COMPRESSION FAILURE", "Failed to compile/compress profile photo payload.", "error");
      setCompressionLogs("");
    }
  };

  const selectPreset = (presetId: string) => {
    setEditAvatar(presetId);
    setCustomAvatar(null);
    setCompressionLogs("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className={`w-full md:w-80 bg-theme-sidebar border-r border-theme flex flex-col h-full select-none text-slate-300 font-mono ${activeChatId ? "hidden md:flex" : "flex"}`}>
      {/* Header Profile Summary */}
      <div className="p-4 border-b border-theme bg-theme-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setEditName(currentUser.username);
              setEditStatus(currentUser.status);
              setEditMobileNumber(currentUser.mobileNumber || "");
              if (currentUser.avatar && currentUser.avatar.startsWith("data:image/")) {
                setCustomAvatar(currentUser.avatar);
                setEditAvatar("");
              } else {
                setEditAvatar(currentUser.avatar || "avatar-terminal");
                setCustomAvatar(null);
              }
              setCompressionLogs("");
              setShowProfileEdit(true);
            }}
            className="hover:scale-105 transition-all duration-200 cursor-pointer"
          >
            <AvatarRenderer avatar={currentUser.avatar} size={40} />
          </button>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-200 truncate">{currentUser.username}</span>
            <span className="text-[10px] text-green-400 truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              {currentUser.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isLocalOnly ? (
            <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-500 font-bold px-1.5 py-0.5 rounded cursor-help" title="Unreachable Database: operating in offline local storage sync.">
              LOCAL
            </span>
          ) : (
            <span className="text-[9px] bg-green-500/10 border border-green-500/30 text-green-400 font-bold px-1.5 py-0.5 rounded cursor-help" title="Connected to MongoDB Atlas.">
              DB_LINK
            </span>
          )}
          <button 
            onClick={() => setShowDevConsole(true)} 
            className="text-slate-500 hover:text-theme-accent p-1.5 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Configure developer variables/themes"
          >
            <Terminal size={16} />
          </button>
          <button 
            onClick={() => {
              showConfirm(
                "DISCONNECT SESSION",
                "Are you sure you want to terminate your secure developer workspace link and log out?",
                logout
              );
            }} 
            className="text-slate-500 hover:text-red-400 p-1.5 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Disconnect SSH Session"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Action triggers */}
      <div className="grid grid-cols-2 gap-2 p-3 border-b border-theme/40 bg-theme-sidebar">
        <button
          onClick={() => setShowDmModal(true)}
          className="flex items-center justify-center gap-1.5 py-1.5 border border-theme hover:border-theme-accent/50 hover:bg-theme-header rounded-lg text-xs font-semibold hover:text-theme-accent cursor-pointer transition-all duration-200"
        >
          <Plus size={14} />
          <span>New Chat</span>
        </button>
        <button
          onClick={() => setShowGroupModal(true)}
          className="flex items-center justify-center gap-1.5 py-1.5 border border-slate-800 hover:border-purple-400/50 hover:bg-[#151820] rounded-lg text-xs font-semibold hover:text-purple-400 cursor-pointer transition-all duration-200"
        >
          <Users size={14} />
          <span>New Group</span>
        </button>
      </div>

      {/* Stories horizontal bar */}
      <StoriesBar 
        onAddStoryClick={() => setIsCreateStoryOpen(true)}
        onViewStoryClick={(uid) => {
          setActiveStoryUserId(uid);
          
          // Mark all stories of this user as viewed instantly
          const userStories = stories.filter((s) => s.userId === uid);
          const viewedIds = [...viewedStoryIds];
          userStories.forEach((s) => {
            if (!viewedIds.includes(s._id)) {
              viewedIds.push(s._id);
            }
          });
          localStorage.setItem("devconnect_viewed_stories", JSON.stringify(viewedIds));
          setViewedStoryIds(viewedIds);
          
          setIsStoryViewerOpen(true);
        }}
      />

      {/* Search component */}
      <div className="p-3 border-b border-theme/40">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-theme-input border border-theme focus:border-theme-accent rounded-md text-slate-200 outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Chats feed list */}
      <div 
        ref={scrollContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-slate-800/30 relative"
      >
        {/* Custom Pull-to-refresh Loader Panel */}
        {pullOffset > 0 && (
          <div 
            className="w-full overflow-hidden bg-slate-950/70 border-b border-slate-900 flex items-center justify-center font-mono transition-all duration-75 ease-out"
            style={{ height: `${pullOffset}px` }}
          >
            <div className="flex flex-col items-center gap-1 px-4 text-center">
              {pullState === "pulling" && (
                <>
                  <span className="text-[9px] text-amber-500 font-bold uppercase tracking-widest animate-pulse">
                    ⚡ PULL DOWN TO RECOMPILE [ {Math.round((pullOffset / 55) * 100)}% ]
                  </span>
                  <div className="w-36 h-1 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 transition-all duration-75"
                      style={{ width: `${(pullOffset / 55) * 100}%` }}
                    />
                  </div>
                </>
              )}
              {pullState === "ready" && (
                <>
                  <span className="text-[9px] text-green-400 font-bold uppercase tracking-widest animate-bounce">
                    🚀 RELEASE TO EXECUTE SYSTEM SYNC
                  </span>
                  <div className="w-36 h-1 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400 w-full animate-pulse" />
                  </div>
                </>
              )}
              {pullState === "refreshing" && (
                <div className="flex items-center gap-2 text-cyan-400">
                  <span className="inline-block font-bold text-xs">{spinnerChar}</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest">
                    COMPILING REPOSITORY STATE...
                  </span>
                </div>
              )}
              {pullState === "success" && (
                <div className="flex items-center gap-1.5 text-green-400">
                  <span className="text-xs">✓</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest">
                    SYSTEM_SYNC_OK (COMPILED)
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        {isLoadingChats ? (
          <div className="p-8 text-center text-xs text-slate-600 flex flex-col items-center gap-2">
            <span className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>SYNCING CHANNELS...</span>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-600 flex flex-col items-center gap-2">
            <Terminal size={24} className="opacity-40" />
            <span>NO ACTIVE CHANNELS FOUND</span>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const { name, avatar, subtitleElement } = getChatDetails(chat);
            const isActive = activeChatId === chat._id;
            
            return (
              <button
                key={chat._id}
                onClick={() => selectChat(chat._id)}
                className={`w-full flex items-center gap-3 p-3 text-left transition-all duration-200 border-l-2 cursor-pointer ${
                  isActive 
                    ? "bg-theme-header/90 border-theme-accent" 
                    : "hover:bg-theme-header/40 border-transparent"
                }`}
              >
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    const { name, avatar } = getChatDetails(chat);
                    setFullscreenAvatar({ avatar, name });
                  }}
                  className="hover:scale-105 active:scale-95 transition-all cursor-pointer block rounded-full flex-shrink-0"
                  title={`View ${name}'s profile photo`}
                >
                  <AvatarRenderer avatar={avatar} size={42} />
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold truncate ${isActive ? "text-cyan-400" : "text-slate-200"}`}>
                      {name}
                    </span>
                    <span className="text-[9px] text-slate-600 select-none">
                      {new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {subtitleElement}
                </div>
                <ChevronRight size={14} className={`text-slate-700 transition-transform ${isActive ? "translate-x-0.5 text-cyan-400" : ""}`} />
              </button>
            );
          })
        )}
      </div>

      {/* Profile Edit Overlay Modal */}
      {showProfileEdit && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0d0e12] border border-cyan-400/40 rounded-xl p-6 shadow-[0_0_30px_rgba(0,240,255,0.15)]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                <Edit2 size={13} />
                <span>CONFIGURE DEV NODE</span>
              </span>
              <button onClick={() => setShowProfileEdit(false)} className="text-slate-500 hover:text-slate-300">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 outline-none focus:border-cyan-400"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Coding Status</label>
                <input
                  type="text"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  placeholder="Coding in Rust..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 outline-none focus:border-cyan-400"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Mobile Number</label>
                <input
                  type="tel"
                  value={editMobileNumber}
                  onChange={(e) => setEditMobileNumber(e.target.value.replace(/[^0-9+]/g, ""))}
                  placeholder="+919876543210"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 outline-none focus:border-cyan-400"
                />
              </div>
              
              {/* Profile Photo Setup */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Change Profile Photo</label>
                
                <div className="flex items-center gap-3 p-2 bg-slate-950 border border-slate-850 rounded-lg">
                  <span
                    onClick={() => {
                      setFullscreenAvatar({
                        avatar: customAvatar || editAvatar,
                        name: currentUser.username
                      });
                    }}
                    className="hover:scale-105 active:scale-95 transition-all cursor-pointer block rounded-full flex-shrink-0"
                    title="View profile photo fullscreen"
                  >
                    <AvatarRenderer avatar={customAvatar || editAvatar} size={48} />
                  </span>
                  <div className="flex-1 flex flex-col justify-center gap-0.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Avatar Preview</span>
                    {compressionLogs ? (
                      <span className="text-[9px] text-green-400 animate-pulse">{compressionLogs}</span>
                    ) : (
                      <span className="text-[9px] text-slate-600">Select preset or upload custom</span>
                    )}
                  </div>
                </div>

                {/* Presets Gallery */}
                <div className="grid grid-cols-6 gap-1">
                  {PRESETS.map((p) => {
                    const isSelected = editAvatar === p.id && !customAvatar;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPreset(p.id)}
                        className="h-8 rounded-md flex items-center justify-center border transition-colors bg-slate-900/40 cursor-pointer"
                        style={{ borderColor: isSelected ? p.color : "#1f2937" }}
                        title={p.label}
                      >
                        <p.icon size={13} style={{ color: isSelected ? p.color : "#64748b" }} />
                      </button>
                    );
                  })}
                </div>

                {/* Custom File Upload Option */}
                <div className="relative">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                    id="profile-avatar-upload"
                  />
                  <label
                    htmlFor="profile-avatar-upload"
                    className="flex items-center justify-center gap-1.5 py-1.5 px-3 border border-dashed border-slate-800 hover:border-cyan-400/50 rounded-lg text-[10px] text-slate-400 hover:text-cyan-400 cursor-pointer transition-colors"
                  >
                    <Upload size={12} />
                    <span>Upload Custom Photo</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdatingProfile}
                className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-[#07080b] font-bold rounded cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                {isUpdatingProfile ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-[#07080b] border-t-transparent rounded-full animate-spin" />
                    <span>COMPILING...</span>
                  </>
                ) : (
                  <span>COMPILE CHANGES</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New DM (User selection) Modal */}
      {showDmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0d0e12] border border-cyan-400/40 rounded-xl p-6 shadow-[0_0_30px_rgba(0,240,255,0.15)] flex flex-col max-h-[450px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                <MessageSquare size={13} />
                <span>SELECT REMOTE DEV NODE</span>
              </span>
              <button 
                onClick={() => { setShowDmModal(false); setDmSearchQuery(""); }} 
                className="text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Instagram-like Developer ID Search Input */}
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-500 animate-pulse" />
              <input
                type="text"
                placeholder="Search @handle or name (e.g. sanjai)..."
                value={dmSearchQuery}
                onChange={(e) => setDmSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-md text-slate-200 outline-none transition-colors"
                autoFocus
              />
              {dmSearchQuery && (
                <button
                  onClick={() => setDmSearchQuery("")}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-slate-800/40">
              {!dmSearchQuery.trim() ? (
                <div className="text-center py-8 text-xs text-slate-500 flex flex-col items-center gap-2">
                  <Terminal size={18} className="opacity-40" />
                  <span>Search for @handle or name...</span>
                </div>
              ) : users.filter((u) => 
                u._id.toLowerCase().includes(dmSearchQuery.toLowerCase()) ||
                u.username.toLowerCase().includes(dmSearchQuery.toLowerCase())
              ).length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-600">
                  NO DEVELOPER FOUND WITH &quot;@{dmSearchQuery}&quot;
                </div>
              ) : (
                users
                  .filter((u) => 
                    u._id.toLowerCase().includes(dmSearchQuery.toLowerCase()) ||
                    u.username.toLowerCase().includes(dmSearchQuery.toLowerCase())
                  )
                  .map((user) => (
                    <button
                      key={user._id}
                      disabled={isCreatingChat}
                      onClick={() => handleStartDm(user._id)}
                      className="w-full p-2.5 flex items-center gap-3 hover:bg-slate-900/60 transition-colors text-left rounded cursor-pointer disabled:opacity-50"
                    >
                      <AvatarRenderer avatar={user.avatar} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <span>{user.username}</span>
                          {isCreatingChat && (
                            <span className="w-2.5 h-2.5 border border-cyan-400 border-t-transparent rounded-full animate-spin inline-block" />
                          )}
                        </div>
                        <div className="text-[9px] text-slate-500 truncate">@{user._id} | {user.status}</div>
                      </div>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0d0e12] border border-purple-400/40 rounded-xl p-6 shadow-[0_0_30px_rgba(189,147,249,0.15)] flex flex-col max-h-[450px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                <Users size={13} />
                <span>SPAWN MULTI-USER CLUSTER</span>
              </span>
              <button onClick={() => setShowGroupModal(false)} className="text-slate-500 hover:text-slate-300">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="flex flex-col gap-4 text-xs flex-1 min-h-0">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Group Channel Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. StackOverflow Refugees"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 outline-none focus:border-purple-400"
                />
              </div>

              <div className="flex flex-col flex-1 min-h-0">
                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1.5">Add Members</label>
                <div className="flex-1 overflow-y-auto border border-slate-800 rounded bg-slate-950 p-2 scrollbar-thin flex flex-col gap-1">
                  {users.length === 0 ? (
                    <div className="text-center py-4 text-[10px] text-slate-600">
                      NO OTHER DEV NODES FOUND
                    </div>
                  ) : (
                    users.map((user) => {
                      const isSelected = selectedMembers.includes(user._id);
                      return (
                        <button
                          key={user._id}
                          type="button"
                          onClick={() => toggleMemberSelection(user._id)}
                          className={`w-full p-1.5 flex items-center justify-between hover:bg-slate-900 rounded transition-colors text-left cursor-pointer`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <AvatarRenderer avatar={user.avatar} size={24} />
                            <span className="truncate text-slate-200 font-bold">{user.username}</span>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${isSelected ? "bg-purple-500/20 border border-purple-500 text-purple-300" : "border border-slate-800 text-slate-600"}`}>
                            {isSelected ? "ADDED" : "ADD"}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!groupName.trim() || selectedMembers.length === 0 || isCreatingGroup}
                className="w-full py-2 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 disabled:pointer-events-none text-[#07080b] font-bold rounded cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                {isCreatingGroup ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-[#07080b] border-t-transparent rounded-full animate-spin" />
                    <span>ALLOCATING...</span>
                  </>
                ) : (
                  <span>ALLOCATE CLUSTER</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Profile Photo Modal */}
      {fullscreenAvatar && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md select-none"
          onClick={() => setFullscreenAvatar(null)}
        >
          {/* Top Header bar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs font-bold text-slate-200 uppercase tracking-widest truncate max-w-[60%]">
              {fullscreenAvatar.name}&apos;s Photo
            </span>
            <div className="flex gap-2">
              {fullscreenAvatar.avatar && fullscreenAvatar.avatar.startsWith("data:image/") && (
                <button
                  onClick={() => downloadBase64Image(fullscreenAvatar.avatar, `profile-${fullscreenAvatar.name.toLowerCase().replace(/\s+/g, '-')}.jpg`)}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-green-400 px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider shadow-lg transition-all active:scale-95"
                  title="Download profile photo"
                >
                  <Download size={13} />
                  <span>Save</span>
                </button>
              )}
              <button 
                onClick={() => setFullscreenAvatar(null)}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-red-400 p-1.5 rounded-lg cursor-pointer shadow-lg transition-all active:scale-95 flex items-center justify-center"
                title="Close photo viewer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Photo Display */}
          <div className="w-full max-w-sm aspect-square flex items-center justify-center relative animate-fade-in animate-duration-200" onClick={(e) => e.stopPropagation()}>
            {fullscreenAvatar.avatar && fullscreenAvatar.avatar.startsWith("data:image/") ? (
              <img 
                src={fullscreenAvatar.avatar} 
                alt={`${fullscreenAvatar.name}'s Profile`} 
                className="w-full h-full object-cover rounded-xl border border-slate-800 shadow-2xl"
              />
            ) : (
              <div 
                className="w-full h-full rounded-xl border border-slate-800 bg-slate-950/40 flex items-center justify-center shadow-2xl relative overflow-hidden"
              >
                <AvatarRenderer avatar={fullscreenAvatar.avatar} size={220} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Developer Settings Console Modal */}
      {showDevConsole && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-theme-sidebar border border-theme-accent rounded-xl p-6 shadow-[0_0_30px_rgba(0,240,255,0.15)] animate-modal-slide">
            <div className="flex items-center justify-between border-b border-theme pb-3 mb-4">
              <span className="text-xs font-bold text-theme-accent flex items-center gap-1.5">
                <Terminal size={14} />
                <span>DEV SETTINGS CONSOLE</span>
              </span>
              <button onClick={() => setShowDevConsole(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            
            <div className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Select IDE Compiler Theme</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    { id: "dracula", name: "Dracula IDE", color: "#ff79c6" },
                    { id: "onedark", name: "One Dark Pro", color: "#61afef" },
                    { id: "matrix", name: "Terminal Green", color: "#00ff00" },
                    { id: "monokai", name: "Retro Monokai", color: "#a6e22e" },
                    { id: "github", name: "GitHub Dark", color: "#58a6ff" },
                    { id: "cyberpunk", name: "Cyberpunk 2077", color: "#00f0ff" },
                    { id: "synthwave", name: "Synthwave '84", color: "#ff7edb" }
                  ].map((t) => {
                    const isSelected = theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={`p-2 py-1.5 rounded-lg border text-left cursor-pointer transition-all ${
                          isSelected 
                            ? "border-theme-accent bg-theme-header" 
                            : "border-theme bg-theme-input/40 hover:bg-theme-input/80"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                          <span className="font-bold text-[9px] text-slate-200">{t.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-theme pt-3">
                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Visual Optimizations</label>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-slate-300 font-bold">Matrix Code Rain</span>
                    <span className="text-[9px] text-slate-500">Renders code rain matching active theme</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMatrixRain(!matrixRain)}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${matrixRain ? "bg-theme-accent" : "bg-slate-800"}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full bg-slate-950 absolute top-0.75 left-0.75 transition-transform ${matrixRain ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-slate-300 font-bold">CRT Scanline Filter</span>
                    <span className="text-[9px] text-slate-500">Retro phosphor scanner flicker overlay</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCrtEffect(!crtEffect)}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${crtEffect ? "bg-theme-accent" : "bg-slate-800"}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full bg-slate-950 absolute top-0.75 left-0.75 transition-transform ${crtEffect ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-slate-300 font-bold">Git Commit Logs</span>
                    <span className="text-[9px] text-slate-500">Show message git branch commits</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGitMergeAnim(!gitMergeAnim)}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${gitMergeAnim ? "bg-theme-accent" : "bg-slate-800"}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full bg-slate-950 absolute top-0.75 left-0.75 transition-transform ${gitMergeAnim ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDevConsole(false)}
                className="w-full py-2 bg-theme-accent hover:bg-theme-accent-hover text-slate-950 font-bold rounded cursor-pointer transition-colors uppercase tracking-wider text-center"
              >
                Apply Adjustments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stories Modals */}
      <CreateStoryModal 
        isOpen={isCreateStoryOpen}
        onClose={() => setIsCreateStoryOpen(false)}
      />

      {activeStoryUserId && (
        <StoryViewer 
          stories={stories}
          initialUserId={activeStoryUserId}
          isOpen={isStoryViewerOpen}
          onClose={() => {
            setIsStoryViewerOpen(false);
            setActiveStoryUserId(null);
          }}
        />
      )}
    </div>
  );
}
