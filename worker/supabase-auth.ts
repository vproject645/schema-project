// Supabase email-link login and registration for the Cloudflare Worker.
// Replaces the hosting-provided `oai-authenticated-user-id` header that the app
// reads. Secrets (set as Worker *Secrets*): SUPABASE_URL, SUPABASE_ANON_KEY,
// and optionally ALLOWED_EMAILS (comma-separated allowlist).

export interface AuthEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  ALLOWED_EMAILS?: string;
}

const COOKIE = "sb_access";
const HINT = "sb_hint";
const MAX_AGE = 604800; // 7 days cap; also set Supabase JWT expiry to match.

type SbUser = { id: string; email: string };

const base = (env: AuthEnv) => (env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
const configured = (env: AuthEnv) => Boolean(base(env) && env.SUPABASE_ANON_KEY?.trim());
export const authConfigured = configured;

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

const MARK = `<svg viewBox="200 207 884 884" width="30" height="30" fill="currentColor" aria-hidden="true"><path d="M638 207 1012 423 805 542.5 575 409.5 575 758 272 583 272 418Z"/><path d="M646 1091 272 875 479 755.5 709 888.5 709 540 1012 715 1012 880Z"/></svg>`;

const CSS = `*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;font:16px/1.5 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#17211a;background:#f6f7f2;min-height:100vh;display:grid;-webkit-font-smoothing:antialiased}
a{color:inherit}.shell{display:grid;min-height:100vh}.side{display:none;background:#17211a;color:#e8efe0;padding:48px;flex-direction:column;justify-content:space-between}
.brand{display:inline-flex;align-items:center;gap:10px;font-weight:700;font-size:18px;letter-spacing:-.02em;text-decoration:none;color:inherit}
.side h2{font-size:34px;line-height:1.1;letter-spacing:-.03em;margin:0 0 16px;max-width:12em}.side p{color:#aab6a3;margin:0;max-width:26em}.side ul{list-style:none;padding:0;margin:32px 0 0;display:grid;gap:14px}.side li{display:flex;gap:10px;color:#cfdac7;font-size:15px}.side li::before{content:"";flex:none;width:18px;height:18px;margin-top:2px;border-radius:50%;background:#c4ec63 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2317211a' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12l5 5 9-10'/%3E%3C/svg%3E") center/12px no-repeat}
.main{display:grid;align-content:center;justify-items:center;padding:24px 20px 40px;gap:28px}.top{width:100%;max-width:400px;display:flex;justify-content:space-between;align-items:center}.top .brand{font-size:17px}.top a.back{font-size:14px;color:#5d685b;text-decoration:none}.top a.back:hover{color:#17211a}
.card{width:100%;max-width:400px;background:#fff;border:1px solid #dfe3d9;border-radius:16px;padding:28px;box-shadow:0 24px 48px -32px #17211a66}
h1{font-size:26px;line-height:1.15;letter-spacing:-.03em;margin:0 0 6px}.sub{margin:0 0 22px;color:#5d685b;font-size:15px}
label{display:block;font-size:14px;font-weight:600;margin-bottom:6px}input{width:100%;height:48px;padding:0 14px;font:inherit;font-size:16px;border:1px solid #c9cfc2;border-radius:10px;background:#fff;color:#17211a;transition:border-color .15s,box-shadow .15s}input:focus{outline:0;border-color:#44543c;box-shadow:0 0 0 3px #44543c33}
button.go{width:100%;height:50px;margin-top:14px;border:0;border-radius:10px;background:#17211a;color:#fff;font:inherit;font-weight:650;font-size:16px;cursor:pointer;transition:background .15s,transform .1s}button.go:hover{background:#243127}button.go:active{transform:translateY(1px)}button.go:disabled{opacity:.65;cursor:progress}button.go:focus-visible,a:focus-visible,button.lnk:focus-visible{outline:2px solid #44543c;outline-offset:3px}
#m{min-height:22px;margin:12px 0 0;font-size:14px}#m.err{color:#944a38}#m a{font-weight:600}
.alt{margin:20px 0 0;text-align:center;font-size:14px;color:#5d685b}.alt a{font-weight:650;color:#17211a}
.ok{text-align:center;display:none}.ok .tick{width:52px;height:52px;border-radius:50%;background:#c4ec63;display:grid;place-items:center;margin:0 auto 16px}.ok p{color:#5d685b;font-size:15px;margin:6px 0 0}.ok b{color:#17211a;word-break:break-all}
button.lnk{background:none;border:0;padding:6px;font:inherit;font-size:14px;font-weight:600;color:#17211a;text-decoration:underline;cursor:pointer}button.lnk:disabled{color:#8a9386;text-decoration:none;cursor:default}
.fine{max-width:400px;text-align:center;font-size:12.5px;color:#5d685b;margin:0}
@media (min-width:900px){.shell{grid-template-columns:minmax(380px,5fr) 6fr}.side{display:flex}.top .brand{display:none}.top{justify-content:flex-end}}`;

type Mode = "login" | "register";

function authPage(mode: Mode, env: AuthEnv): Response {
  const login = mode === "login";
  const title = login ? "Log in to Schema" : "Create your Schema account";
  const label = login ? "Log in" : "Create account";
  const body = `<div class="shell">
<aside class="side"><a class="brand" href="/">${MARK}<span>Schema</span></a>
<div><h2>The autonomous project agent for commercial fit-outs.</h2><p>Brief and PDFs in. Reviewed handoff out. You approve every decision that matters.</p>
<ul><li>Sign in with your email and password</li><li>Page-level evidence for every claim</li><li>Nothing leaves the workspace without your approval</li></ul></div>
<p style="font-size:13px;color:#7d8a76;margin:0">Meta Global AI Developer Hackathon</p></aside>
<main class="main"><div class="top"><a class="brand" href="/">${MARK}<span>Schema</span></a><a class="back" href="/">← Back to site</a></div>
<div class="card"><div id="form"><h1>${login ? "Welcome back" : "Create your account"}</h1>
<p class="sub">${login ? "Enter your email and password to continue." : "Choose an email and a password (at least 8 characters)."}</p>
<form id="f" novalidate><label for="e">Email address</label><input id="e" type="email" required placeholder="you@company.com" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" autofocus>
<label for="p" style="margin-top:14px">Password</label><input id="p" type="password" required placeholder="${login ? "Your password" : "At least 8 characters"}" autocomplete="${login ? "current-password" : "new-password"}">
<button class="go" id="b" type="submit">${label}</button><p id="m" role="status" aria-live="polite"></p></form>
<p class="alt">${login ? `New to Schema? <a href="/register" id="sw">Register</a>` : `Already have an account? <a href="/login" id="sw">Log in</a>`}</p></div>
<div class="ok" id="ok" role="status"><div class="tick"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#17211a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg></div>
<h1>Check your email</h1><p>We sent a confirmation link to <b id="to"></b>. Open it, then log in.</p>
<p style="margin-top:18px"><a class="lnk" href="/login">Go to log in</a></p></div></div>
<p class="fine">By continuing you agree to use Schema for professional project coordination. Schema does not issue permits or provide legal or engineering sign-off.</p></main></div>`;
  const script = `const SB=${esc(base(env))},KEY=${esc(env.SUPABASE_ANON_KEY!.trim())},LOGIN=${login ? "true" : "false"},LABEL=${esc(label)};
const $=id=>document.getElementById(id),f=$('f'),e=$('e'),p=$('p'),b=$('b'),m=$('m');
const safe=v=>typeof v==='string'&&v[0]==='/'&&v[1]!=='/'&&v[1]!=='\\\\'?v:'/app';
const nx=new URLSearchParams(location.search).get('next');
if(nx)$('sw').href+='?next='+encodeURIComponent(safe(nx));
function fail(t){m.className='err';m.textContent=t;b.disabled=false;b.textContent=LABEL}
async function finish(d){
  const r=await fetch('/auth/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({access_token:d.access_token,expires_in:d.expires_in||3600})});
  if(r.ok){location.replace(nx?safe(nx):'/app');return}
  fail(r.status===403?'This email is not allowed on this workspace.':'Sign-in failed. Please try again.')
}
async function submit(){
  const email=e.value.trim(),pw=p.value;
  if(email.indexOf('@')<1||email.indexOf('.',email.indexOf('@'))<0){fail('Enter a valid email address.');e.focus();return}
  if(pw.length<8){fail(LOGIN?'Enter your password.':'Password must be at least 8 characters.');p.focus();return}
  b.disabled=true;b.textContent='Please wait…';m.className='';m.textContent='';
  try{
    const url=LOGIN?SB+'/auth/v1/token?grant_type=password':SB+'/auth/v1/signup';
    const r=await fetch(url,{method:'POST',headers:{apikey:KEY,'content-type':'application/json'},body:JSON.stringify({email:email,password:pw})});
    let d={};try{d=await r.json()}catch(_){}
    if(r.ok&&d.access_token){await finish(d);return}
    if(r.ok&&!LOGIN){$('to').textContent=email;$('form').style.display='none';$('ok').style.display='block';return}
    const txt=JSON.stringify(d).toLowerCase();
    if(r.status===429||txt.indexOf('rate')>=0)fail('Too many attempts. Please wait a minute and try again.');
    else if(LOGIN&&txt.indexOf('not confirmed')>=0)fail('Please confirm your email first, then log in.');
    else if(LOGIN)fail('Wrong email or password.');
    else if(txt.indexOf('already')>=0)m.innerHTML='That email is already registered. <a href="/login">Log in instead</a>.',m.className='err',b.disabled=false,b.textContent=LABEL;
    else if(txt.indexOf('weak')>=0||txt.indexOf('password')>=0)fail('Choose a stronger password (at least 8 characters).');
    else fail('Could not complete that. Check your details and try again.');
  }catch(_){fail('Network error. Check your connection and try again.')}
}
f.addEventListener('submit',ev=>{ev.preventDefault();if(!b.disabled)submit()});`;
  return html(title, body, script);
}

function html(title: string, body: string, script: string, status = 200): Response {
  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#17211a"><meta name="robots" content="noindex"><title>${title}</title><link rel="icon" href="/icon.svg" type="image/svg+xml"><style>${CSS}</style></head><body>${body}<script>${script}</script></body></html>`;
  return new Response(doc, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

function messagePage(title: string, heading: string, text: string, status: number, script = ""): Response {
  const body = `<main class="main" style="min-height:100vh"><div class="card" style="text-align:center"><div style="display:flex;justify-content:center;margin-bottom:14px">${MARK}</div><h1>${heading}</h1><p class="sub" id="m" style="margin:8px 0 18px">${text}</p><a href="/" style="font-weight:650">← Back to site</a></div></main>`;
  return html(title, body, script, status);
}

function cookieHeader(value: string, maxAge: number): string {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

// Readable-by-script marker so the public site can show "Open workspace" instantly.
// It carries no identity and grants nothing; the server still verifies every request.
function hintHeader(on: boolean, maxAge: number): string {
  return `${HINT}=${on ? "1" : ""}; Path=/; Secure; SameSite=Lax; Max-Age=${on ? maxAge : 0}`;
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status: 302, headers });
}

/** Handles /login, /register, /auth/callback, /auth/session and sign-out. Returns null for other paths. */
export async function handleAuthRoutes(request: Request, env: AuthEnv, isDev = false): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;

  if (p === "/signout-with-chatgpt" || p === "/auth/logout") {
    return redirect("/", [cookieHeader("", 0), hintHeader(false, 0)]);
  }
  const isLogin = p === "/login" || p === "/signin-with-chatgpt";
  const isRegister = p === "/register";
  if (!isLogin && !isRegister && p !== "/auth/callback" && p !== "/auth/session") return null;

  if (!configured(env)) {
    // Local preview keeps the built-in mock sign-in working.
    if (isDev && (isLogin || isRegister) && p !== "/signin-with-chatgpt") return redirect("/signin-with-chatgpt?returnTo=%2Fapp");
    return messagePage("Sign-in unavailable", "Sign-in isn’t set up yet", "The site owner still needs to configure SUPABASE_URL and SUPABASE_ANON_KEY.", 503);
  }

  if (isLogin || isRegister) {
    // Already signed in? Skip the form.
    const existing = readCookie(request, COOKIE);
    if (existing && (await verify(env, existing))) return redirect("/app");
    return authPage(isRegister ? "register" : "login", env);
  }

  if (p === "/auth/callback") {
    return html("Signing in", `<main class="main" style="min-height:100vh"><div class="card" style="text-align:center"><div style="display:flex;justify-content:center;margin-bottom:14px">${MARK}</div><h1>Signing you in…</h1><p class="sub" id="m">One moment.</p></div></main>`,
      `(async()=>{const m=document.getElementById('m');const h=new URLSearchParams(location.hash.slice(1));const t=h.get('access_token');
if(!t){m.textContent='This link is invalid or has expired.';m.insertAdjacentHTML('beforeend',' <a href="/login" style="font-weight:650">Request a new one</a>.');return;}
const r=await fetch('/auth/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({access_token:t,expires_in:Number(h.get('expires_in'))||3600})});
if(r.ok){let n='/app';try{const v=localStorage.getItem('schema.next');localStorage.removeItem('schema.next');if(v&&v[0]==='/'&&v[1]!=='/'&&v[1]!=='\\\\')n=v}catch(_){}history.replaceState(null,'',n);location.replace(n);}
else{m.textContent=r.status===403?'This email is not allowed on this workspace.':'Sign-in failed. Please request a new link.';}})();`);
  }

  // POST /auth/session
  if (request.method !== "POST" || request.headers.get("origin") !== url.origin) return new Response("Forbidden", { status: 403 });
  let data: { access_token?: unknown; expires_in?: unknown };
  try { data = (await request.json()) as typeof data; } catch { return new Response("Bad request", { status: 400 }); }
  const token = typeof data.access_token === "string" ? data.access_token : "";
  if (!(await verify(env, token))) return new Response("Forbidden", { status: 403 });
  const ttl = Math.min(Math.max(Number(data.expires_in) || 3600, 60), MAX_AGE);
  const headers = new Headers();
  headers.append("set-cookie", cookieHeader(token, ttl));
  headers.append("set-cookie", hintHeader(true, ttl));
  return new Response(null, { status: 204, headers });
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
