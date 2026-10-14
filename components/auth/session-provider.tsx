"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@/lib/auth-profile";
import { getCurrentUser, logout, AuthApiError } from "@/lib/auth";
import { Icon } from "../icon";

const SessionContext = createContext<AuthUser | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      try { const profile = await getCurrentUser(controller.signal); if (active) { setUser(profile); setError(""); } }
      catch (cause) {
        if (!active) return;
        setUser(null);
        if (cause instanceof AuthApiError && cause.status === 401) router.replace("/signin");
        else setError(cause instanceof Error ? cause.message : "Cannot load your profile.");
      }
    };
    void load();
    const interval = window.setInterval(() => { void load(); }, 60000);
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("booran:session-refresh", onFocus);
    return () => { active = false; controller.abort(); window.clearInterval(interval); window.removeEventListener("focus", onFocus); window.removeEventListener("booran:session-refresh", onFocus); };
  }, [router, retry]);
  const signOut = useCallback(async () => { await logout(); router.replace("/signin"); }, [router]);
  if (error) return <main className="session-state"><Icon name="alert" size={28} /><h1>Unable to load your workspace</h1><p role="alert">{error}</p><div><button className="btn primary" onClick={() => { setError(""); setRetry((value) => value + 1); }}>Try again</button><button className="btn secondary" onClick={() => { void signOut().catch(() => router.replace("/signin")); }}>Back to sign in</button></div></main>;
  if (!user) return <main className="session-state" role="status"><Icon name="shield" size={28} /><h1>Loading your workspace</h1><p>Checking your session and rooftop access…</p></main>;
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession(): AuthUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error("SessionProvider is required.");
  return user;
}
