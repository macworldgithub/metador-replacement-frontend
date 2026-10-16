"use client";

export type Rooftop = {
  id: string;
  name: string;
  address: string;
  displayPhone: string;
  senderPhone: string;
  brand: string;
};

export async function fetchRooftops(): Promise<Rooftop[]> {
  const res = await fetch("/api/rooftops", { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) return [];
  return res.json();
}
