// ZoomInfo Enterprise API client: authentication, token caching, and a
// thin authorized-request helper. Everything else under lib/zoominfo
// builds on zoomInfoRequest().
//
// AUTH
// ZoomInfo issues a JWT valid ~60 minutes from {BASE}/authenticate. Two
// credential modes are supported and auto-detected from the environment:
//
//   PKI (recommended):  ZOOMINFO_USERNAME + ZOOMINFO_CLIENT_ID + ZOOMINFO_PRIVATE_KEY
//   Basic:              ZOOMINFO_USERNAME + ZOOMINFO_PASSWORD
//
// Tokens are generated with ZoomInfo's official `zoominfo-api-auth-client`
// package, imported dynamically so a missing/!installed dependency yields a
// clear, contained error instead of breaking the build or the rest of the
// app. Basic auth additionally has a dependency-free native fallback.
//
// Docs: https://docs.zoominfo.com/  (Enterprise API)

const DEFAULT_BASE_URL = "https://api.zoominfo.com";

export type ZoomInfoAuthMode = "pki" | "basic" | "none";

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

// Module-level cache. Next.js keeps the server module warm across requests,
// so this avoids re-authenticating (and burning the 60-min token) on every
// call. inFlight de-dupes concurrent first-time auths.
let cached: CachedToken | null = null;
let inFlight: Promise<string> | null = null;

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export function zoomInfoBaseUrl(): string {
  return env("ZOOMINFO_BASE_URL") ?? DEFAULT_BASE_URL;
}

// PEM private keys carry newlines that are awkward in .env files, so the
// convention is to store them with literal "\n" escapes. Restore them.
function normalizePrivateKey(key: string): string {
  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
}

export function zoomInfoAuthMode(): ZoomInfoAuthMode {
  if (!env("ZOOMINFO_USERNAME")) return "none";
  if (env("ZOOMINFO_CLIENT_ID") && env("ZOOMINFO_PRIVATE_KEY")) return "pki";
  if (env("ZOOMINFO_PASSWORD")) return "basic";
  return "none";
}

export function isZoomInfoConfigured(): boolean {
  return zoomInfoAuthMode() !== "none";
}

export interface ZoomInfoConfigStatus {
  configured: boolean;
  mode: ZoomInfoAuthMode;
  baseUrl: string;
  missing: string[];
}

// Non-secret summary of how auth is configured. Safe to return from a
// status endpoint: never exposes the password, client id, or private key.
export function zoomInfoConfigStatus(): ZoomInfoConfigStatus {
  const mode = zoomInfoAuthMode();
  const missing: string[] = [];
  if (!env("ZOOMINFO_USERNAME")) missing.push("ZOOMINFO_USERNAME");
  if (mode === "none") {
    missing.push(
      "ZOOMINFO_PASSWORD (or ZOOMINFO_CLIENT_ID + ZOOMINFO_PRIVATE_KEY)"
    );
  }
  return { configured: mode !== "none", mode, baseUrl: zoomInfoBaseUrl(), missing };
}

// CommonJS/ESM interop: the auth client is CJS, so named exports may live on
// the module root or under `.default` depending on the bundler's wrapping.
function pickFn(mod: unknown, name: string): ((...a: string[]) => Promise<string>) | null {
  const root = mod as Record<string, unknown> | null | undefined;
  if (root && typeof root[name] === "function") {
    return root[name] as (...a: string[]) => Promise<string>;
  }
  const def = root?.default as Record<string, unknown> | undefined;
  if (def && typeof def[name] === "function") {
    return def[name] as (...a: string[]) => Promise<string>;
  }
  return null;
}

async function loadAuthClient(): Promise<unknown | null> {
  try {
    return await import("zoominfo-api-auth-client");
  } catch {
    return null;
  }
}

// Dependency-free basic-auth fallback. Mirrors what the official client does
// for username/password: POST credentials to /authenticate, read back `jwt`.
async function basicAuthNative(username: string, password: string): Promise<string> {
  const res = await fetch(`${zoomInfoBaseUrl()}/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ZoomInfo authenticate ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { jwt?: string };
  if (!data.jwt) throw new Error("ZoomInfo authenticate response missing 'jwt'.");
  return data.jwt;
}

async function generateToken(): Promise<string> {
  const mode = zoomInfoAuthMode();
  const username = env("ZOOMINFO_USERNAME");
  if (mode === "none" || !username) {
    throw new Error(
      "ZoomInfo is not configured. Set ZOOMINFO_USERNAME plus either " +
        "ZOOMINFO_PASSWORD or ZOOMINFO_CLIENT_ID + ZOOMINFO_PRIVATE_KEY."
    );
  }

  const authClient = await loadAuthClient();

  if (mode === "pki") {
    const clientId = env("ZOOMINFO_CLIENT_ID")!;
    const privateKey = normalizePrivateKey(env("ZOOMINFO_PRIVATE_KEY")!);
    const pki = pickFn(authClient, "getAccessTokenViaPKI");
    if (!pki) {
      throw new Error(
        "PKI auth requires the 'zoominfo-api-auth-client' package. Run " +
          "`npm install` (it is listed in package.json), or switch to " +
          "ZOOMINFO_PASSWORD basic auth."
      );
    }
    const token = await pki(username, clientId, privateKey);
    if (!token) throw new Error("ZoomInfo PKI authentication returned no token.");
    return token;
  }

  // basic
  const password = env("ZOOMINFO_PASSWORD")!;
  const basic = pickFn(authClient, "getAccessTokenViaBasicAuth");
  if (basic) {
    const token = await basic(username, password);
    if (token) return token;
  }
  return basicAuthNative(username, password);
}

// Returns a valid JWT, generating + caching one if needed. Refreshes ~5 min
// before the 60-minute expiry. Pass forceRefresh after a 401 to re-auth.
export async function getZoomInfoToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cached && cached.expiresAt > now + 60_000) {
    return cached.token;
  }
  if (!forceRefresh && inFlight) return inFlight;

  inFlight = (async () => {
    const token = await generateToken();
    cached = { token, expiresAt: Date.now() + 55 * 60_000 };
    return token;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export interface ZoomInfoRequestOptions {
  method?: "POST" | "GET";
  body?: unknown;
  /** Override the default 30s request timeout. */
  timeoutMs?: number;
}

// Authorized request against the ZoomInfo API. Adds the Bearer token,
// retries once on 401/403 with a fresh token, and surfaces a readable error
// (status + truncated body) on failure. Generic T is the parsed JSON shape.
export async function zoomInfoRequest<T = unknown>(
  path: string,
  options: ZoomInfoRequestOptions = {}
): Promise<T> {
  const { method = "POST", body, timeoutMs = 30_000 } = options;
  const url = `${zoomInfoBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;

  const doFetch = async (token: string) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let token = await getZoomInfoToken();
  let res = await doFetch(token);

  // One automatic retry on auth expiry/invalidation.
  if (res.status === 401 || res.status === 403) {
    token = await getZoomInfoToken(true);
    res = await doFetch(token);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ZoomInfo ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}
