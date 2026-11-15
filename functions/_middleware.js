const COOKIE_NAME = "__Host-ap_access";
const MAX_AGE_SECONDS = 86400;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}

async function sign(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function makeToken(secret) {
  const issued = Math.floor(Date.now() / 1000);
  const payload = String(issued);
  return payload + "." + await sign(secret, payload);
}

async function validToken(secret, token) {
  if (!token || !token.includes(".")) return false;
  const [issuedText, signature] = token.split(".");
  if (!/^\d+$/.test(issuedText) || !signature) return false;
  const issued = Number(issuedText);
  const now = Math.floor(Date.now() / 1000);
  if (issued > now + 30 || now - issued > MAX_AGE_SECONDS) return false;
  return (await sign(secret, issuedText)) === signature;
}

function cookieValue(request) {
  const raw = request.headers.get("Cookie") || "";
  const item = raw.split(";").map(v => v.trim()).find(v => v.startsWith(COOKIE_NAME + "="));
  return item ? decodeURIComponent(item.slice(COOKIE_NAME.length + 1)) : "";
}

function loginPage(target, error = "") {
  const safeTarget = target.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return new Response(`<!doctype html>
<html lang="hi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Secure Access</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at top,#292929,#080808 65%);font-family:Arial,sans-serif;color:#fff}
.card{width:min(420px,92vw);padding:32px 26px;border:1px solid #ef233c;border-radius:18px;background:#151515;box-shadow:0 0 30px #ef233c44;text-align:center}
h2{color:#40dfe3;margin:0 0 10px}p{color:#ccc}input{width:100%;padding:15px;border-radius:9px;border:1px solid #555;background:#080808;color:white;font-size:18px;text-align:center;letter-spacing:5px;margin:12px 0}
button{width:100%;padding:14px;border:0;border-radius:9px;background:#ef233c;color:#fff;font-weight:bold;font-size:16px;cursor:pointer}
.err{color:#ff929f;min-height:22px;margin:8px 0}
</style></head><body><main class="card"><h2>🔐 Secure Website</h2><p>आगे बढ़ने के लिए Password डालें</p>
<form id="login"><input id="password" type="password" inputmode="numeric" autocomplete="current-password" placeholder="Enter Password" required autofocus>
<div class="err" id="error">${error}</div><button type="submit">Unlock Website</button></form></main>
<script>
const target = ${JSON.stringify(target)};
document.getElementById("login").addEventListener("submit", async e => {
 e.preventDefault();
 const btn=e.submitter; btn.disabled=true; btn.textContent="Verifying...";
 try {
  const r=await fetch("/__auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:document.getElementById("password").value,target})});
  const d=await r.json();
  if(!r.ok||!d.ok) throw new Error("गलत Password");
  location.replace(d.redirect);
 } catch(err) {
  document.getElementById("error").textContent=err.message||"Verification failed";
  btn.disabled=false;btn.textContent="Unlock Website";
  document.getElementById("password").select();
 }
});
</script></body></html>`, {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Firebase Web API keys identify the Firebase project/app; they are not
  // authorization credentials. Return the configured value without caching.
  if (url.pathname === "/__config/firebase" && request.method === "GET") {
    if (!env.FIREBASE_API_KEY) return json({ ok: false, error: "FIREBASE_API_KEY is not configured" }, 503);
    return json({ apiKey: env.FIREBASE_API_KEY, projectId: "agent-performance-live" }, 200, {
      "cache-control": "no-store"
    });
  }

  if (url.pathname === "/__auth/login" && request.method === "POST") {
    if (!env.SITE_PASSWORD) return json({ ok: false, error: "SITE_PASSWORD secret is not configured" }, 503);
    let body;
    try { body = await request.json(); } catch { return json({ ok: false }, 400); }
    if (String(body.password || "") !== String(env.SITE_PASSWORD)) return json({ ok: false }, 401);
    const token = await makeToken(env.SITE_PASSWORD);
    const target = typeof body.target === "string" && body.target.startsWith("/") && !body.target.startsWith("//")
      ? body.target.split("?")[0].split("#")[0] : "/";
    const redirect = target + (target.includes("?") ? "&" : "?") + "__access=" + encodeURIComponent(token);
    return json({ ok: true, redirect }, 200, {
      "set-cookie": `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; Secure; HttpOnly; SameSite=Strict`
    });
  }

  if (url.pathname === "/__auth/verify" && request.method === "POST") {
    if (!env.SITE_PASSWORD) return json({ ok: false }, 503);
    let body;
    try { body = await request.json(); } catch { return json({ ok: false }, 400); }
    return json({ ok: String(body.password || "") === String(env.SITE_PASSWORD) }, 200);
  }

  if (url.pathname.startsWith("/__auth/")) return json({ ok: false }, 404);

  if (!env.SITE_PASSWORD) {
    return new Response("SITE_PASSWORD secret is not configured in Cloudflare Pages.", {
      status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }

  const isDocumentNavigation =
    request.method === "GET" &&
    request.headers.get("Sec-Fetch-Mode") === "navigate" &&
    (request.headers.get("Accept") || "").includes("text/html");

  if (isDocumentNavigation) {
    const access = url.searchParams.get("__access");
    if (!(await validToken(env.SITE_PASSWORD, access))) {
      const target = url.pathname + (url.search ? url.search.replace(/([?&])__access=[^&]*/g, "$1").replace(/[?&]$/, "") : "");
      return loginPage(target);
    }
    let response = await next();
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      let html = await response.text();
      if (!html.includes("/auth-gate.js")) {
        html = html.replace(/<\/body>/i, '<script src="/auth-gate.js" defer></script></body>');
      }
      const newHeaders = new Headers(response.headers);
      newHeaders.delete("content-length");
      response = new Response(html, { status: response.status, statusText: response.statusText, headers: newHeaders });
    }
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
    headers.append("set-cookie", `${COOKIE_NAME}=${encodeURIComponent(access)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; Secure; HttpOnly; SameSite=Strict`);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  // Static resources are allowed only with a recent cookie minted by login.
  const token = cookieValue(request);
  if (!(await validToken(env.SITE_PASSWORD, token))) {
    return new Response("Unauthorized", { status: 401, headers: { "cache-control": "no-store" } });
  }

  return next();
}
