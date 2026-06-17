import React, { useState, useEffect, useRef } from "react";
import { useChat } from "@/lib/chatStore";
import { compressImage } from "@/lib/imageCompressor";
import { X, Search, Play, Pause, Upload, Check, Loader2 } from "lucide-react";

interface Track {
  trackId: number;
  trackName: string;
  artistName: string;
  previewUrl: string;
  artworkUrl100: string;
}

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BACKGROUND_PRESETS = [
  { id: "preset-dracula", name: "Dracula Midnight", class: "bg-gradient-to-tr from-[#1a1b26] to-[#24283b] text-[#c0caf5]" },
  { id: "preset-matrix", name: "Matrix Terminal", class: "bg-gradient-to-b from-[#030703] to-[#0a140a] text-[#39ff14]" },
  { id: "preset-cyberpunk", name: "Neon Cyberpunk", class: "bg-gradient-to-tr from-[#090b10] via-[#10141e] to-[#1a0f2b] text-[#00f0ff]" },
  { id: "preset-sunset", name: "Sunset Horizon", class: "bg-gradient-to-tr from-[#2d004d] to-[#e60067] text-[#ffffff]" },
  { id: "preset-ocean", name: "Ocean Wave", class: "bg-gradient-to-tr from-[#0a1828] via-[#178582] to-[#bfa37c] text-[#ffffff]" }
];

