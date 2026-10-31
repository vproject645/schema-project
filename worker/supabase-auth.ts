// Supabase email-link sign-in for the Cloudflare Worker.
// Replaces the hosting-provided `oai-authenticated-user-id` header that the app
// reads. Secrets (set as Worker *Secrets*): SUPABASE_URL, SUPABASE_ANON_KEY,
// and optionally ALLOWED_EMAILS (comma-separated allowlist).

export interface AuthEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  ALLOWED_EMAILS?: string;
}

const COOKIE = "sb_access";
const MAX_AGE = 604800; // 7 days cap; also set Supabase JWT expiry to match.

type SbUser = { id: string; email: string };

const base = (env: AuthEnv) => (env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
const configured = (env: AuthEnv) => Boolean(base(env) && env.SUPABASE_ANON_KEY?.trim());

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

function allowed(env: AuthEnv, email: string): boolean {
  const list = (env.ALLOWED_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.length === 0 || list.includes(email.toLowerCase());
}

async function verify(env: AuthEnv, token: string): Promise<SbUser | null> {
  if (!configured(env) || !token || token.length > 4096) return null;
  try {
    const r = await fetch(`${base(env)}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY!.trim(), authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = (await r.json()) as { id?: string; email?: string };
    if (!u.id || !u.email || !allowed(env, u.email)) return null;
    return { id: u.id, email: u.email };
  } catch {
    return null;
  }
}

const esc = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

function page(title: string, body: string, script: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font:16px system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#f6f5f1;color:#1d2420}
main{width:min(92vw,380px);background:#fff;padding:28px;border-radius:12px;box-shadow:0 1px 8px #0002}
input,button{width:100%;box-sizing:border-box;padding:12px;font-size:16px;border-radius:8px;border:1px solid #bbb;margin-top:10px}
button{background:#1d2420;color:#fff;border-color:#1d2420;cursor:pointer}p{min-height:1.4em}</style></head>
<body><main>${body}</main><script>${script}</script></body></html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function cookieHeader(value: string, maxAge: number): string {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/** Handles /login, /auth/callback, /auth/session and sign-out. Returns null for other paths. */
export async function handleAuthRoutes(request: Request, env: AuthEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;

  if (p === "/signout-with-chatgpt" || p === "/auth/logout") {
    return new Response(null, { status: 302, headers: { location: "/", "set-cookie": cookieHeader("", 0) } });
  }
  if (p !== "/login" && p !== "/signin-with-chatgpt" && p !== "/auth/callback" && p !== "/auth/session") return null;
  if (!configured(env)) return new Response("Sign-in is not configured (set SUPABASE_URL and SUPABASE_ANON_KEY).", { status: 503 });

  if (p === "/login" || p === "/signin-with-chatgpt") {
    return page("Sign in to Schema", `<h1 style="font-size:20px;margin:0 0 6px">Sign in to Schema</h1>
<form id="f"><input id="e" type="email" required placeholder="you@example.com" autocomplete="email">
<button>Email me a sign-in link</button></form><p id="m"></p>`,
      `const SB=${esc(base(env))},KEY=${esc(env.SUPABASE_ANON_KEY!.trim())};
document.getElementById('f').onsubmit=async ev=>{ev.preventDefault();const m=document.getElementById('m');m.textContent='Sending…';
try{const r=await fetch(SB+'/auth/v1/otp?redirect_to='+encodeURIComponent(location.origin+'/auth/callback'),
{method:'POST',headers:{apikey:KEY,'content-type':'application/json'},body:JSON.stringify({email:document.getElementById('e').value,create_user:true})});
m.textContent=r.ok?'Check your email for the sign-in link.':'Could not send the link. Try again.';}catch{m.textContent='Network error.';}};`);
  }

  if (p === "/auth/callback") {
    return page("Signing in", `<p id="m">Signing you in…</p>`,
      `(async()=>{const m=document.getElementById('m');const h=new URLSearchParams(location.hash.slice(1));const t=h.get('access_token');
if(!t){m.textContent='This link is invalid or expired. Go back to /login and request a new one.';return;}
const r=await fetch('/auth/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({access_token:t,expires_in:Number(h.get('expires_in'))||3600})});
if(r.ok){history.replaceState(null,'','/');location.replace('/');}else{m.textContent=r.status===403?'This email is not allowed on this workspace.':'Sign-in failed. Request a new link.';}})();`);
  }

  // POST /auth/session
  if (request.method !== "POST" || request.headers.get("origin") !== url.origin) return new Response("Forbidden", { status: 403 });
  let data: { access_token?: unknown; expires_in?: unknown };
  try { data = (await request.json()) as typeof data; } catch { return new Response("Bad request", { status: 400 }); }
  const token = typeof data.access_token === "string" ? data.access_token : "";
  if (!(await verify(env, token))) return new Response("Forbidden", { status: 403 });
  const ttl = Math.min(Math.max(Number(data.expires_in) || 3600, 60), MAX_AGE);
  return new Response(null, { status: 204, headers: { "set-cookie": cookieHeader(token, ttl) } });
}

/** Strips any client-supplied identity headers, then sets them from a verified Supabase session. */
export async function withUser(request: Request, env: AuthEnv, isDev = false): Promise<Request> {
  if (isDev && !configured(env)) return request; // keep the local mock sign-in working
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) if (name.toLowerCase().startsWith("oai-authenticated-user-")) headers.delete(name);
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const user = await verify(env, readCookie(request, COOKIE) ?? bearer ?? "");
  if (user) {
    headers.set("oai-authenticated-user-id", user.id);
    headers.set("oai-authenticated-user-email", user.email);
  }
  return new Request(request, { headers });
}
