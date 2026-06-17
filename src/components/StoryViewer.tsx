import React, { useState, useEffect, useRef } from "react";
import { StoryType, useChat } from "@/lib/chatStore";
import { X, Play, Pause, Volume2, VolumeX, Music, Trash2 } from "lucide-react";
import { AvatarRenderer } from "./Login";

interface StoryViewerProps {
  stories: StoryType[];
  initialUserId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function StoryViewer({ stories, initialUserId, isOpen, onClose }: StoryViewerProps) {
  // Get list of unique users who have active stories
  const uniqueUserIds = Array.from(new Set(stories.map((s) => s.userId)));
  
  // Find index of the user we clicked on
  const initialUserIdx = uniqueUserIds.indexOf(initialUserId);
  const [activeUserIdx, setActiveUserIdx] = useState(initialUserIdx !== -1 ? initialUserIdx : 0);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  
  // Progress tracker (0 to 100)
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { currentUser, deleteStory, showConfirm } = useChat();

  const activeUserId = uniqueUserIds[activeUserIdx];
  const userStories = stories.filter((s) => s.userId === activeUserId);
  const currentStory = userStories[activeStoryIdx];

  // Safeguard against story deletions or expiration changes
  useEffect(() => {
    if (isOpen && stories.length > 0) {
      const activeUserStories = stories.filter((s) => s.userId === activeUserId);
      if (activeUserStories.length === 0) {
        if (uniqueUserIds.length <= 1) {
          onClose();
        } else {
          const timer = setTimeout(() => {
            setActiveUserIdx((prev) => Math.min(prev, uniqueUserIds.length - 1));
            setActiveStoryIdx(0);
          }, 0);
          return () => clearTimeout(timer);
        }
      } else if (activeStoryIdx >= activeUserStories.length) {
        const timer = setTimeout(() => {
          setActiveStoryIdx(activeUserStories.length - 1);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [stories, isOpen, activeUserId, activeStoryIdx, uniqueUserIds.length, onClose]);

  const handleNext = React.useCallback(() => {
    if (activeStoryIdx < userStories.length - 1) {
      // Go to next story of same user
      setActiveStoryIdx((prev) => prev + 1);
      setProgress(0);
    } else if (activeUserIdx < uniqueUserIds.length - 1) {
      // Go to first story of next user
      setActiveUserIdx((prev) => prev + 1);
      setActiveStoryIdx(0);
      setProgress(0);
    } else {
      // All stories completed, close viewer
      onClose();
    }
  }, [activeStoryIdx, userStories.length, activeUserIdx, uniqueUserIds.length, onClose]);

  const handlePrev = React.useCallback(() => {
    if (activeStoryIdx > 0) {
      // Go to previous story of same user
      setActiveStoryIdx((prev) => prev - 1);
      setProgress(0);
    } else if (activeUserIdx > 0) {
      // Go to last story of previous user
      const prevUserStories = stories.filter((s) => s.userId === uniqueUserIds[activeUserIdx - 1]);
      setActiveUserIdx((prev) => prev - 1);
      setActiveStoryIdx(prevUserStories.length - 1);
      setProgress(0);
    } else {
      // At the very beginning, restart first story
      setProgress(0);
    }
  }, [activeStoryIdx, activeUserIdx, uniqueUserIds, stories]);

  // Audio Playback Sync
  useEffect(() => {
    if (!isOpen || !currentStory) return;

    // Remove old audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (currentStory.musicTrack?.previewUrl) {
      const audio = new Audio(currentStory.musicTrack.previewUrl);
      audio.loop = true;
      audio.muted = isMuted;
      audio.volume = 0.5;
      audioRef.current = audio;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            const timer = setTimeout(() => {
              setAutoplayBlocked((blocked) => {
                if (blocked) return false;
                return blocked;
              });
            }, 0);
            return () => clearTimeout(timer);
          })
          .catch((err) => {
            console.warn("Autoplay blocked. Waiting for user interaction:", err);
            const timer = setTimeout(() => {
              setAutoplayBlocked((blocked) => {
                if (!blocked) return true;
                return blocked;
              });
            }, 0);
            return () => clearTimeout(timer);
          });
      }
    } else {
      const timer = setTimeout(() => {
        setAutoplayBlocked((blocked) => {
          if (blocked) return false;
          return blocked;
        });
      }, 0);
      return () => clearTimeout(timer);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [currentStory, isOpen, isMuted]);

  // Sync mute state changes to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Sync pause state changes to audio element
  useEffect(() => {
    if (audioRef.current) {
      if (isPaused) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [isPaused]);

  // Main tick interval for story duration (5 seconds per story)
  useEffect(() => {
    if (!isOpen || isPaused || autoplayBlocked) return;

    const tickRateMs = 50; // 20 ticks per second
    const totalDurationMs = 5000;
    const progressStep = (tickRateMs / totalDurationMs) * 100;

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + progressStep;
      });
    }, tickRateMs);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isOpen, isPaused, autoplayBlocked, handleNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPaused((p) => !p);
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  const handleAutoplayUnblock = () => {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => {
          setAutoplayBlocked(false);
          setIsPaused(false);
        })
        .catch((err) => console.error(err));
    } else {
      setAutoplayBlocked(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[120] bg-black/98 flex flex-col items-center justify-center p-0 md:p-4 font-mono select-none"
      onClick={() => setIsPaused((p) => !p)}
    >
      {/* Visual Backblur */}
      {currentStory.image && (
        <div 
          className="absolute inset-0 bg-cover bg-center filter blur-2xl opacity-25 scale-105 pointer-events-none"
          style={{ backgroundImage: `url(${currentStory.image})` }}
        />
      )}

      <div 
        className="w-full max-w-md h-full md:max-h-[85vh] md:aspect-[9/16] bg-[#050608] rounded-none md:rounded-2xl border-0 md:border border-slate-900 shadow-2xl relative overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress Indicators */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
          {userStories.map((story, idx) => {
            let width = "0%";
            if (idx < activeStoryIdx) {
              width = "100%";
            } else if (idx === activeStoryIdx) {
              width = `${progress}%`;
            }
            return (
              <div key={story._id} className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-400 transition-all duration-[50ms] ease-linear rounded-full"
                  style={{ width }}
                />
              </div>
            );
          })}
        </div>

        {/* Top Header Bar */}
        <div className="absolute top-6 left-3 right-3 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <AvatarRenderer avatar={currentStory.userAvatar} size={36} />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                {currentStory.username}
              </span>
              <span className="text-[8px] text-slate-500 font-bold uppercase">
                {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Delete button (if owner) */}
            {currentUser && currentStory.userId === currentUser._id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaused(true);
                  showConfirm(
                    "DELETE STATUS NODE",
                    "This action will remove this status card from active feeds. Proceed with database purge?",
                    async () => {
                      const success = await deleteStory(currentStory._id);
                      if (success) {
                        if (userStories.length <= 1) {
                          onClose();
                        } else {
                          handleNext();
                        }
                      } else {
                        setIsPaused(false);
                      }
                    },
                    () => {
                      setIsPaused(false);
                    }
                  );
                }}
                className="text-slate-400 hover:text-red-400 p-1.5 hover:bg-slate-900/50 rounded-lg cursor-pointer transition-colors"
                title="Delete story"
              >
                <Trash2 size={16} />
              </button>
            )}
            {/* Play/Pause */}
            <button
              onClick={() => setIsPaused((p) => !p)}
              className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-900/50 rounded-lg cursor-pointer transition-colors"
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>

            {/* Mute/Unmute */}
            {currentStory.musicTrack && (
              <button
                onClick={() => setIsMuted((m) => !m)}
                className="text-slate-400 hover:text-cyan-400 p-1.5 hover:bg-slate-900/50 rounded-lg cursor-pointer transition-colors"
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-red-400 p-1.5 hover:bg-slate-900/50 rounded-lg cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Left/Right Tap Zones for Navigation */}
        <div className="absolute inset-x-0 top-20 bottom-24 flex z-10 pointer-events-none">
          <div 
            onClick={handlePrev} 
            className="w-1/3 h-full cursor-w-resize pointer-events-auto active:bg-white/5 transition-colors"
            title="Previous Story"
          />
          <div 
            onClick={() => setIsPaused((p) => !p)} 
            className="w-1/3 h-full cursor-pointer pointer-events-auto"
            title="Pause/Play"
          />
          <div 
            onClick={handleNext} 
            className="w-1/3 h-full cursor-e-resize pointer-events-auto active:bg-white/5 transition-colors"
            title="Next Story"
          />
        </div>

        {/* Main Image/Text View */}
        <div className="flex-1 w-full flex items-center justify-center relative select-none">
          {currentStory.image ? (
            <img 
              src={currentStory.image} 
              alt="Story Backdrop" 
              className="w-full h-full object-contain pointer-events-none select-none"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center p-6 text-center select-text ${currentStory.bgGradient || "bg-gradient-to-tr from-[#1a1b26] to-[#24283b] text-[#c0caf5]"}`}>
              <p className="text-base md:text-lg font-bold font-mono break-words leading-relaxed max-w-[85%]">
                {currentStory.caption}
              </p>
            </div>
          )}

          {/* Autoplay Block Overlay */}
          {autoplayBlocked && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 z-35">
              <span className="w-10 h-10 border border-dashed border-cyan-400 rounded-full flex items-center justify-center text-cyan-400 animate-spin">
                <Music size={16} />
              </span>
              <button
                onClick={handleAutoplayUnblock}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold uppercase tracking-wider text-[10px] rounded-xl shadow-lg cursor-pointer active:scale-95 transition-all"
              >
                UNMUTE SOUNDSCAPE
              </button>
            </div>
          )}
        </div>

        {/* Story Footer (Caption & Music Ticker) */}
        <div className="p-4 bg-gradient-to-t from-black via-black/95 to-transparent flex flex-col gap-3 relative z-20">
          {/* Caption Overlay */}
          {currentStory.image && currentStory.caption && (
            <p className="text-xs text-slate-100 font-sans tracking-wide text-center drop-shadow-md">
              {currentStory.caption}
            </p>
          )}

          {/* Music Track Details */}
          {currentStory.musicTrack && (
            <div className="flex items-center justify-center gap-2 p-2 bg-[#0c0d12]/90 border border-slate-800/80 rounded-xl max-w-[85%] mx-auto shadow-md">
              <span className="text-cyan-400 animate-bounce flex-shrink-0">
                <Music size={13} />
              </span>
              <div className="overflow-hidden whitespace-nowrap text-[10px] uppercase font-bold tracking-wider text-slate-300 flex-1 relative flex items-center justify-center">
                {/* Rolling Ticker */}
                <div className="animate-[marquee_12s_linear_infinite] inline-block pl-[100%]">
                  {currentStory.musicTrack.title} — {currentStory.musicTrack.artist}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