export default function CreateStoryModal({ isOpen, onClose }: CreateStoryModalProps) {
  const { uploadStory, showAlert } = useChat();
  const [image, setImage] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [musicSearchQuery, setMusicSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<number | null>(null);
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [compressionLogs, setCompressionLogs] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up audio on unmount or close
  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
    };
  }, []);



  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCompressionLogs("COMPRESSING STORY MATRIX...");
      const result = await compressImage(file, 640, 0.75); // stories fit well inside 640px wide
      setImage(result.base64);
      const savedPercent = Math.round(
        ((result.originalSize - result.compressedSize) / result.originalSize) * 100
      );
      setCompressionLogs(
        `COMPRESSED: ${(result.originalSize / 1024).toFixed(1)}KB -> ${(
          result.compressedSize / 1024
        ).toFixed(1)}KB (-${savedPercent}%)`
      );
    } catch (err) {
      console.error(err);
      showAlert("IMAGE MATRIX FAILURE", "Failed to compile story media.", "error");
      setCompressionLogs("");
    }
  };

  const togglePreview = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();

    if (previewTrackId === track.trackId) {
      // Pause
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      setPreviewTrackId(null);
    } else {
      // Play new
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      const audio = new Audio(track.previewUrl);
      audio.volume = 0.5;
      audioPreviewRef.current = audio;
      audio.play().catch((err) => console.warn("Audio autoplay blocked or failed", err));
      setPreviewTrackId(track.trackId);

      audio.onended = () => {
        setPreviewTrackId(null);
      };
    }
  };

  const handleSelectTrack = (track: Track) => {
    if (selectedTrack?.trackId === track.trackId) {
      setSelectedTrack(null);
    } else {
      setSelectedTrack(track);
    }
  };

  const handlePublish = async () => {
    if (!image && !caption.trim()) {
      showAlert("PUBLISH FAILURE", "Story requires either an image matrix or text caption overlay.", "error");
      return;
    }

    setIsUploading(true);

    // Stop music preview if playing
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current = null;
      setPreviewTrackId(null);
    }

    const musicTrackPayload = selectedTrack
      ? {
          title: selectedTrack.trackName,
          artist: selectedTrack.artistName,
          previewUrl: selectedTrack.previewUrl,
          artworkUrl: selectedTrack.artworkUrl100,
        }
      : undefined;

    const bgGradient = !image ? BACKGROUND_PRESETS[selectedPresetIdx].class : undefined;
    const success = await uploadStory(image, caption, musicTrackPayload, bgGradient);
    setIsUploading(false);

    if (success) {
      // Reset
      setImage(null);
      setCaption("");
      setMusicSearchQuery("");
      setSelectedTrack(null);
      setCompressionLogs("");
      setSelectedPresetIdx(0);
      onClose();
    }
  };

  const handleClose = () => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current = null;
      setPreviewTrackId(null);
    }
    setSelectedPresetIdx(0);
    onClose();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMusicSearchQuery(val);

    if (!val.trim()) {
      setTracks([]);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(
            val
          )}&media=music&limit=10`
        );
        const data = await res.json();
        if (data.results) {
          setTracks(data.results);
        }
      } catch (err) {
        console.error("iTunes search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 font-mono select-none">
      <div 
        className="bg-[#0b0c10] border border-slate-800/80 rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh] shadow-[0_0_50px_rgba(0,255,255,0.07)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-900 bg-[#0f111a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-xs font-bold text-slate-200 tracking-widest uppercase">
              TRANSMIT NEW DEV_STORY
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-500 hover:text-red-400 p-1 rounded-lg hover:bg-slate-900 transition-all cursor-pointer"
            title="Abort story"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {/* Image Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              Story Media (Visual Matrix)
            </label>
            {image ? (
              <div className="relative aspect-[9/16] max-h-[280px] w-auto mx-auto rounded-xl border border-slate-800 overflow-hidden bg-slate-950 flex items-center justify-center group">
                <img src={image} alt="Story Preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => setImage(null)}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-red-950/80 text-slate-300 hover:text-red-400 p-1.5 rounded-lg border border-slate-800 shadow-md cursor-pointer transition-all active:scale-95"
                  title="Remove Image"
                >
                  <X size={14} />
                </button>
                {caption && (
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-center">
                    <p className="text-xs text-slate-200 font-sans tracking-wide drop-shadow-md">
                      {caption}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Upload box */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-[16/9] md:aspect-auto md:h-[130px] border border-dashed border-slate-800 hover:border-cyan-500/50 rounded-xl bg-slate-950/50 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:bg-cyan-500/5"
                  >
                    <Upload size={20} className="text-slate-600 group-hover:text-cyan-400" />
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Select Visual Node
                    </span>
                  </button>

                  {/* Text Story Preview */}
                  <div className={`aspect-[16/9] md:aspect-auto md:h-[130px] rounded-xl border border-slate-800 overflow-hidden flex flex-col justify-center items-center p-3 relative ${BACKGROUND_PRESETS[selectedPresetIdx].class}`}>
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 opacity-60">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-[8px] tracking-wider uppercase font-bold">Text Preview</span>
                    </div>
                    <p className="text-xs font-bold text-center break-all font-mono line-clamp-3 px-2">
                      {caption.trim() || "Type caption below..."}
                    </p>
                    {selectedTrack && (
                      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded text-[8px] font-sans truncate">
                        <span className="animate-spin duration-3000">💿</span>
                        <span className="truncate uppercase font-bold tracking-wider">{selectedTrack.trackName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preset Picker */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">
                    Select Text Status Theme
                  </label>
                  <div className="flex items-center gap-2">
                    {BACKGROUND_PRESETS.map((preset, idx) => (
                      <button
                        key={preset.id}
                        onClick={() => setSelectedPresetIdx(idx)}
                        className={`w-6 h-6 rounded-full ${preset.class.split(" ")[0]} ${preset.class.split(" ")[1]} border-2 transition-all active:scale-90 cursor-pointer ${
                          selectedPresetIdx === idx ? "border-cyan-400 scale-105 shadow-md shadow-cyan-400/20" : "border-slate-800 hover:border-slate-700"
                        }`}
                        title={preset.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            {compressionLogs && (
              <span className="text-[9px] text-cyan-400/80 text-center font-bold tracking-wide">
                {compressionLogs}
              </span>
            )}
          </div>

          {/* Caption Input */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              Matrix Overlay Caption (Optional)
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 100))}
              placeholder="Inject code caption... (Max 100 chars)"
              className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-cyan-400 text-slate-200 font-sans"
            />
          </div>

          {/* Music Picker */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                Sync Music Core
              </label>
              {selectedTrack && (
                <button
                  onClick={() => setSelectedTrack(null)}
                  className="text-[9px] text-red-400 hover:underline uppercase font-bold tracking-wider cursor-pointer"
                >
                  Detach Track
                </button>
              )}
            </div>

            {selectedTrack ? (
              <div className="flex items-center gap-3 p-2 bg-[#0d0e14] border border-cyan-500/20 rounded-xl">
                <img
                  src={selectedTrack.artworkUrl100}
                  alt={selectedTrack.trackName}
                  className="w-10 h-10 object-cover rounded-lg border border-slate-800"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-cyan-400 truncate uppercase">
                    {selectedTrack.trackName}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate uppercase">
                    {selectedTrack.artistName}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => togglePreview(selectedTrack, e)}
                    className="p-1.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 rounded-lg cursor-pointer transition-all active:scale-90"
                    title="Preview Audio"
                  >
                    {previewTrackId === selectedTrack.trackId ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                  <div className="p-1 bg-cyan-950 border border-cyan-800 text-cyan-400 rounded-full">
                    <Check size={14} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-600" />
                  <input
                    type="text"
                    value={musicSearchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search iTunes soundscape... (e.g. Daft Punk)"
                    className="w-full bg-slate-950 border border-slate-850 pl-9 pr-4 py-2 text-xs rounded-xl focus:outline-none focus:border-cyan-400 text-slate-200"
                  />
                  {isSearching && (
                    <Loader2 size={14} className="absolute right-3 top-2.5 text-cyan-400 animate-spin" />
                  )}
                </div>

                {/* Tracks Results */}
                {tracks.length > 0 && (
                  <div className="max-h-[160px] overflow-y-auto divide-y divide-slate-900 border border-slate-900 rounded-xl bg-slate-950/80 scrollbar-thin">
                    {tracks.map((track) => (
                      <div
                        key={track.trackId}
                        onClick={() => handleSelectTrack(track)}
                        className="flex items-center gap-3 p-2 hover:bg-slate-900/60 cursor-pointer transition-colors"
                      >
                        <img
                          src={track.artworkUrl100}
                          alt={track.trackName}
                          className="w-8 h-8 object-cover rounded-md border border-slate-900"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-bold text-slate-300 truncate uppercase">
                            {track.trackName}
                          </div>
                          <div className="text-[9px] text-slate-500 truncate uppercase">
                            {track.artistName}
                          </div>
                        </div>
                        <button
                          onClick={(e) => togglePreview(track, e)}
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-400 rounded-lg cursor-pointer transition-all active:scale-90"
                          title="Preview Track"
                        >
                          {previewTrackId === track.trackId ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4 border-t border-slate-900 bg-[#0f111a] flex gap-2">
          <button
            onClick={handleClose}
            className="flex-1 py-2 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-300 rounded-xl cursor-pointer text-xs uppercase font-bold active:scale-95 transition-all"
            disabled={isUploading}
          >
            Abort
          </button>
          <button
            onClick={handlePublish}
            disabled={(!image && !caption.trim()) || isUploading}
            className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold uppercase tracking-wider text-xs rounded-xl shadow-lg disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Broadcasting...</span>
              </>
            ) : (
              <>
                <span>Broadcast Status</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
