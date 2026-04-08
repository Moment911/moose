"use client";
import { useState, useEffect, useRef } from "react";
import { Search, Play, Square, Check, Loader2, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";

const R = "#E6007E", T = "#00C2CB", BLK = "#0a0a0a", GRN = "#16a34a", AMB = "#f59e0b", PURP = "#7c3aed";
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif";
const FB = "'Raleway','Helvetica Neue',sans-serif";

const PROVIDER_COLORS = {
  ElevenLabs: PURP,
  Cartesia: "#3b82f6",
  OpenAI: GRN,
  Retell: R,
  Minimax: AMB,
  fish_audio: T,
  platform: R,
  inworld: "#6b7280",
};

const CACHE_KEY = "koto_voices_cache";
const CACHE_TTL = 60 * 60 * 1000;
const PAGE_SIZE = 50;

function getProviderColor(provider) {
  if (!provider) return "#6b7280";
  for (const [key, color] of Object.entries(PROVIDER_COLORS)) {
    if (provider.toLowerCase() === key.toLowerCase()) return color;
  }
  return "#6b7280";
}

export default function VoiceSelector({ selectedVoiceId, onSelect, showFilters = true, maxHeight = "500px" }) {
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gender, setGender] = useState("All");
  const [provider, setProvider] = useState("All");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [playingId, setPlayingId] = useState(null);
  const [providerOpen, setProviderOpen] = useState(false);
  const audioRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL && data?.length) {
            setVoices(data);
            setLoading(false);
            return;
          }
        }
      } catch {}
      try {
        const res = await fetch("/api/voice?action=list_voices");
        if (!res.ok) throw new Error("Failed to fetch voices");
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.voices || data.data || [];
        setVoices(list);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: list, ts: Date.now() }));
      } catch (err) {
        toast.error("Could not load voices");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setProviderOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const providers = ["All", ...Array.from(new Set(voices.map((v) => v.provider).filter(Boolean)))];

  const filtered = voices.filter((v) => {
    if (gender !== "All" && v.gender?.toLowerCase() !== gender.toLowerCase()) return false;
    if (provider !== "All" && v.provider !== provider) return false;
    if (search && !v.voice_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const visible = filtered.slice(0, visibleCount);

  function handlePlay(e, voice) {
    e.stopPropagation();
    if (playingId === voice.voice_id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }
    if (!voice.preview_audio_url) {
      toast("No preview available for this voice");
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(voice.preview_audio_url);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => { toast.error("Preview failed"); setPlayingId(null); };
    audio.play();
    audioRef.current = audio;
    setPlayingId(voice.voice_id);
  }

  function handleSelect(voice) {
    onSelect(voice.voice_id, voice);
  }

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10, padding: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ height: 72, borderRadius: 10, background: "#1a1a1a", animation: "pulse 1.5s infinite" }} />
        ))}
        <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FB }}>
      {showFilters && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
          {/* Gender pills */}
          <div style={{ display: "flex", gap: 4 }}>
            {["All", "Female", "Male"].map((g) => (
              <button
                key={g}
                onClick={() => { setGender(g); setVisibleCount(PAGE_SIZE); }}
                style={{
                  padding: "4px 12px",
                  borderRadius: 20,
                  border: "1px solid " + (gender === g ? R : "#333"),
                  background: gender === g ? R : "transparent",
                  color: gender === g ? "#fff" : "#aaa",
                  fontSize: 12,
                  fontFamily: FH,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Provider dropdown */}
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setProviderOpen(!providerOpen)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 8, border: "1px solid #333",
                background: "transparent", color: "#aaa", fontSize: 12,
                fontFamily: FH, cursor: "pointer",
              }}
            >
              {provider === "All" ? "Provider" : provider}
              <ChevronDown size={12} />
            </button>
            {providerOpen && (
              <div style={{
                position: "absolute", top: "100%", left: 0, marginTop: 4,
                background: "#1a1a1a", border: "1px solid #333", borderRadius: 8,
                zIndex: 50, minWidth: 140, overflow: "hidden",
              }}>
                {providers.map((p) => (
                  <div
                    key={p}
                    onClick={() => { setProvider(p); setProviderOpen(false); setVisibleCount(PAGE_SIZE); }}
                    style={{
                      padding: "6px 12px", fontSize: 12, color: provider === p ? "#fff" : "#aaa",
                      background: provider === p ? "#2a2a2a" : "transparent",
                      cursor: "pointer", fontFamily: FH,
                    }}
                  >
                    {p}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 10px", borderRadius: 8, border: "1px solid #333",
            background: "transparent", flex: 1, minWidth: 140,
          }}>
            <Search size={13} color="#666" />
            <input
              placeholder="Search voices..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
              style={{
                background: "transparent", border: "none", outline: "none",
                color: "#ccc", fontSize: 12, fontFamily: FH, width: "100%",
              }}
            />
          </div>
        </div>
      )}

      <div style={{ maxHeight, overflowY: "auto", paddingRight: 4 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8 }}>
          {visible.map((v) => {
            const selected = v.voice_id === selectedVoiceId;
            const playing = playingId === v.voice_id;
            const pColor = getProviderColor(v.provider);
            return (
              <div
                key={v.voice_id}
                onClick={() => handleSelect(v)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", borderRadius: 10, cursor: "pointer",
                  background: selected ? "rgba(234,39,41,0.08)" : "#111",
                  border: selected ? `2px solid ${R}` : "2px solid transparent",
                  transition: "all 0.15s",
                  position: "relative",
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  background: pColor, display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: FH,
                }}>
                  {v.voice_name?.[0]?.toUpperCase() || "?"}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: 13, color: "#eee", fontFamily: FH,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {v.voice_name || "Unnamed"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
                    {v.provider && (
                      <span style={{
                        fontSize: 9, padding: "1px 5px", borderRadius: 6,
                        background: pColor + "22", color: pColor, fontWeight: 600, fontFamily: FH,
                      }}>
                        {v.provider}
                      </span>
                    )}
                    {v.gender && (
                      <span style={{
                        fontSize: 9, padding: "1px 5px", borderRadius: 6,
                        background: "#ffffff0d", color: "#888", fontFamily: FH,
                      }}>
                        {v.gender}
                      </span>
                    )}
                    {v.accent && (
                      <span style={{
                        fontSize: 9, padding: "1px 5px", borderRadius: 6,
                        background: "#ffffff0d", color: "#888", fontFamily: FH,
                      }}>
                        {v.accent}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={(e) => handlePlay(e, v)}
                    style={{
                      width: 26, height: 26, borderRadius: "50%", border: "none",
                      background: playing ? "#333" : "transparent", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                    }}
                  >
                    {playing
                      ? <Square size={12} color={R} fill={R} />
                      : <Play size={12} color="#888" />}
                  </button>
                  {selected && (
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%", background: R,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check size={12} color="#fff" strokeWidth={3} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {visible.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: 24, color: "#666", fontSize: 13, fontFamily: FH }}>
            No voices found
          </div>
        )}

        {visibleCount < filtered.length && (
          <div style={{ textAlign: "center", marginTop: 12, paddingBottom: 8 }}>
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              style={{
                padding: "6px 20px", borderRadius: 8, border: "1px solid #333",
                background: "transparent", color: "#aaa", fontSize: 12,
                fontFamily: FH, cursor: "pointer", fontWeight: 600,
              }}
            >
              Load More ({filtered.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
