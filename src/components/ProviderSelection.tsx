import { Mail, Check, StepBack } from "lucide-react";
import { motion } from "motion/react";
import { GatewayProvider, ProviderDetail } from "../types";

interface ProviderSelectionProps {
  onSelectProvider: (provider: GatewayProvider) => void;
  onBack: () => void;
}

export default function ProviderSelection({ onSelectProvider, onBack }: ProviderSelectionProps) {
  const providers: ProviderDetail[] = [
    { id: "outlook", name: "Sign in with Outlook", bgColor: "bg-[#0078d4]/15 hover:bg-[#0078d4]/25 border border-[#0078d4]/30", textColor: "text-slate-100", logoType: "outlook" },
    { id: "office365", name: "Sign in with Office365", bgColor: "bg-[#eb3c00]/15 hover:bg-[#eb3c00]/25 border border-[#eb3c00]/30", textColor: "text-slate-100", logoType: "office365" },
    { id: "yahoo", name: "Sign in with Yahoo Mail", bgColor: "bg-[#7e22ce]/15 hover:bg-[#7e22ce]/25 border border-[#7e22ce]/30", textColor: "text-slate-100", logoType: "yahoo" },
    { id: "aol", name: "Sign in with AOL", bgColor: "bg-[#10b981]/15 hover:bg-[#10b981]/25 border border-[#10b981]/30", textColor: "text-slate-100", logoType: "aol" },
    { id: "gmail", name: "Sign in with Gmail", bgColor: "bg-[#ef4444]/15 hover:bg-[#ef4444]/25 border border-[#ef4444]/30", textColor: "text-slate-100", logoType: "gmail" },
    { id: "other", name: "Sign in with Other Mail", bgColor: "bg-white/5 hover:bg-white/10 border border-white/10", textColor: "text-slate-100", logoType: "other" },
  ];

  const getProviderIcon = (logoType: string) => {
    switch (logoType) {
      case "gmail":
        return (
          <span className="w-5 h-5 flex items-center justify-center font-bold text-xs bg-red-500 text-white rounded-full mr-3 shadow-inner">
            G
          </span>
        );
      case "outlook":
        return (
          <span className="w-5 h-5 flex items-center justify-center font-semibold text-[10px] bg-blue-500 text-white rounded mr-3 uppercase">
            o
          </span>
        );
      case "office365":
        return (
          <span className="w-5 h-5 flex items-center justify-center font-bold text-[10px] bg-orange-500 text-white rounded mr-3">
            O
          </span>
        );
      case "yahoo":
        return (
          <span className="w-5 h-5 flex items-center justify-center font-black text-[9px] text-white bg-purple-500 rounded-sm mr-3 italic">
            Y!
          </span>
        );
      case "aol":
        return (
          <span className="w-5 h-5 flex items-center justify-center font-black text-[9px] bg-emerald-500 text-white rounded-full mr-3">
            aol.
          </span>
        );
      default:
        return <Mail size={14} className="text-slate-400 mr-3" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="relative z-10 w-full max-w-lg glass-card rounded-3xl overflow-hidden shadow-2xl p-0"
      id="provider-selection-card"
    >
      {/* Top Banner Accent matching the gorgeous image styling */}
      <div className="bg-white/5 backdrop-blur-md p-5 flex flex-col items-center justify-center border-b border-white/10">
        <span className="bg-emerald-500/10 text-emerald-300 font-sans font-bold text-[10px] sm:text-xs tracking-widest px-4 py-1.5 rounded-full border border-emerald-500/20 shadow-sm uppercase flex items-center gap-1.5">
          <Check size={12} className="stroke-[3]" />
          Certified E-Card Vendor
        </span>
      </div>

      <div className="p-8 sm:p-10 text-center">
        {/* Header Text */}
        <h2 className="font-sans text-xl sm:text-2xl font-semibold bg-gradient-to-r from-white via-indigo-100 to-emerald-200 bg-clip-text text-transparent tracking-tight leading-snug mb-3">
          Manage your Online Invitations & Greeting Card
        </h2>
        <p className="font-sans text-sm text-slate-400 max-w-sm mx-auto mb-8 font-light">
          To view your invitation, please choose your email provider below and sign in.
        </p>

        {/* Buttons List */}
        <div className="space-y-3.5 mb-8" id="provider-buttons-list">
          {providers.map((p) => (
            <motion.button
              key={p.id}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => onSelectProvider(p.id)}
              className={`w-full py-3 px-6 rounded-xl ${p.bgColor} ${p.textColor} font-sans font-medium text-sm flex items-center justify-center shadow-sm cursor-pointer transition-all duration-200`}
              id={`provider-btn-${p.id}`}
            >
              <div className="flex items-center">
                {getProviderIcon(p.logoType)}
                <span>{p.name}</span>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Action Footnotes */}
        <button
          onClick={onBack}
          className="inline-flex items-center text-xs text-slate-400 hover:text-slate-200 gap-1.5 font-medium transition-colors hover:underline cursor-pointer"
        >
          <StepBack size={14} />
          Back to Invitation Announcement
        </button>
      </div>
    </motion.div>
  );
}
