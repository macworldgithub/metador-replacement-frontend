"use client";
import { useEffect, useState } from 'react';
export type Rooftop = { id: string; name: string; address: string; senderPhone: string; displayPhone: string; smsMode?: 'disabled' | 'test_only' | 'enabled';
  sendHours: { start: string; end: string }; closedDays: string[] };
export function useRooftops() {
  const [rooftops, setRooftops] = useState<Rooftop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/rooftops', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Could not load dealership configuration.');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid dealership configuration response.');
      if (!controller.signal.aborted) setRooftops(data);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  return { rooftops, loading, error };
}
