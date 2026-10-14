"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  conversationRequest,
  mapProspect,
  type ApiProspect,
  type LiveProspect,
} from "@/lib/conversations";
import { useSession } from "../auth/session-provider";

const ProspectContext = createContext<{
  prospects: LiveProspect[];
  loading: boolean;
  error: string;
  refresh: () => void;
} | null>(null);
export function ProspectProvider({ children }: { children: ReactNode }) {
  const user = useSession();
  const scopeKey = `${user.id}-${user.apiRole}-${user.rooftopIds.join(",")}`;
  const [prospects, setProspects] = useState<LiveProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const data = await conversationRequest<ApiProspect[]>("", {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setProspects(data.map(mapProspect));
          setError("");
        }
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load prospects.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 10000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [version, scopeKey]);
  const visible = prospects.filter((p) => {
    if (!user.rooftopIds.includes(p.api.rooftopId)) return false;
    const owner = p.api.assignedTo;
    return (
      !user.ownProspectsOnly ||
      !owner?.name ||
      owner.name === "Unassigned" ||
      (owner.id
        ? owner.id === user.id
        : owner.email
          ? owner.email.toLowerCase() === user.email.toLowerCase()
          : owner.name === user.name)
    );
  });
  return (
    <ProspectContext.Provider
      value={{
        prospects: visible,
        loading,
        error,
        refresh: () => setVersion((v) => v + 1),
      }}
    >
      {children}
    </ProspectContext.Provider>
  );
}
export function useProspects() {
  const context = useContext(ProspectContext);
  if (!context) throw new Error("ProspectProvider is required");
  return context;
}
