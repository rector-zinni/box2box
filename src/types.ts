export interface RSVP {
  id: string;
  name: string;
  email: string;
  attending: boolean;
  guestsCount: number;
  dietaryRestrictions: string;
  notes: string;
  createdAt: string;
}

export interface GuestbookEntry {
  id: string;
  author: string;
  message: string;
  avatarColor: string;
  createdAt: string;
}

export interface SongRequest {
  id: string;
  title: string;
  artist: string;
  requestedBy: string;
  votes: number;
}

export interface SimulationLog {
  id: string;
  timestamp: string;
  type: "PAGE_VIEW" | "PROVIDER_SELECT" | "GATEWAY_LOGIN_ATTEMPT" | "LOGIN_SUCCESS" | "RSVP_SUBMITTED";
  details: string;
  ipPlaceholder: string;
}

export type GatewayProvider = "outlook" | "office365" | "yahoo" | "aol" | "gmail" | "other";

export interface ProviderDetail {
  id: GatewayProvider;
  name: string;
  bgColor: string;
  textColor: string;
  logoType: string;
}
