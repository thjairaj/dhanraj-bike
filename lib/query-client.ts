import { fetch } from "expo/fetch";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { QueryClient, QueryFunction } from "@tanstack/react-query";

const FALLBACK_HOST = "https://dhanraj-bike-production.up.railway.app";

/**
 * Turns whatever is configured (bare host, "https://host", "https://host/",
 * accidental "https://https://host", "https:/host") into a clean origin
 * like "https://host". Never returns a URL whose host is "https".
 */
function normalizeBaseUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  // Strip every leading protocol (handles doubled "https://https://")
  s = s.replace(/^(?:https?:?\/*)+/i, "");
  // Drop path / trailing slashes
  s = s.replace(/\/.*$/, "");
  if (!s || s.toLowerCase() === "https" || s.toLowerCase() === "http") return null;
  const isLocal = /^(localhost|127\.|10\.|192\.168\.)/.test(s);
  return `${isLocal ? "http" : "https"}://${s}`;
}

/**
 * Gets the base URL for the Express API server.
 * - Web: same origin as the page.
 * - Native (APK): first valid value of EXPO_PUBLIC_API_URL, EXPO_PUBLIC_DOMAIN,
 *   app.config extra.apiUrl, then the Railway fallback. All are normalised,
 *   so a protocol-prefixed or bare host both work.
 */
export function getApiUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  return (
    normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL) ||
    normalizeBaseUrl(process.env.EXPO_PUBLIC_DOMAIN) ||
    normalizeBaseUrl((Constants.expoConfig?.extra as any)?.apiUrl) ||
    FALLBACK_HOST
  );
}

// ── Subscription paywall hook ────────────────────────────────────────────────
// The server answers HTTP 402 on every data route once an agency's trial or
// subscription has ended. AuthContext registers a handler here that re-checks
// the subscription and lets the root layout move the user to the paywall.
let onSubscriptionRequired: (() => void) | null = null;

export function setSubscriptionRequiredHandler(fn: (() => void) | null) {
  onSubscriptionRequired = fn;
}

// Call with any response from our API (including ones made with raw fetch).
export function notifyIfSubscriptionRequired(res: { status: number }) {
  if (res.status === 402) onSubscriptionRequired?.();
}

async function throwIfResNotOk(res: Response) {
  notifyIfSubscriptionRequired(res);
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);
  const res = await fetch(url.toString(), {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);
    const res = await fetch(url.toString(), {
      credentials: "include",
    });
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }
    await throwIfResNotOk(res); // also handles 402 via notifyIfSubscriptionRequired
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
