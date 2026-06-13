import { useState, useEffect } from "react";
import { CalendarDays, MapPin, Clock, Music } from "lucide-react";
import { motion } from "motion/react";

interface InvitationMainProps {
  onStartGateway: () => void;
}

export default function InvitationMain({ onStartGateway }: InvitationMainProps) {
  // We'll calculate a target date exactly 3 days, 7 hours, 4 minutes and 12 seconds in the future
  // to closely match the image's "3 d 7 h 4 m 5 s" and show a ticking timer!
  const [targetDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    date.setHours(date.getHours() + 7);
    date.setMinutes(date.getMinutes() + 4);
    date.setSeconds(date.getSeconds() + 12);
    return date.getTime();
  });

  const [timeLeft, setTimeLeft] = useState({
    months: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        clearInterval(interval);
        setTimeLeft({ months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        setTimeLeft({
          months: 0,
          days,
          hours,
          minutes,
          seconds,
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="relative z-10 w-full max-w-4xl glass-card rounded-3xl overflow-hidden p-8 sm:p-12 md:p-16 text-center select-none"
      id="invitation-main-card"
    >
      {/* Decorative glass spark accents */}
      <div className="absolute top-6 left-6 text-indigo-400/30 text-lg">✦</div>
      <div className="absolute top-6 right-6 text-emerald-400/30 text-lg">✦</div>
      <div className="absolute bottom-6 left-6 text-purple-400/30 text-lg">✦</div>
      <div className="absolute bottom-6 right-6 text-indigo-400/30 text-lg">✦</div>

      {/* Title */}
      <h1 
        className="font-serif text-4xl sm:text-5xl md:text-6xl bg-gradient-to-r from-white via-indigo-100 to-emerald-200 bg-clip-text text-transparent font-medium leading-tight mb-6 tracking-wide"
        id="invitation-title"
      >
        Celebrate Life's Beautiful Moments
      </h1>

      {/* Description */}
      <div className="max-w-2xl mx-auto space-y-3 mb-10 text-slate-300/80 font-sans font-light text-base md:text-lg leading-relaxed">
        <p>Join us for an evening filled with joy, laughter, and warm memories.</p>
        <p className="text-sm md:text-base text-slate-400/85 italic">For the best experience, we suggest viewing this invite on your computer.</p>
        <p className="text-sm md:text-base text-slate-300/90">
          Take a moment to check out the "View Party Highlights" below for all the exciting details, and don't forget to RSVP!
        </p>
      </div>

      {/* Main CTA Button */}
      <div className="mb-12">
        <button
          onClick={onStartGateway}
          className="px-10 py-4 bg-gradient-to-r from-indigo-500 to-emerald-400 hover:from-indigo-600 hover:to-emerald-500 text-white font-sans text-base md:text-lg rounded-full transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/30 cursor-pointer"
          id="btn-view-highlights"
        >
          View Party Highlights
        </button>
      </div>

      {/* Countdown Timer Row matching the burgundy capsule list in screenshot */}
      <div className="flex justify-center mb-16" id="countdown-timer-container">
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl text-white rounded-full px-8 py-3.5 flex items-center justify-around gap-6 sm:gap-10 shadow-xl font-mono text-base md:text-lg">
          <div className="flex items-baseline gap-1" id="timer-months">
            <span className="font-semibold text-lg md:text-xl text-indigo-300">{timeLeft.months}</span>
            <span className="text-xs text-slate-400 uppercase tracking-wider">mo</span>
          </div>
          <div className="flex items-baseline gap-1" id="timer-days">
            <span className="font-semibold text-lg md:text-xl text-indigo-300">{timeLeft.days}</span>
            <span className="text-xs text-slate-400 uppercase tracking-wider">d</span>
          </div>
          <div className="flex items-baseline gap-1" id="timer-hours">
            <span className="font-semibold text-lg md:text-xl text-indigo-300">{timeLeft.hours}</span>
            <span className="text-xs text-slate-400 uppercase tracking-wider">h</span>
          </div>
          <div className="flex items-baseline gap-1" id="timer-minutes">
            <span className="font-semibold text-lg md:text-xl text-indigo-300">{timeLeft.minutes}</span>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-light">m</span>
          </div>
          <div className="flex items-baseline gap-1 animate-pulse" id="timer-seconds">
            <span className="font-semibold text-lg md:text-xl text-emerald-400">{timeLeft.seconds}</span>
            <span className="text-xs text-slate-400 uppercase tracking-wider">s</span>
          </div>
        </div>
      </div>

      {/* Invitation Metadata Row matching icon layout closely */}
      <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto pt-4 border-t border-white/10" id="invitation-details-grid">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300 mb-2">
            <CalendarDays size={20} />
          </div>
          <span className="font-sans font-medium text-slate-200 text-sm sm:text-base md:text-lg">When</span>
          <span className="text-slate-400 text-xs sm:text-sm mt-1">July 17, 2026</span>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300 mb-2">
            <MapPin size={20} className="animate-pulse" />
          </div>
          <span className="font-sans font-medium text-slate-200 text-sm sm:text-base md:text-lg">Where</span>
          <span className="text-slate-400 text-xs sm:text-sm mt-1">Grand Manor, 4th Fl</span>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-yellow-300 mb-2">
            <Clock size={20} />
          </div>
          <span className="font-sans font-medium text-slate-200 text-sm sm:text-base md:text-lg">Time</span>
          <span className="text-slate-400 text-xs sm:text-sm mt-1">19:00 EST</span>
        </div>
      </div>
    </motion.div>
  );
}
