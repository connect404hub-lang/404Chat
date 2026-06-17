"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { formatBytes } from "./imageCompressor";

export interface UserType {
  _id: string; // handle
  username: string; // display name
  avatar: string; // SVG avatar type or base64
  status: string;
  mobileNumber: string; // unencrypted mobile number
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatType {
  _id: string;
  type: "private" | "group";
  name?: string;
  avatar?: string;
  members: UserType[];
  createdAt: string;
  updatedAt: string;
  lastMessage?: MessageType | null;
}

export interface MessageType {
  _id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  code?: string;
  codeLanguage?: string;
  image?: string; // compressed base64
  createdAt: string;
  updatedAt: string;
}

export interface StoryType {
  _id: string;
  userId: string;
  username: string;
  userAvatar: string;
  image?: string; // base64 compressed data (optional for text-only)
  bgGradient?: string; // custom gradient for text statuses
  caption?: string;
  musicTrack?: {
    title: string;
    artist: string;
    previewUrl: string;
    artworkUrl?: string;
  };
  createdAt: string;
  expiresAt: string;
}

interface ChatContextType {
  currentUser: UserType | null;
  users: UserType[];
  chats: ChatType[];
  activeChatId: string | null;
  activeChat: ChatType | null;
  messages: MessageType[];
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  isConnecting: boolean;
  isLocalOnly: boolean; // True if MongoDB is unreachable
  login: (handle: string, password: string) => Promise<boolean>;
  signup: (handle: string, username: string, password: string, avatar: string, mobileNumber?: string) => Promise<boolean>;
  resetDatabase: () => Promise<boolean>;
  updateProfile: (username: string, status: string, avatar?: string, mobileNumber?: string) => Promise<boolean>;
  createPrivateChat: (recipientId: string) => Promise<string | null>;
  createGroupChat: (name: string, members: string[], avatar: string) => Promise<string | null>;
  sendChatMessage: (text: string, code?: string, codeLanguage?: string, image?: string) => Promise<boolean>;
  selectChat: (chatId: string | null) => void;
  logout: () => void;
  refreshChats: () => Promise<void>;
  stories: StoryType[];
  refreshStories: () => Promise<void>;
  uploadStory: (image?: string | null, caption?: string, musicTrack?: StoryType["musicTrack"], bgGradient?: string) => Promise<boolean>;
  deleteStory: (storyId: string) => Promise<boolean>;
  confirmMessage: { title: string; message: string; onConfirm: () => void; onCancel?: () => void } | null;
  showConfirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => void;
  closeConfirm: () => void;
  refreshUsers: () => Promise<void>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  editMessage: (messageId: string, text: string) => Promise<boolean>;
  typingStates: Record<string, { userId: string; username: string }[]>;
  sendTypingStatus: (chatId: string, isTyping: boolean) => Promise<void>;
  alertMessage: { title: string; message: string; type: "error" | "info" | "success" } | null;
  showAlert: (title: string, message: string, type?: "error" | "info" | "success") => void;
  closeAlert: () => void;
  theme: string;
  setTheme: (theme: string) => void;
  matrixRain: boolean;
  setMatrixRain: (val: boolean) => void;
  crtEffect: boolean;
  setCrtEffect: (val: boolean) => void;
  gitMergeAnim: boolean;
  setGitMergeAnim: (val: boolean) => void;
}

function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Dual synth beep (retro developer feel)
    const playBeep = (time: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);
      
      gain.gain.setValueAtTime(0.08, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(time);
      osc.stop(time + 0.15);
    };
    
    const now = ctx.currentTime;
    playBeep(now, 800);
    playBeep(now + 0.08, 1200);
  } catch (e) {
    console.warn("Failed to play synth notification sound", e);
  }
}

