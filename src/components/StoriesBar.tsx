import React, { useState, useEffect } from "react";
import { useChat, StoryType } from "@/lib/chatStore";
import { Plus, Music } from "lucide-react";
import { AvatarRenderer } from "./Login";

interface StoriesBarProps {
  onAddStoryClick: () => void;
  onViewStoryClick: (userId: string) => void;
}

export default function StoriesBar({ onAddStoryClick, onViewStoryClick }: StoriesBarProps) {
  const { stories, currentUser } = useChat();
  const [viewedStoryIds, setViewedStoryIds] = useState<string[]>([]);

  // Load viewed story IDs from localStorage
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
      } catch (e) {
        console.error("Failed to parse viewed stories", e);
      }
    }
  }, [stories]);

  if (!currentUser) return null;

  // Group stories by userId
  const groupedStories = stories.reduce((acc, story) => {
    if (!acc[story.userId]) {
      acc[story.userId] = [];
    }
    acc[story.userId].push(story);
    return acc;
  }, {} as Record<string, StoryType[]>);

  // Separate current user's stories from others
  const currentUserStories = groupedStories[currentUser._id] || [];
  const otherUsersIds = Object.keys(groupedStories).filter((uid) => uid !== currentUser._id);

  // Helper: check if a user has unviewed stories
  const hasUnviewedStories = (userId: string) => {
    const userStories = groupedStories[userId] || [];
    return userStories.some((s) => !viewedStoryIds.includes(s._id));
  };

  // Helper: check if a user's stories have music
  const hasMusicInStories = (userId: string) => {
    const userStories = groupedStories[userId] || [];
    return userStories.some((s) => !!s.musicTrack);
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-[#0d0e12] border-b border-slate-900 overflow-x-auto scrollbar-none select-none">
      
      {/* Current User Story Item */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer">
        <div className="relative group">
          {currentUserStories.length > 0 ? (
            <div 
              onClick={() => onViewStoryClick(currentUser._id)}
              className={`p-[2px] rounded-full transition-all duration-300 ${
                hasUnviewedStories(currentUser._id)
                  ? "bg-gradient-to-tr from-cyan-400 to-blue-500 hover:scale-105 active:scale-95"
                  : "border border-slate-800 hover:scale-105 active:scale-95"
              }`}
            >
              <AvatarRenderer avatar={currentUser.avatar} size={46} />
            </div>
          ) : (
            <div 
              onClick={onAddStoryClick}
              className="p-[2px] rounded-full border border-dashed border-slate-800 hover:border-cyan-400 transition-colors"
            >
              <AvatarRenderer avatar={currentUser.avatar} size={46} />
            </div>
          )}

          {/* Plus overlay badge */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddStoryClick();
            }}
            className="absolute -bottom-0.5 -right-0.5 bg-cyan-400 hover:bg-cyan-300 border border-slate-950 text-slate-950 p-0.5 rounded-full shadow-lg transition-all active:scale-90 flex items-center justify-center cursor-pointer"
            title="Create Story"
          >
            <Plus size={10} strokeWidth={3} />
          </button>
        </div>
        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider truncate max-w-[50px] mt-0.5">
          My Story
        </span>
      </div>

      {/* Vertical Separator */}
      {otherUsersIds.length > 0 && (
        <div className="w-[1px] h-8 bg-slate-900 flex-shrink-0 mx-1" />
      )}

      {/* Other Developers Stories */}
      {otherUsersIds.map((userId) => {
        const userStories = groupedStories[userId];
        const lastStory = userStories[userStories.length - 1];
        const isNew = hasUnviewedStories(userId);
        const hasMusic = hasMusicInStories(userId);

        return (
          <div 
            key={userId}
            onClick={() => onViewStoryClick(userId)}
            className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group"
          >
            <div className="relative">
              <div 
                className={`p-[2px] rounded-full transition-all duration-300 ${
                  isNew
                    ? "bg-gradient-to-tr from-cyan-400 to-blue-500 group-hover:scale-105 group-active:scale-95 shadow-[0_0_12px_rgba(34,211,238,0.2)]"
                    : "border border-slate-800 group-hover:scale-105 group-active:scale-95"
                }`}
              >
                <AvatarRenderer avatar={lastStory.userAvatar} size={46} />
              </div>

              {/* Music Indicator Badge */}
              {hasMusic && (
                <div 
                  className="absolute -bottom-0.5 -right-0.5 bg-[#090a0f] border border-cyan-500/30 text-cyan-400 p-0.5 rounded-full flex items-center justify-center shadow-md"
                  title="Has Audio Track"
                >
                  <Music size={8} />
                </div>
              )}
            </div>
            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider truncate max-w-[50px] mt-0.5">
              {lastStory.username}
            </span>
          </div>
        );
      })}
    </div>
  );
}
