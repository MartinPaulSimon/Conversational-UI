// In-memory Session Store
import { RankedCandidate } from './ranking';

export interface SessionContext {
  id: string;
  filters: {
    skills: string[];
    experience_min: number | null;
    experience_max: number | null;
    location: string | null;
    domain: string | null;
    role: string | null;
  };
  semantic_intent: string;
  previous_results: RankedCandidate[];
  excluded_candidates: string[];
  ranking_preferences: string[];
  jd_parsed: {
    role: string;
    skills: string[];
    experience: string;
    domain: string;
    responsibilities: string[];
    nice_to_have: string[];
  } | null;
  messages: Array<{
    id: string;
    role: 'user' | 'ai';
    content: string;
    candidates?: RankedCandidate[];
    suggestions?: string[];
    timestamp: number;
  }>;
  created_at: number;
  updated_at: number;
}

// Simple in-memory store
const sessions = new Map<string, SessionContext>();

export function createSession(id: string): SessionContext {
  const session: SessionContext = {
    id,
    filters: {
      skills: [],
      experience_min: null,
      experience_max: null,
      location: null,
      domain: null,
      role: null,
    },
    semantic_intent: '',
    previous_results: [],
    excluded_candidates: [],
    ranking_preferences: [],
    jd_parsed: null,
    messages: [],
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): SessionContext | undefined {
  return sessions.get(id);
}

export function updateSession(id: string, updates: Partial<SessionContext>): SessionContext | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  const updated = { ...session, ...updates, updated_at: Date.now() };
  sessions.set(id, updated);
  return updated;
}

export function addMessage(
  sessionId: string,
  message: SessionContext['messages'][0]
): SessionContext | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  session.messages.push(message);
  session.updated_at = Date.now();
  return session;
}
