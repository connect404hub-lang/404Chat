"use client";

import React, { useState, useEffect, useRef } from "react";
import { useChat, MessageType } from "@/lib/chatStore";
import { AvatarRenderer } from "./Login";
import CodeSnippet from "./CodeSnippet";
import { compressImage, formatBytes, downloadBase64Image } from "@/lib/imageCompressor";
import { 
  Send, Code, Image as ImageIcon, Terminal, Cpu, Users, 
  Trash2, X, AlertCircle, ArrowDown, Copy, Check, Download, Edit2, ArrowLeft
} from "lucide-react";

export default function ChatArea() {
  const { currentUser, users, activeChat, messages, sendChatMessage, isLoadingMessages, deleteMessage, editMessage, typingStates, sendTypingStatus, selectChat, showAlert, showConfirm, theme, gitMergeAnim } = useChat();
  
  const [textInput, setTextInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [gitCommitMsg, setGitCommitMsg] = useState<string | null>(null);
  
  // Copy state handler
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Message Edit state handler
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  // Fullscreen Lightbox viewer state
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // Typing status tracker state
  const [isCurrentlyTyping, setIsCurrentlyTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mobile long press actions modal state
  const [activeActionMessage, setActiveActionMessage] = useState<MessageType | null>(null);

  // Fullscreen Profile Photo state
  const [fullscreenAvatar, setFullscreenAvatar] = useState<{ avatar: string; name: string } | null>(null);

  // Touch gesture tracker refs
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const longPressTriggeredRef = useRef<boolean>(false);

  const handleTouchStart = (msg: MessageType) => (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    longPressTriggeredRef.current = false;

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);

    touchTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) {
        try {
          navigator.vibrate(50);
        } catch (err) {}
      }
      setActiveActionMessage(msg);
      longPressTriggeredRef.current = true;
      touchTimerRef.current = null;
    }, 600);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchTimerRef.current) return;
    const touch = e.touches[0];
    const diffX = Math.abs(touch.clientX - touchStartX.current);
    const diffY = Math.abs(touch.clientY - touchStartY.current);

    if (diffX > 10 || diffY > 10) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  };

  const handleBubbleClick = (e: React.MouseEvent) => {
    if (longPressTriggeredRef.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressTriggeredRef.current = false;
    }
  };

  const handleSaveEdit = async (msgId: string) => {
    const msg = messages.find((m) => m._id === msgId);
    const trimmed = editingText.trim();
    if (!trimmed && msg && !msg.image && !msg.code) return;

    const success = await editMessage(msgId, trimmed);
    if (success) {
      setEditingMessageId(null);
      setEditingText("");
    }
  };

  const handleCopyMessageText = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(msgId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error("Failed to copy message", err);
    }
  };

  // Code Snippet Composer state
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("js");
  const [codeCaption, setCodeCaption] = useState("");
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");

  // Photo Uploader state
  const [compressedImage, setCompressedImage] = useState<string | null>(null);
  const [compressionRatioMsg, setCompressionRatioMsg] = useState("");
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll controls
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  // Auto scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom("auto");
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setIsCurrentlyTyping(false);
    };
  }, [activeChat?._id]);

  useEffect(() => {
    scrollToBottom("smooth");
  }, [messages.length]);

  // Monitor scrolling to show "scroll-to-bottom" helper button
  const handleScroll = () => {
    const container = chatScrollContainerRef.current;
    if (!container) return;
    
    // Show button if scrolled up by more than 300px
    const isScrolledUp = container.scrollHeight - container.clientHeight - container.scrollTop > 300;
    setShowScrollBottomBtn(isScrolledUp);
  };

  if (!currentUser) return null;

  if (!activeChat) {
    return (
      <div className="hidden md:flex flex-1 bg-[#07080b] flex-col items-center justify-center font-mono text-slate-500 select-none p-6 text-center border-l border-slate-800">
        <Terminal size={48} className="text-slate-800 animate-pulse mb-4" />
        <h3 className="text-sm font-bold tracking-wider text-slate-400">NO SECURE SSH CHANNEL ACTIVE</h3>
        <p className="text-[11px] text-slate-600 max-w-xs mt-2 leading-relaxed">
          Select a developer node or allocate a group cluster from the sidebar to establish a secure sharing link.
        </p>
      </div>
    );
  }

  // Identify direct chat other member
  const otherMember = activeChat.type === "private"
    ? activeChat.members.find((m) => m._id !== currentUser._id) || {
        _id: "unknown",
        username: "Unknown Developer",
        avatar: "avatar-terminal",
        status: "",
      }
    : null;

  const activeTypingUsers = (typingStates[activeChat._id] || []).filter((u) => u.userId !== currentUser._id);
  const showTypingIndicator = activeTypingUsers.length > 0;

  const handleTypingPulse = () => {
    if (!activeChat || !currentUser) return;
    
    if (!isCurrentlyTyping) {
      setIsCurrentlyTyping(true);
      sendTypingStatus(activeChat._id, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsCurrentlyTyping(false);
      sendTypingStatus(activeChat._id, false);
    }, 4000);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setCompressionRatioMsg("Compiling image nodes...");
    try {
      // Compress the image down using Canvas (saves storage space, meets user requirement!)
      const result = await compressImage(file, 800, 0.7);
      setCompressedImage(result.base64);
      
      const savedPercent = Math.round(((result.originalSize - result.compressedSize) / result.originalSize) * 100);
      setCompressionRatioMsg(
        `Compressed: ${formatBytes(result.originalSize)} -> ${formatBytes(result.compressedSize)} (-${savedPercent}% storage saved)`
      );
    } catch (err) {
      console.error(err);
      showAlert("COMPRESSION FAILURE", "Failed to compile/compress image payload.", "error");
    } finally {
      setIsCompressing(false);
    }
  };

  const clearImageSelection = () => {
    setCompressedImage(null);
    setCompressionRatioMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() && !compressedImage) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsCurrentlyTyping(false);
    sendTypingStatus(activeChat._id, false);

    setIsSending(true);

    if (gitMergeAnim) {
      const summary = textInput ? textInput.substring(0, 18) : "media payload";
      setGitCommitMsg(`$ git commit -am "Broadcast payload: ${summary}..."`);
      setTimeout(() => {
        const hash = Math.random().toString(16).substring(2, 8);
        setGitCommitMsg(`[main ${hash}] Transmitted and synced chunk node.`);
        setTimeout(() => {
          setGitCommitMsg(null);
        }, 1100);
      }, 700);
    }

    const success = await sendChatMessage(
      textInput, 
      undefined, 
      undefined, 
      compressedImage || undefined
    );
    
    if (success) {
      setTextInput("");
      clearImageSelection();
    }
    setIsSending(false);
  };

  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const val = e.currentTarget.value;
      const newVal = val.substring(0, start) + "  " + val.substring(end);
      setCodeSnippet(newVal);
      // Put cursor after tab
      setTimeout(() => {
        if (e.currentTarget) {
          e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const handleSendCodeSnippet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeSnippet.trim()) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsCurrentlyTyping(false);
    sendTypingStatus(activeChat._id, false);

    setIsSending(true);

    if (gitMergeAnim) {
      setGitCommitMsg(`$ git commit -am "Compile snippet: ${codeLanguage} code block"`);
      setTimeout(() => {
        const hash = Math.random().toString(16).substring(2, 8);
        setGitCommitMsg(`[main ${hash}] Transmitted syntax highlighted code snippet.`);
        setTimeout(() => {
          setGitCommitMsg(null);
        }, 1100);
      }, 700);
    }

    // Send code message
    const success = await sendChatMessage(
      codeCaption, 
      codeSnippet, 
      codeLanguage, 
      undefined
    );

    if (success) {
      setCodeSnippet("");
      setCodeCaption("");
      setShowCodeModal(false);
      setEditorTab("write");
    }
    setIsSending(false);
  };

  return (
    <div className="flex-1 min-w-0 bg-theme-bg flex flex-col h-full font-mono text-slate-300 relative border-l border-theme">
      
      {/* Active Chat Header */}
      <div className="p-4 border-b border-theme bg-theme-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => selectChat(null)}
            className="md:hidden p-1 text-slate-500 hover:text-theme-accent hover:bg-theme-header rounded transition-colors mr-1 cursor-pointer flex items-center justify-center"
            title="Back to Channels"
          >
            <ArrowLeft size={18} />
          </button>
          <span
            onClick={() => {
              const avatarVal = activeChat.type === "group" ? (activeChat.avatar || "avatar-braces") : (otherMember?.avatar || "avatar-terminal");
              const nameVal = activeChat.type === "group" ? (activeChat.name || "Group") : (otherMember?.username || "Developer");
              setFullscreenAvatar({ avatar: avatarVal, name: nameVal });
            }}
            className="hover:scale-105 active:scale-95 transition-all cursor-pointer block rounded-full flex-shrink-0"
            title="View profile photo fullscreen"
          >
            <AvatarRenderer 
              avatar={activeChat.type === "group" ? (activeChat.avatar || "avatar-braces") : (otherMember?.avatar || "avatar-terminal")} 
              size={42} 
            />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-200">
              {activeChat.type === "group" ? activeChat.name : otherMember?.username}
            </span>
            <span className="text-[10px] text-slate-500 truncate mt-0.5">
              {activeChat.type === "group" ? (
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {activeChat.members.map((m) => m.username).join(", ")}
                </span>
              ) : (
                `@${otherMember?._id} | ${otherMember?.status}`
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Messages Feed View */}
      <div 
        ref={chatScrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-4 scrollbar-thin scroll-smooth relative"
      >
        {isLoadingMessages ? (
          <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-600 gap-2 select-none">
            <span className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>FETCHING SECURE LOGS...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-700 select-none">
            <AlertCircle size={20} className="mb-2 opacity-50" />
            <span>ENCRYPTED CHANNEL OPEN. READY FOR BROADCAST.</span>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === currentUser._id;
            const hasSnippet = !!msg.code;
            const hasImage = !!msg.image;

            return (
              <div 
                key={msg._id} 
                className={`flex flex-col max-w-[85%] md:max-w-[75%] min-w-0 ${isMe ? "self-end items-end" : "self-start items-start"}`}
              >
                {/* Sender Tag (for group chats when message is from another user) */}
                {activeChat.type === "group" && !isMe && (
                  <span className="text-[9px] font-bold text-purple-400 mb-1 pl-1">
                    {msg.senderName}
                  </span>
                )}

                {/* Message Container Bubble with group hover class */}
                <div 
                  className={`p-3.5 rounded-xl border text-xs leading-relaxed transition-all duration-300 relative group min-w-0 w-full ${
                    isMe 
                      ? "bg-theme-msg-me border-green-500/20 text-slate-200 rounded-tr-none shadow-[0_0_15px_rgba(57,255,20,0.02)]" 
                      : "bg-theme-msg-other border-theme-accent/20 text-slate-200 rounded-tl-none shadow-[0_0_15px_rgba(0,240,255,0.02)]"
                  }`}
                  onTouchStart={handleTouchStart(msg)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  onContextMenu={handleContextMenu}
                  onClickCapture={handleBubbleClick}
                >
                  {/* Copy, Edit, and Delete Overlay Action Buttons */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                    {msg.text && (
                      <button
                        onClick={() => handleCopyMessageText(msg._id, msg.text)}
                        className="bg-slate-950/80 hover:bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-cyan-400 p-1.5 rounded cursor-pointer active:scale-95 shadow-md"
                        title="Copy message text"
                      >
                        {copiedMessageId === msg._id ? (
                          <Check size={12} className="text-green-400" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    )}
                    
                    {isMe && (
                      <button
                        onClick={() => { setEditingMessageId(msg._id); setEditingText(msg.text || ""); }}
                        className="bg-slate-950/80 hover:bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-yellow-400 p-1.5 rounded cursor-pointer active:scale-95 shadow-md"
                        title="Edit message"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}

                    {isMe && (
                      <button
                        onClick={() => {
                          showConfirm(
                            "PURGE MESSAGE NODE",
                            "Are you sure you want to permanently delete this message from the registry logs?",
                            () => deleteMessage(msg._id)
                          );
                        }}
                        className="bg-slate-950/80 hover:bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-red-400 p-1.5 rounded cursor-pointer active:scale-95 shadow-md"
                        title="Delete message"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Compressed Storage-Saver Image */}
                  {hasImage && (
                    <div 
                      onClick={() => setLightboxImageUrl(msg.image || null)}
                      className="relative mb-2 rounded-lg overflow-hidden border border-slate-800 bg-[#07080b] max-w-full group/image cursor-pointer hover:border-cyan-500/30 transition-all"
                    >
                      <img 
                        src={msg.image} 
                        alt="Shared media payload" 
                        className="max-h-60 object-contain mx-auto"
                      />
                      <span className="absolute bottom-2 left-2 bg-black/60 backdrop-blur text-[8px] text-green-400 px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold border border-green-500/20">
                        COMPRESSED JPEG
                      </span>
                      
                      {/* Image Download Action Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (msg.image) {
                            downloadBase64Image(msg.image, `devconnect-image-${msg._id}.jpg`);
                          }
                        }}
                        className="absolute top-2 right-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-green-400 p-1.5 rounded cursor-pointer transition-all active:scale-95 opacity-0 group-hover/image:opacity-100 z-10 shadow-md"
                        title="Download image payload"
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  )}

                  {/* Text Message Content / Inline Editor */}
                  {editingMessageId === msg._id ? (
                    <div className="flex flex-col gap-2 mt-1 min-w-[200px]">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded text-slate-200 outline-none p-1.5 focus:border-cyan-400 font-mono text-xs resize-none"
                        rows={2}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setEditingMessageId(null); setEditingText(""); }}
                          className="px-2 py-1 bg-slate-850 hover:bg-slate-800 text-slate-400 rounded text-[10px] cursor-pointer border border-slate-800 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(msg._id)}
                          className="px-2 py-1 bg-cyan-500 hover:bg-cyan-400 text-[#07080b] font-bold rounded text-[10px] cursor-pointer transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    msg.text ? <p className="whitespace-pre-wrap break-words">{msg.text}</p> : null
                  )}

                  {/* Shared Code Snippet */}
                  {hasSnippet && (
                    <CodeSnippet code={msg.code || ""} language={msg.codeLanguage || "js"} />
                  )}
                </div>

                {/* Time stamps */}
                <span className="text-[8px] text-slate-600 mt-1 select-none pr-1 pl-1 flex items-center gap-1.5">
                  <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.updatedAt && new Date(msg.updatedAt).getTime() - new Date(msg.createdAt).getTime() > 1000 && (
                    <span className="text-yellow-500/60 font-semibold uppercase tracking-wider text-[7px] bg-yellow-500/5 px-1 py-0.5 rounded border border-yellow-500/10">
                      EDITED
                    </span>
                  )}
                </span>
              </div>
            );
          })
        )}
        {showTypingIndicator && (
          <div className="self-start flex flex-col gap-1.5 max-w-[85%] md:max-w-[75%] pl-1 py-1 select-none">
            {activeTypingUsers.map((u) => {
              const typingUserObj = users.find((user) => user._id === u.userId);
              const userAvatar = typingUserObj?.avatar || "avatar-terminal";
              return (
                <div key={u.userId} className="flex items-center gap-2.5 bg-theme-sidebar border border-theme-accent/20 px-3 py-2 rounded-xl rounded-tl-none shadow-[0_0_15px_rgba(0,240,255,0.02)]">
                  <AvatarRenderer avatar={userAvatar} size={24} />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-theme-accent/75 font-semibold uppercase tracking-wider">
                      @{u.username} is compiling payload
                    </span>
                    <div className="flex gap-1 items-center">
                      <span className="hl-typing-dot" />
                      <span className="hl-typing-dot" />
                      <span className="hl-typing-dot" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll Bottom Button */}
      {showScrollBottomBtn && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-24 right-6 bg-theme-header text-theme-accent border border-theme hover:border-theme-accent/50 p-2 rounded-full cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)] z-20"
          title="Scroll to bottom"
        >
          <ArrowDown size={16} />
        </button>
      )}

      {/* Media & Code Snippet composing preview banner */}
      {(compressedImage || isCompressing) && (
        <div className="p-2.5 md:p-3 bg-theme-sidebar border-t border-theme flex items-center justify-between gap-2 md:gap-3 text-xs">
          <div className="flex items-center gap-3 min-w-0">
            {compressedImage ? (
              <div className="w-10 h-10 border border-slate-800 rounded overflow-hidden bg-black flex-shrink-0">
                <img src={compressedImage} alt="Upload preview" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-10 h-10 border border-slate-800 rounded bg-black flex items-center justify-center flex-shrink-0 animate-pulse text-cyan-400">
                <ImageIcon size={16} />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-slate-300 truncate">
                {isCompressing ? "ENCODING IMAGE PAYLOAD..." : "IMAGE READY FOR TRANSMISSION"}
              </span>
              <span className="text-[10px] text-green-400 truncate mt-0.5">
                {isCompressing ? "Resizing nodes..." : compressionRatioMsg}
              </span>
            </div>
          </div>
          <button 
            onClick={clearImageSelection} 
            className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800/60 rounded cursor-pointer flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Git Commit status bar notification overlay */}
      {gitCommitMsg && (
        <div className="px-4 py-1.5 bg-theme-sidebar border-t border-theme/40 text-[10px] text-green-400 font-mono flex items-center gap-2 animate-slide-up select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span>{gitCommitMsg}</span>
        </div>
      )}

      {/* Message Composer Footer bar */}
      <div className="p-3 md:p-4 border-t border-theme bg-theme-sidebar">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 md:gap-3">
          
          {/* Compressor Image picker */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
            id="chat-image-upload"
            disabled={isSending || isCompressing}
          />
          <label
            htmlFor="chat-image-upload"
            className="p-2 border border-theme hover:border-theme-accent/50 hover:bg-theme-header text-slate-400 hover:text-theme-accent rounded-lg cursor-pointer transition-all active:scale-95 flex-shrink-0"
            title="Attach compressed image (storage saver)"
          >
            <ImageIcon size={18} />
          </label>

          {/* Code block composer trigger */}
          <button
            type="button"
            onClick={() => { setShowCodeModal(true); setEditorTab("write"); }}
            className="p-2 border border-theme hover:border-theme-accent/50 hover:bg-theme-header text-slate-400 hover:text-theme-accent rounded-lg cursor-pointer transition-all active:scale-95 flex-shrink-0"
            title="Share syntax highlighted code block"
          >
            <Code size={18} />
          </button>

          {/* Text Message Composer */}
          <input
            type="text"
            value={textInput}
            onChange={(e) => {
              setTextInput(e.target.value);
              handleTypingPulse();
            }}
            placeholder={compressedImage ? "Caption..." : "Type a message..."}
            className="flex-1 min-w-0 w-full px-3 md:px-4 py-2 bg-theme-input border border-theme focus:border-theme-accent rounded-lg text-slate-200 placeholder-slate-700 outline-none text-xs transition-colors"
            disabled={isSending || isCompressing}
          />

          {/* Send Broadcast */}
          <button
            type="submit"
            disabled={isSending || isCompressing || (!textInput.trim() && !compressedImage)}
            className="p-2 bg-theme-accent hover:bg-theme-accent-hover text-slate-950 font-bold rounded-lg transition-colors cursor-pointer active:scale-95 flex-shrink-0 flex items-center justify-center w-9 h-9"
            title="Broadcast payload"
          >
            {isSending ? (
              <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>
      </div>

      {/* Code Snippet Composer Modal overlay */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-theme-sidebar border border-theme-accent/40 rounded-xl p-6 shadow-[0_0_40px_rgba(189,147,249,0.15)] flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-theme pb-3 mb-2 select-none">
              <span className="text-xs font-bold text-theme-accent flex items-center gap-1.5">
                <Code size={14} />
                <span>CODEBLOCK STRUCT COMPILER</span>
              </span>
              <button onClick={() => setShowCodeModal(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {/* Editor Mode Tabs */}
            <div className="flex border-b border-theme text-[10px] mb-3 select-none">
              <button
                type="button"
                onClick={() => setEditorTab("write")}
                className={`px-4 py-2 font-bold cursor-pointer transition-colors tracking-wider ${
                  editorTab === "write"
                    ? "border-b-2 border-theme-accent text-theme-accent"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                WRITE (EDITOR)
              </button>
              <button
                type="button"
                onClick={() => setEditorTab("preview")}
                className={`px-4 py-2 font-bold cursor-pointer transition-colors tracking-wider ${
                  editorTab === "preview"
                    ? "border-b-2 border-theme-accent text-theme-accent"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                PREVIEW (COMPILATION)
              </button>
            </div>

            <form onSubmit={handleSendCodeSnippet} className="flex flex-col gap-4 flex-1 min-h-0 text-xs">
              
              {/* Language + Caption settings */}
              <div className="grid grid-cols-2 gap-3 select-none">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Programming Language</label>
                  <select
                    value={codeLanguage}
                    onChange={(e) => setCodeLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-theme-input border border-theme rounded text-slate-200 outline-none focus:border-theme-accent cursor-pointer"
                  >
                    <option value="js">JavaScript</option>
                    <option value="ts">TypeScript</option>
                    <option value="py">Python</option>
                    <option value="cpp">C++</option>
                    <option value="c">C</option>
                    <option value="java">Java</option>
                    <option value="react">React / JSX</option>
                    <option value="nextjs">Next.js / TSX</option>
                    <option value="node">Node.js</option>
                    <option value="rust">Rust</option>
                    <option value="go">Go</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="sql">SQL</option>
                    <option value="json">JSON</option>
                    <option value="bash">Bash / Shell</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Code Description (Optional)</label>
                  <input
                    type="text"
                    value={codeCaption}
                    onChange={(e) => setCodeCaption(e.target.value)}
                    placeholder="e.g. Configured express server"
                    className="w-full px-3 py-2 bg-theme-input border border-theme rounded text-slate-200 outline-none focus:border-theme-accent"
                  />
                </div>
              </div>

              {/* Code input text area or preview pane */}
              {editorTab === "write" ? (
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="text-[10px] text-slate-500 uppercase font-bold mb-1.5 select-none">
                    Write Code Block
                  </label>
                  <div className="flex border border-theme rounded-lg bg-theme-input overflow-hidden font-mono text-[11px] relative h-[220px]">
                    {/* Line numbers column */}
                    <div 
                      ref={lineNumbersRef}
                      className="py-3 text-right text-slate-700 select-none pr-3 pl-2 border-r border-theme bg-[#090a0f] flex flex-col text-[11px] overflow-hidden h-full"
                    >
                      {codeSnippet.split("\n").map((_, i) => (
                        <span key={i} className="min-w-[16px] leading-[18px]">
                          {i + 1}
                        </span>
                      ))}
                    </div>
                    {/* Main input text area */}
                    <textarea
                      value={codeSnippet}
                      onChange={(e) => setCodeSnippet(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onScroll={handleEditorScroll}
                      placeholder={`function compileNode() {
  console.log('Deploying chat payload...');
}`}
                      required
                      className="flex-1 p-3 bg-transparent text-slate-200 outline-none resize-none border-0 m-0 overflow-y-auto leading-[18px] h-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-[180px] overflow-y-auto scrollbar-thin">
                  <label className="text-[10px] text-slate-500 uppercase font-bold mb-1.5 select-none">
                    {theme.toUpperCase()} Theme Output Preview
                  </label>
                  {codeSnippet.trim() ? (
                    <div className="border border-theme/40 rounded-lg overflow-hidden bg-theme-input p-1">
                      <CodeSnippet code={codeSnippet} language={codeLanguage} />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 border border-dashed border-theme rounded-lg text-slate-600 text-[11px]">
                      No code content written to preview.
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <button
                type="submit"
                disabled={isSending || !codeSnippet.trim()}
                className="w-full py-3 bg-theme-accent hover:bg-theme-accent-hover disabled:opacity-50 text-slate-950 font-bold rounded cursor-pointer transition-colors uppercase tracking-widest text-center flex items-center justify-center gap-1.5"
              >
                {isSending ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-[#07080b] border-t-transparent rounded-full animate-spin" />
                    <span>BROADCASTING...</span>
                  </>
                ) : (
                  <span>COMPILE & BROADCAST SNIPPET</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Overlay Modal */}
      {lightboxImageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm select-none"
          onClick={() => setLightboxImageUrl(null)}
        >
          {/* Top action header */}
          <div className="absolute top-4 right-4 flex gap-3 z-10" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => downloadBase64Image(lightboxImageUrl, `devconnect-image-download.jpg`)}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-green-400 px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 text-xs font-semibold shadow-lg transition-all active:scale-95"
              title="Download image"
            >
              <Download size={15} />
              <span>Download</span>
            </button>
            <button 
              onClick={() => setLightboxImageUrl(null)}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-red-400 p-2 rounded-lg cursor-pointer shadow-lg transition-all active:scale-95"
              title="Close viewer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Fullscreen Image */}
          <div className="max-w-full max-h-[85vh] flex items-center justify-center relative animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <img 
              src={lightboxImageUrl} 
              alt="Preview full scale" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg border border-slate-850 shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Mobile Actions Bottom Sheet Modal */}
      {activeActionMessage && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center animate-backdrop-fade"
          onClick={() => setActiveActionMessage(null)}
        >
          <div 
            className="bg-[#0d0e12] border-t border-slate-800 rounded-t-2xl w-full max-w-md p-5 flex flex-col gap-4 animate-slide-up pb-8 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle/Indicator */}
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-2" />
            
            {/* Header / Message Info */}
            <div className="flex flex-col gap-1 border-b border-slate-800 pb-3">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                {activeActionMessage.senderId === currentUser._id ? "YOUR MESSAGE" : `MESSAGE FROM @${activeActionMessage.senderName || "DEVELOPER"}`}
              </span>
              <p className="text-xs text-slate-300 truncate max-w-full italic">
                {activeActionMessage.text || (activeActionMessage.image ? "[Compressed Image]" : activeActionMessage.code ? "[Code Block]" : "")}
              </p>
            </div>

            {/* Actions List */}
            <div className="flex flex-col gap-2">
              {activeActionMessage.text && (
                <button
                  onClick={() => {
                    handleCopyMessageText(activeActionMessage._id, activeActionMessage.text);
                    setActiveActionMessage(null);
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-cyan-400 cursor-pointer active:scale-99 transition-all text-xs font-semibold"
                >
                  <Copy size={16} />
                  <span>Copy Message Text</span>
                </button>
              )}

              {activeActionMessage.image && (
                <button
                  onClick={() => {
                    downloadBase64Image(activeActionMessage.image!, `devconnect-image-${activeActionMessage._id}.jpg`);
                    setActiveActionMessage(null);
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-[#090a0f] hover:bg-[#11131c] border border-slate-800 rounded-xl text-slate-300 hover:text-green-400 cursor-pointer active:scale-99 transition-all text-xs font-semibold"
                >
                  <Download size={16} />
                  <span>Download Image</span>
                </button>
              )}

              {activeActionMessage.senderId === currentUser._id && (
                <button
                  onClick={() => {
                    setEditingMessageId(activeActionMessage._id);
                    setEditingText(activeActionMessage.text || "");
                    setActiveActionMessage(null);
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-[#090a0f] hover:bg-[#11131c] border border-slate-800 rounded-xl text-slate-300 hover:text-yellow-400 cursor-pointer active:scale-99 transition-all text-xs font-semibold"
                >
                  <Edit2 size={16} />
                  <span>Edit Message</span>
                </button>
              )}

              {activeActionMessage.senderId === currentUser._id && (
                <button
                  onClick={() => {
                    const msgId = activeActionMessage._id;
                    setActiveActionMessage(null);
                    showConfirm(
                      "PURGE MESSAGE NODE",
                      "Are you sure you want to permanently delete this message from the registry logs?",
                      () => {
                        deleteMessage(msgId);
                      }
                    );
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-[#090a0f] hover:bg-[#11131c] border border-red-950/20 hover:border-red-500/20 text-slate-300 hover:text-red-400 cursor-pointer active:scale-99 transition-all text-xs font-semibold"
                >
                  <Trash2 size={16} className="text-red-500/80" />
                  <span className="text-red-400/90">Delete Message</span>
                </button>
              )}
              
              <button
                onClick={() => setActiveActionMessage(null)}
                className="w-full p-3 bg-slate-900 hover:bg-slate-850 text-slate-400 rounded-xl cursor-pointer active:scale-99 transition-all text-xs font-semibold text-center mt-2 border border-slate-800/80"
              >
                Cancel
              </button>
            </div>
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
    </div>
  );
}
