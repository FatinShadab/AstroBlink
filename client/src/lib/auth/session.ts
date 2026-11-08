/**
 * Local session for the citizen-science app.
 *
 * IMPORTANT: this is a client-side stand-in. It validates the form and keeps a
 * signed-in marker in localStorage so the app's routes can be exercised. It is
 * not authentication: no credential leaves the browser and no server checks it.
 * Replace `signInLocally` with the backend auth call when the API serves it.
 */

import { useEffect, useState } from "react";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export type SessionState =
  | { status: "loading"; user: null }
  | { status: "anonymous"; user: null }
  | { status: "authenticated"; user: SessionUser };

const KEY = "astroblink.session.v1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials(email: string, password: string): string | null {
  if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function signInLocally(email: string): SessionUser {
  const normalized = email.trim().toLowerCase();
  const user: SessionUser = {
    id: `usr_${hash(normalized)}`,
    name: normalized.split("@")[0].replace(/[._-]+/g, " "),
    email: normalized,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    // Storage blocked: the session lasts for this page only.
  }
  return user;
}

export function readSession(): SessionUser | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as Partial<SessionUser>;
    return u.id && u.email ? { id: u.id, name: u.name ?? u.email, email: u.email } : null;
  } catch {
    return null;
  }
}

export function signOutLocally(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

/** Client hook: `loading` until the browser has read the stored session. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "loading", user: null });

  useEffect(() => {
    const user = readSession();
    setState(user ? { status: "authenticated", user } : { status: "anonymous", user: null });
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      const next = readSession();
      setState(next ? { status: "authenticated", user: next } : { status: "anonymous", user: null });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return state;
}