function showWebNotification(msg: MessageType) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  
  if (Notification.permission === "granted") {
    try {
      const bodyText = msg.code ? `[Code Snippet: ${msg.codeLanguage}] ${msg.text}` : msg.text;
      const notification = new Notification(`@${msg.senderName}`, {
        body: bodyText,
        icon: "/favicon.ico",
      });
      
      notification.onclick = () => {
        window.focus();
      };
    } catch (e) {
      console.warn("Failed to trigger Web Notification", e);
    }
  }
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [chats, setChats] = useState<ChatType[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  
  // Track if we fall back to localStorage due to database connection refusal
  const [isLocalOnly, setIsLocalOnly] = useState(false);

  // chatId -> array of users typing in that chat
  const [typingStates, setTypingStates] = useState<Record<string, { userId: string; username: string }[]>>({});
  const [alertMessage, setAlertMessage] = useState<{ title: string; message: string; type: "error" | "info" | "success" } | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<{ title: string; message: string; onConfirm: () => void; onCancel?: () => void } | null>(null);

  // Stories state
  const [stories, setStories] = useState<StoryType[]>([]);
  const storiesRef = useRef<StoryType[]>([]);
  storiesRef.current = stories;

  // Theme & Animation states
  const [theme, setThemeState] = useState<string>("dracula");
  const [matrixRain, setMatrixRainState] = useState<boolean>(false);
  const [crtEffect, setCrtEffectState] = useState<boolean>(false);
  const [gitMergeAnim, setGitMergeAnimState] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("devconnect_theme") || "dracula";
      const savedMatrix = localStorage.getItem("devconnect_matrixRain") === "true";
      const savedCrt = localStorage.getItem("devconnect_crtEffect") === "true";
      const savedGit = localStorage.getItem("devconnect_gitMergeAnim") !== "false";
      
      setThemeState(savedTheme);
      setMatrixRainState(savedMatrix);
      setCrtEffectState(savedCrt);
      setGitMergeAnimState(savedGit);
      document.body.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const setTheme = (newTheme: string) => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("devconnect_theme", newTheme);
      document.body.setAttribute("data-theme", newTheme);
    }
  };

  const setMatrixRain = (val: boolean) => {
    setMatrixRainState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("devconnect_matrixRain", String(val));
    }
  };

  const setCrtEffect = (val: boolean) => {
    setCrtEffectState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("devconnect_crtEffect", String(val));
    }
  };

  const setGitMergeAnim = (val: boolean) => {
    setGitMergeAnimState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("devconnect_gitMergeAnim", String(val));
    }
  };

  const showAlert = (title: string, message: string, type: "error" | "info" | "success" = "info") => {
    setAlertMessage({ title, message, type });
  };

  const closeAlert = () => {
    setAlertMessage(null);
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
    setConfirmMessage({ title, message, onConfirm, onCancel });
  };

  const closeConfirm = () => {
    setConfirmMessage(null);
  };

  // Sync refs to access state in intervals without dependency loops
  const activeChatIdRef = useRef<string | null>(null);
  activeChatIdRef.current = activeChatId;
  const currentUserRef = useRef<UserType | null>(null);
  currentUserRef.current = currentUser;
  const messagesRef = useRef<MessageType[]>([]);
  messagesRef.current = messages;
  const isLocalOnlyRef = useRef<boolean>(false);
  isLocalOnlyRef.current = isLocalOnly;

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Helper: Get local data
  const getLocalData = (key: string): any[] => {
    if (typeof window === "undefined") return [];
    const val = localStorage.getItem(`devconnect_fallback_${key}`);
    return val ? JSON.parse(val) : [];
  };

  // Helper: Save local data
  const saveLocalData = (key: string, data: any[]) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`devconnect_fallback_${key}`, JSON.stringify(data));
  };

  const refreshStories = async () => {
    if (isLocalOnlyRef.current) {
      const localStories = getLocalData("stories") as StoryType[];
      const now = Date.now();
      const active = localStories.filter((s) => new Date(s.expiresAt).getTime() > now);
      setStories(active);
      return;
    }

    try {
      const res = await fetch("/api/stories");
      const data = await res.json();
      if (!data.error) {
        setStories(data);
      } else {
        setIsLocalOnly(true);
      }
    } catch (e) {
      console.warn("Failed to fetch stories from API, falling back to local storage.", e);
      setIsLocalOnly(true);
      const localStories = getLocalData("stories") as StoryType[];
      const now = Date.now();
      const active = localStories.filter((s) => new Date(s.expiresAt).getTime() > now);
      setStories(active);
    }
  };

  // Fetch users list
  const refreshUsers = async () => {
    if (isLocalOnlyRef.current) {
      // Offline fallback
      const localUsers = getLocalData("users");
      const filtered = localUsers.filter((u: UserType) => u._id !== currentUserRef.current?._id);
      setUsers(filtered);
      return;
    }

    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!data.error) {
        const filtered = data.filter((u: UserType) => u._id !== currentUserRef.current?._id);
        setUsers(filtered);
      } else {
        setIsLocalOnly(true);
      }
    } catch (e) {
      console.warn("Users query threw. Falling back to local users listing.", e);
      setIsLocalOnly(true);
      // load local
      const localUsers = getLocalData("users");
      const filtered = localUsers.filter((u: UserType) => u._id !== currentUserRef.current?._id);
      setUsers(filtered);
    }
  };

  // Fetch active chats list
  const refreshChats = async () => {
    if (!currentUserRef.current) return;

    if (isLocalOnlyRef.current) {
      // Offline fallback
      const localChats = getLocalData("chats") as ChatType[];
      // Filter chats where members array contains user handle
      const userChats = localChats.filter((c) => c.members.some((m) => m._id === currentUserRef.current?._id));
      setChats(userChats);
      return;
    }

    try {
      const res = await fetch(`/api/chats?userId=${currentUserRef.current._id}`);
      const data = await res.json();
      if (!data.error) {
        setChats(data);
      } else {
        setIsLocalOnly(true);
      }
    } catch (e) {
      console.warn("Chats query threw. Falling back to local chats listing.", e);
      setIsLocalOnly(true);
      // load local
      const localChats = getLocalData("chats") as ChatType[];
      const userChats = localChats.filter((c) => c.members.some((m) => m._id === currentUserRef.current?._id));
      setChats(userChats);
    }
  };

  // One-time session restoration
  useEffect(() => {
    const savedUser = localStorage.getItem("devconnect_session");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        
        // Test database connectivity by attempting to register session
        fetch(`/api/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: parsed._id || parsed.id,
            _id: parsed._id || parsed.id,
            username: parsed.username,
            avatar: parsed.avatar,
            status: parsed.status,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.error) {
              console.warn("DB returned error, falling back to Local Mode:", data.error);
              setIsLocalOnly(true);
            } else {
              setCurrentUser(data);
              localStorage.setItem("devconnect_session", JSON.stringify(data));
              setIsLocalOnly(false);
            }
          })
          .catch((err) => {
            console.warn("Failed to reach API server. Operating in Local Mode.", err);
            setIsLocalOnly(true);
          });
      } catch (e) {
        localStorage.removeItem("devconnect_session");
      }
    }
    setIsConnecting(false);
  }, []);

  // Request notification permission when user connects
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, [currentUser]);

  // Set up BroadcastChannel for instant same-browser multi-tab syncing
  useEffect(() => {
    const channel = new BroadcastChannel("devconnect_channel");
    broadcastChannelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, data } = event.data;
      if (type === "NEW_MESSAGE") {
        const msg = data as MessageType;
        // If the message is for the active chat, append it
        if (msg.chatId === activeChatIdRef.current) {
          if (!messagesRef.current.some((m) => m._id === msg._id)) {
            setMessages((prev) => [...prev, msg]);
          }
        }
        
        // Notify if message is from another user
        if (msg.senderId !== currentUserRef.current?._id) {
          playNotificationSound();
          if (document.hidden || msg.chatId !== activeChatIdRef.current) {
            showWebNotification(msg);
          }
        }
        
        refreshChats();
      } else if (type === "DELETE_MESSAGE") {
        const { messageId } = data;
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      } else if (type === "EDIT_MESSAGE") {
        const { messageId, text, updatedAt } = data;
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? { ...m, text, updatedAt } : m))
        );
      } else if (type === "NEW_CHAT") {
        refreshChats();
      } else if (type === "USER_UPDATED") {
        refreshUsers();
        refreshChats();
      } else if (type === "NEW_STORY") {
        const story = data as StoryType;
        setStories((prev) => {
          if (!prev.some((s) => s._id === story._id)) {
            return [...prev, story];
          }
          return prev;
        });
      } else if (type === "DELETE_STORY") {
        const { storyId } = data;
        setStories((prev) => prev.filter((s) => s._id !== storyId));
      }
    };

    return () => {
      channel.close();
    };
  }, []);



  // Initial loads when user connects
  useEffect(() => {
    if (currentUser) {
      setIsLoadingChats(true);
      Promise.all([refreshChats(), refreshUsers(), refreshStories()]).finally(() => {
        setIsLoadingChats(false);
      });
    } else {
      setChats([]);
      setUsers([]);
      setMessages([]);
      setActiveChatId(null);
    }
  }, [currentUser, isLocalOnly]);

  // Load messages when active chat changes
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }

    if (isLocalOnly) {
      const allMsgs = getLocalData("messages") as MessageType[];
      const filtered = allMsgs.filter((m) => m.chatId === activeChatId);
      setMessages(filtered);
      return;
    }

    setIsLoadingMessages(true);
    fetch(`/api/messages?chatId=${activeChatId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setMessages(data);
        } else {
          setIsLocalOnly(true);
        }
      })
      .catch((err) => {
        console.warn("Fetch messages threw. Loading locally.", err);
        setIsLocalOnly(true);
        const allMsgs = getLocalData("messages") as MessageType[];
        const filtered = allMsgs.filter((m) => m.chatId === activeChatId);
        setMessages(filtered);
      })
      .finally(() => {
        setIsLoadingMessages(false);
      });
  }, [activeChatId, isLocalOnly]);

  // Polling Sync Loops (Only run if connected to database)
  useEffect(() => {
    if (!currentUser) return;

    // Poll active DB only if not in local-only mode
    const chatInterval = setInterval(() => {
      if (!isLocalOnlyRef.current) refreshChats();
    }, 5000);

    const msgInterval = setInterval(() => {
      if (isLocalOnlyRef.current) return;
      const curActiveId = activeChatIdRef.current;
      if (!curActiveId) return;

      const currentMsgs = messagesRef.current;
      const lastMsgDate =
        currentMsgs.length > 0
          ? currentMsgs[currentMsgs.length - 1].createdAt
          : new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

      fetch(`/api/messages?chatId=${curActiveId}&since=${lastMsgDate}`)
        .then((res) => res.json())
        .then((newMsgs) => {
          if (newMsgs && newMsgs.length > 0 && !newMsgs.error) {
            let hasIncoming = false;
            setMessages((prev) => {
              const merged = [...prev];
              newMsgs.forEach((m: MessageType) => {
                if (!merged.some((existing) => existing._id === m._id)) {
                  merged.push(m);
                  if (m.senderId !== currentUserRef.current?._id) {
                    hasIncoming = true;
                    if (document.hidden) {
                      showWebNotification(m);
                    }
                  }
                }
              });
              return merged;
            });
            
            if (hasIncoming) {
              playNotificationSound();
            }
            
            refreshChats();
          }
        })
        .catch(() => {});
    }, 2500);

    // 3. Poll full active chat messages list every 6 seconds to capture edits/deletions
    const fullMsgInterval = setInterval(() => {
      if (isLocalOnlyRef.current) return;
      const curActiveId = activeChatIdRef.current;
      if (!curActiveId) return;

      fetch(`/api/messages?chatId=${curActiveId}`)
        .then((res) => res.json())
        .then((allMsgs) => {
          if (allMsgs && !allMsgs.error && Array.isArray(allMsgs)) {
            setMessages((prev) => {
              const hasChange = prev.length !== allMsgs.length || 
                prev.some((m, idx) => allMsgs[idx] && (m.text !== allMsgs[idx].text || m.updatedAt !== allMsgs[idx].updatedAt));
              return hasChange ? allMsgs : prev;
            });
          }
        })
        .catch(() => {});
    }, 6000);

    // 4. Poll typing status across all channels every 2.5 seconds
    const typingInterval = setInterval(() => {
      if (isLocalOnlyRef.current || !currentUserRef.current) return;

      fetch(`/api/chats/typing?userId=${currentUserRef.current._id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            setTypingStates(data);
          }
        })
        .catch(() => {});
    }, 2500);

    // 5. Poll active stories list every 10 seconds (filters out expired ones)
    const storyInterval = setInterval(() => {
      refreshStories();
    }, 10000);

    return () => {
      clearInterval(chatInterval);
      clearInterval(msgInterval);
      clearInterval(fullMsgInterval);
      clearInterval(typingInterval);
      clearInterval(storyInterval);
    };
  }, [currentUser]);

  // ACTIONS

  const login = async (handle: string, password: string) => {
    const cleanId = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!cleanId) return false;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: cleanId, password }),
      });
      const data = await res.json();
      
      if (!data.error) {
        setCurrentUser(data);
        localStorage.setItem("devconnect_session", JSON.stringify(data));
        broadcastChannelRef.current?.postMessage({ type: "USER_UPDATED", data: data });
        setIsLocalOnly(false);
        return true;
      } else {
        showAlert("AUTHENTICATION ERROR", data.error, "error");
        return false;
      }
    } catch (e) {
      console.warn("DB connection refused. Logging in offline via Local Mode.", e);
    }

    // Fallback local login
    setIsLocalOnly(true);
    const localUsers = getLocalData("users") as UserType[];
    const user = localUsers.find((u) => u._id === cleanId);
    if (!user) {
      showAlert("OFFLINE LOGIN ERROR", "Local account not found in index database. Please register first.", "error");
      return false;
    }
    setCurrentUser(user);
    localStorage.setItem("devconnect_session", JSON.stringify(user));
    broadcastChannelRef.current?.postMessage({ type: "USER_UPDATED", data: user });
    return true;
  };

  const signup = async (
    handle: string,
    username: string,
    password: string,
    avatar: string,
    mobileNumber?: string
  ) => {
    const cleanId = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!cleanId) return false;

    const mockUser: UserType = {
      _id: cleanId,
      username,
      avatar,
      status: "Coding...",
      mobileNumber: mobileNumber || "",
    };

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: cleanId, username, password, avatar, mobileNumber }),
      });
      const data = await res.json();
      if (!data.error) {
        setCurrentUser(data);
        localStorage.setItem("devconnect_session", JSON.stringify(data));
        broadcastChannelRef.current?.postMessage({ type: "USER_UPDATED", data: data });
        setIsLocalOnly(false);
        return true;
      } else {
        showAlert("SIGNUP ERROR", data.error, "error");
        return false;
      }
    } catch (e) {
      console.warn("Failed to sign up online. Committing offline.", e);
    }

    // Fallback local signup
    setIsLocalOnly(true);
    const localUsers = getLocalData("users") as UserType[];
    if (localUsers.some((u) => u._id === cleanId)) {
      showAlert("LOCAL SIGNUP COLLISION", "Developer handle is already registered in local storage database.", "error");
      return false;
    }
    
    setCurrentUser(mockUser);
    localStorage.setItem("devconnect_session", JSON.stringify(mockUser));
    localUsers.push(mockUser);
    saveLocalData("users", localUsers);

    broadcastChannelRef.current?.postMessage({ type: "USER_UPDATED", data: mockUser });
    return true;
  };

  const resetDatabase = async () => {
    try {
      const res = await fetch("/api/admin/reset", { method: "POST" });
      const data = await res.json();
      if (!data.error) {
        logout();
        showAlert("SYSTEM RESET COMPLETED", "Database nodes successfully purged. Synchronized state reset.", "success");
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const updateProfile = async (username: string, status: string, avatar?: string, mobileNumber?: string) => {
    if (!currentUser) return false;
    const finalAvatar = avatar || currentUser.avatar;
    const finalMobile = mobileNumber || currentUser.mobileNumber;

    const updatedUser: UserType = {
      ...currentUser,
      username,
      status,
      avatar: finalAvatar,
      mobileNumber: finalMobile,
    };

    if (!isLocalOnly) {
      try {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: currentUser._id,
            username,
            avatar: finalAvatar,
            status,
            mobileNumber: finalMobile,
          }),
        });
        const data = await res.json();
        if (!data.error) {
          setCurrentUser(data);
          localStorage.setItem("devconnect_session", JSON.stringify(data));
          broadcastChannelRef.current?.postMessage({ type: "USER_UPDATED", data: data });
          return true;
        } else {
          showAlert("PROFILE UPDATE FAILED", `Failed to update profile: ${data.error}`, "error");
          return false;
        }
      } catch (e) {
        console.warn("Profile update failed to sync online, updating locally.", e);
      }
    }

    // Local update
    setCurrentUser(updatedUser);
    localStorage.setItem("devconnect_session", JSON.stringify(updatedUser));
    
    const localUsers = getLocalData("users") as UserType[];
    const index = localUsers.findIndex((u) => u._id === currentUser._id);
    if (index !== -1) {
      localUsers[index] = updatedUser;
    } else {
      localUsers.push(updatedUser);
    }
    saveLocalData("users", localUsers);

    // Update active chats profile mappings locally
    const localChats = getLocalData("chats") as ChatType[];
    const updatedChats = localChats.map((c) => {
      const memberIdx = c.members.findIndex((m) => m._id === currentUser._id);
      if (memberIdx !== -1) {
        c.members[memberIdx] = updatedUser;
      }
      return c;
    });
    saveLocalData("chats", updatedChats);

    broadcastChannelRef.current?.postMessage({ type: "USER_UPDATED", data: updatedUser });
    return true;
  };

  const createPrivateChat = async (recipientId: string) => {
    if (!currentUser) return null;

    if (!isLocalOnly) {
      try {
        const res = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "private",
            members: [currentUser._id, recipientId],
          }),
        });
        const data = await res.json();
        if (!data.error) {
          setChats((prev) => {
            if (prev.some((c) => c._id === data._id)) return prev;
            return [data, ...prev];
          });
          setActiveChatId(data._id);
          broadcastChannelRef.current?.postMessage({ type: "NEW_CHAT", data: data });
          return data._id;
        }
      } catch (e) {
        console.warn("Failed to create private chat online. Creating locally.", e);
      }
    }

    // Local Chat creation
    const localUsers = getLocalData("users") as UserType[];
    const recipient = localUsers.find((u) => u._id === recipientId) || {
      _id: recipientId,
      username: recipientId,
      avatar: "avatar-terminal",
      status: "Offline",
      mobileNumber: "",
    };

    const localChats = getLocalData("chats") as ChatType[];
    
    // Check if duplicate private chat exists locally
    const existing = localChats.find(
      (c) => c.type === "private" && 
      c.members.some((m) => m._id === currentUser._id) && 
      c.members.some((m) => m._id === recipientId)
    );

    if (existing) {
      setActiveChatId(existing._id);
      return existing._id;
    }

    const mockChatId = `chat-local-${Date.now()}`;
    const newChat: ChatType = {
      _id: mockChatId,
      type: "private",
      members: [currentUser, recipient],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localChats.unshift(newChat);
    saveLocalData("chats", localChats);
    
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(mockChatId);
    broadcastChannelRef.current?.postMessage({ type: "NEW_CHAT", data: newChat });
    return mockChatId;
  };

  const createGroupChat = async (name: string, members: string[], avatar: string) => {
    if (!currentUser) return null;
    const allMembersList = Array.from(new Set([currentUser._id, ...members]));

    if (!isLocalOnly) {
      try {
        const res = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "group",
            name,
            avatar,
            members: allMembersList,
          }),
        });
        const data = await res.json();
        if (!data.error) {
          setChats((prev) => [data, ...prev]);
          setActiveChatId(data._id);
          broadcastChannelRef.current?.postMessage({ type: "NEW_CHAT", data: data });
          return data._id;
        }
      } catch (e) {
        console.warn("Failed to spawn group cluster online. Spawning locally.", e);
      }
    }

    // Local Group creation
    const localUsers = getLocalData("users") as UserType[];
    const populatedMembers = allMembersList.map((handle) => {
      if (handle === currentUser._id) return currentUser;
      return localUsers.find((u) => u._id === handle) || {
        _id: handle,
        username: handle,
        avatar: "avatar-braces",
        status: "Offline",
        mobileNumber: "",
      };
    });

    const mockChatId = `chat-local-${Date.now()}`;
    const newChat: ChatType = {
      _id: mockChatId,
      type: "group",
      name,
      avatar,
      members: populatedMembers,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const localChats = getLocalData("chats") as ChatType[];
    localChats.unshift(newChat);
    saveLocalData("chats", localChats);

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(mockChatId);
    broadcastChannelRef.current?.postMessage({ type: "NEW_CHAT", data: newChat });
    return mockChatId;
  };

  const sendChatMessage = async (text: string, code?: string, codeLanguage?: string, image?: string) => {
    if (!currentUser || !activeChatId) return false;

    const tempId = `msg-local-${Date.now()}`;
    const mockMessage: MessageType = {
      _id: tempId,
      chatId: activeChatId,
      senderId: currentUser._id,
      senderName: currentUser.username,
      text: text || "",
      code,
      codeLanguage,
      image,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Append optimistic message
    setMessages((prev) => [...prev, mockMessage]);

    if (!isLocalOnly) {
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: activeChatId,
            senderId: currentUser._id,
            senderName: currentUser.username,
            text: text || "",
            code: code || "",
            codeLanguage: codeLanguage || "",
            image: image || "",
          }),
        });

        const data = await res.json();
        if (!data.error) {
          // Swap the optimistic message with the database message
          setMessages((prev) => prev.map((m) => (m._id === tempId ? data : m)));
          broadcastChannelRef.current?.postMessage({ type: "NEW_MESSAGE", data: data });
          refreshChats();
          return true;
        }
      } catch (e) {
        console.warn("Failed to post message online. Committing offline locally.", e);
      }
    }

    // Local commit
    const allMsgs = getLocalData("messages") as MessageType[];
    allMsgs.push(mockMessage);
    saveLocalData("messages", allMsgs);

    // Touch chat updatedAt locally
    const localChats = getLocalData("chats") as ChatType[];
    const chatIndex = localChats.findIndex((c) => c._id === activeChatId);
    if (chatIndex !== -1) {
      const touchedChat = {
        ...localChats[chatIndex],
        updatedAt: new Date().toISOString(),
        lastMessage: mockMessage,
      };
      localChats.splice(chatIndex, 1);
      localChats.unshift(touchedChat);
      saveLocalData("chats", localChats);
      setChats(localChats.filter((c) => c.members.some((m) => m._id === currentUser._id)));
    }

    broadcastChannelRef.current?.postMessage({ type: "NEW_MESSAGE", data: mockMessage });
    return true;
  };

  const selectChat = (chatId: string | null) => {
    setActiveChatId(chatId);
  };

  const deleteMessage = async (messageId: string) => {
    if (!currentUser) return false;

    // Verify ownership locally first (if message is in current state)
    const targetMsg = messages.find((m) => m._id === messageId);
    if (targetMsg && targetMsg.senderId !== currentUser._id) {
      console.warn("Unauthorized message deletion attempt");
      return false;
    }

    // Optimistic local state update
    setMessages((prev) => prev.filter((m) => m._id !== messageId));

    if (!isLocalOnly) {
      try {
        const res = await fetch(`/api/messages?messageId=${messageId}&senderId=${currentUser._id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!data.error) {
          broadcastChannelRef.current?.postMessage({
            type: "DELETE_MESSAGE",
            data: { messageId },
          });
          return true;
        }
      } catch (e) {
        console.warn("Failed to delete message online, deleting locally.", e);
      }
    }

    // Local fallback deletion
    const allMsgs = getLocalData("messages") as MessageType[];
    const localTargetMsg = allMsgs.find((m) => m._id === messageId);
    if (localTargetMsg && localTargetMsg.senderId !== currentUser._id) {
      console.warn("Unauthorized message deletion attempt locally");
      return false;
    }
    const filtered = allMsgs.filter((m) => m._id !== messageId);
    saveLocalData("messages", filtered);

    broadcastChannelRef.current?.postMessage({
      type: "DELETE_MESSAGE",
      data: { messageId },
    });
    return true;
  };

  const editMessage = async (messageId: string, text: string) => {
    if (!currentUser) return false;

    // Verify ownership locally first (if message is in current state)
    const targetMsg = messages.find((m) => m._id === messageId);
    if (targetMsg && targetMsg.senderId !== currentUser._id) {
      console.warn("Unauthorized message edit attempt");
      return false;
    }

    const updatedAtStr = new Date().toISOString();
    // Optimistic local state update
    setMessages((prev) =>
      prev.map((m) => (m._id === messageId ? { ...m, text, updatedAt: updatedAtStr } : m))
    );

    if (!isLocalOnly) {
      try {
        const res = await fetch(`/api/messages`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId,
            senderId: currentUser._id,
            text,
          }),
        });
        const data = await res.json();
        if (!data.error) {
          broadcastChannelRef.current?.postMessage({
            type: "EDIT_MESSAGE",
            data: { messageId, text, updatedAt: data.updatedAt },
          });
          return true;
        }
      } catch (e) {
        console.warn("Failed to edit message online, editing locally.", e);
      }
    }

    // Local fallback edit
    const allMsgs = getLocalData("messages") as MessageType[];
    const localTargetMsg = allMsgs.find((m) => m._id === messageId);
    if (localTargetMsg && localTargetMsg.senderId !== currentUser._id) {
      console.warn("Unauthorized message edit attempt locally");
      return false;
    }
    const updated = allMsgs.map((m) =>
      m._id === messageId ? { ...m, text, updatedAt: updatedAtStr } : m
    );
    saveLocalData("messages", updated);

    broadcastChannelRef.current?.postMessage({
      type: "EDIT_MESSAGE",
      data: { messageId, text, updatedAt: updatedAtStr },
    });
    return true;
  };

  const sendTypingStatus = async (chatId: string, isTyping: boolean) => {
    if (!currentUser || isLocalOnly) return;
    try {
      await fetch("/api/chats/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          userId: currentUser._id,
          username: currentUser.username,
          isTyping
        }),
      });
    } catch (e) {
      console.warn("Failed to update typing status:", e);
    }
  };

  const logout = () => {
    localStorage.removeItem("devconnect_session");
    setCurrentUser(null);
    setActiveChatId(null);
    setChats([]);
    setUsers([]);
    setMessages([]);
  };



  const uploadStory = async (image?: string | null, caption?: string, musicTrack?: StoryType["musicTrack"], bgGradient?: string) => {
    if (!currentUserRef.current) return false;

    const storyPayload = {
      userId: currentUserRef.current._id,
      username: currentUserRef.current.username,
      userAvatar: currentUserRef.current.avatar,
      image: image || undefined,
      bgGradient: bgGradient || "",
      caption: caption || "",
      musicTrack
    };

    if (isLocalOnlyRef.current) {
      const localStories = getLocalData("stories") as StoryType[];
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const localNewStory: StoryType = {
        _id: Math.random().toString(36).substring(2, 9),
        ...storyPayload,
        createdAt: new Date().toISOString(),
        expiresAt
      };
      const updated = [...localStories, localNewStory];
      saveLocalData("stories", updated);
      setStories(updated.filter((s) => new Date(s.expiresAt).getTime() > Date.now()));
      
      broadcastChannelRef.current?.postMessage({
        type: "NEW_STORY",
        data: localNewStory
      });
      return true;
    }

    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(storyPayload)
      });
      const data = await res.json();
      if (!data.error) {
        setStories((prev) => [...prev, data]);
        broadcastChannelRef.current?.postMessage({
          type: "NEW_STORY",
          data
        });
        return true;
      } else {
        showAlert("STORY UPLOAD FAILED", data.error, "error");
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to broadcast story.";
      showAlert("STORY UPLOAD FAILURE", msg, "error");
      return false;
    }
  };

  const deleteStory = async (storyId: string): Promise<boolean> => {
    if (isLocalOnlyRef.current) {
      const localStories = getLocalData("stories") as StoryType[];
      const updated = localStories.filter((s) => s._id !== storyId);
      saveLocalData("stories", updated);
      setStories(updated.filter((s) => new Date(s.expiresAt).getTime() > Date.now()));
      
      broadcastChannelRef.current?.postMessage({
        type: "DELETE_STORY",
        data: { storyId }
      });
      return true;
    }

    try {
      const res = await fetch(`/api/stories?storyId=${storyId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        setStories((prev) => prev.filter((s) => s._id !== storyId));
        broadcastChannelRef.current?.postMessage({
          type: "DELETE_STORY",
          data: { storyId }
        });
        return true;
      } else {
        showAlert("DELETE FAILURE", data.error || "Failed to delete story.", "error");
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to contact story node.";
      showAlert("DELETE FAILURE", msg, "error");
      return false;
    }
  };

  const activeChat = chats.find((c) => c._id === activeChatId) || null;

  return (
    <ChatContext.Provider
      value={{
        currentUser,
        users,
        chats,
        activeChatId,
        activeChat,
        messages,
        isLoadingChats,
        isLoadingMessages,
        isConnecting,
        isLocalOnly,
        login,
        signup,
        resetDatabase,
        updateProfile,
        createPrivateChat,
        createGroupChat,
        sendChatMessage,
        selectChat,
        logout,
        refreshChats,
        refreshUsers,
        deleteMessage,
        editMessage,
        typingStates,
        sendTypingStatus,
        alertMessage,
        showAlert,
        closeAlert,
        stories,
        refreshStories,
        uploadStory,
        deleteStory,
        confirmMessage,
        showConfirm,
        closeConfirm,
        theme,
        setTheme,
        matrixRain,
        setMatrixRain,
        crtEffect,
        setCrtEffect,
        gitMergeAnim,
        setGitMergeAnim,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
