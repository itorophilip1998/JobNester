"use client";
export async function apiFetch(url: string, init: RequestInit = {}) {
  const clerk = (
    window as unknown as {
      Clerk?: {
        loaded?: boolean;
        session?: { getToken: () => Promise<string | null> };
      };
    }
  ).Clerk;
  const token = await clerk?.session?.getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, credentials: "include", headers });
}

export async function connectIntegration(provider: "gmail" | "linkedin") {
  const api = process.env.NEXT_PUBLIC_API_URL || "";
  const r = await apiFetch(`${api}/api/integrations/${provider}/connect`, {
    headers: { Accept: "application/json" },
  });
  const data = await r.json();
  if (!r.ok || !data.url)
    throw new Error(data.message || "Integration connection failed.");
  window.location.assign(data.url);
}
