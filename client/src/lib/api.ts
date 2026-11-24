const base = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/$/, "");
export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      cache: "no-store",
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
  } catch {
    throw new Error("Không kết nối được Backend API. Kiểm tra npm run dev và PostgreSQL.");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `API HTTP ${response.status}`);
  return body as T;
}
export function qs(data: Record<string, string | number>) {
  return new URLSearchParams(Object.entries(data).map(([k, v]) => [k, String(v)])).toString();
}
export type ApiStation = { id: string; name: string; region: string; status: string };
export type ApiQuote = { segments: number; base: number; discount: number; total: number };
