// Florida State Roleplay — entire site in one file.
// No app/pages folders: Vercel just runs this one function for every
// request (see vercel.json), and the routing below decides what happens
// based on req.url. Edit the OWNERS / DISCORD_URL constants below to
// change home page content.

const { sql } = require("@vercel/postgres");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// ---------------------------------------------------------------------
// Site content — edit these
// ---------------------------------------------------------------------
const DISCORD_URL = "https://discord.gg/hDkZt5kS8V";
const OWNERS = [
  { name: "Owner Name", title: "Founder" },
  { name: "Owner Name", title: "Co-Founder" },
  { name: "Owner Name", title: "Co-Founder" },
];

// ---------------------------------------------------------------------
// Ranks
// ---------------------------------------------------------------------
const RANK_TIERS = [
  { value: "low", label: "Low Ranking" },
  { value: "mid", label: "Mid Ranking" },
  { value: "high", label: "High Ranking" },
  { value: "founder", label: "Foundership" },
];
const TIER_SORT = { founder: 0, high: 1, mid: 2, low: 3 };
function tierLabel(t) {
  const found = RANK_TIERS.find((x) => x.value === t);
  return found ? found.label : t;
}
function canEdit(session) {
  return !!session && (session.rankTier === "high" || session.rankTier === "founder" || session.isSiteManager);
}

// ---------------------------------------------------------------------
// Sessions (signed cookie, no server-side session store needed)
// ---------------------------------------------------------------------
const SESSION_COOKIE = "fsrp_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set in environment variables.");
  return s;
}
function sign(data) {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}
function createSessionToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}
function verifySessionToken(token) {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// Small HTTP helpers (cookies, body parsing, responses)
// ---------------------------------------------------------------------
function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}
function setSessionCookie(res, value, maxAge) {
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(value)}`, "Path=/", `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}
function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}
function getSession(req) {
  return verifySessionToken(parseCookies(req)[SESSION_COOKIE]);
}
async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try { return JSON.parse(req.body || "{}"); } catch { return {}; }
    }
    return req.body;
  }
  return await new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    setTimeout(() => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    }, 100);
  });
}
function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}
function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
}
function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

// ---------------------------------------------------------------------
// Shared page shell (styling lives here — one place, no build step)
// ---------------------------------------------------------------------
function page(title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=Source+Serif+4:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    --navy:#0F1F3D; --fsblue:#1E4D8C; --steel:#5A82AC; --sun:#E8A33D; --paper:#F4F6F9; --ink:#12141A;
  }
  *{box-sizing:border-box;}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:'Public Sans',sans-serif;line-height:1.5;}
  h1,h2,h3{font-family:'Source Serif 4',serif;color:var(--navy);margin:0;}
  a{color:inherit;}
  .wrap{max-width:960px;margin:0 auto;padding:0 24px;}
  .header{background:var(--navy);color:var(--paper);}
  .header .wrap{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;}
  .brand{display:flex;align-items:center;gap:10px;font-family:'Source Serif 4',serif;font-weight:600;font-size:18px;}
  .navlink{color:rgba(244,246,249,0.75);}
  .navlink:hover{color:var(--paper);}
  .btn{display:inline-block;border-radius:4px;padding:10px 20px;font-weight:600;font-size:14px;cursor:pointer;border:1px solid transparent;}
  .btn-primary{background:var(--fsblue);color:white;}
  .btn-primary:hover{background:var(--navy);}
  .btn-outline{border-color:rgba(15,31,61,0.2);color:var(--navy);background:transparent;}
  .btn-outline:hover{border-color:var(--fsblue);color:var(--fsblue);}
  .btn-outline-dark{border-color:rgba(244,246,249,0.3);color:rgba(244,246,249,0.9);background:transparent;}
  .btn-outline-dark:hover{border-color:var(--sun);color:var(--sun);}
  .hero{padding:80px 0;}
  .hero p{font-size:18px;color:rgba(18,20,26,0.8);max-width:640px;}
  .strip{border-top:1px solid rgba(15,31,61,0.1);border-bottom:1px solid rgba(15,31,61,0.1);background:white;}
  .grid3{display:grid;grid-template-columns:1fr;gap:32px;padding:56px 0;}
  @media(min-width:640px){.grid3{grid-template-columns:repeat(3,1fr);}}
  .card{border:1px solid rgba(15,31,61,0.1);background:white;border-radius:4px;padding:20px;}
  .accent-bar{height:4px;width:40px;background:var(--sun);}
  footer{background:var(--navy);color:rgba(244,246,249,0.7);}
  footer .wrap{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;padding:40px 24px;}
  .login-shell{min-height:100vh;background:var(--navy);display:flex;align-items:center;justify-content:center;padding:24px;}
  .login-card{width:100%;max-width:380px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);border-radius:4px;padding:32px;}
  label{display:block;font-size:14px;margin-bottom:4px;}
  input, textarea, select{width:100%;padding:8px 12px;border-radius:4px;border:1px solid rgba(15,31,61,0.15);font-family:inherit;font-size:14px;background:white;}
  .login-card input{background:var(--navy);border-color:rgba(255,255,255,0.15);color:var(--paper);}
  .field{margin-bottom:14px;}
  .error{color:#dc2626;font-size:14px;}
  .success{color:#15803d;font-size:14px;}
  table{width:100%;border-collapse:collapse;font-size:14px;}
  th{text-align:left;padding:10px 14px;background:rgba(15,31,61,0.05);color:rgba(18,20,26,0.6);font-weight:600;}
  td{padding:10px 14px;border-top:1px solid rgba(15,31,61,0.05);}
  .tag{background:rgba(232,163,61,0.2);color:#8a5a00;border-radius:4px;padding:2px 8px;font-size:12px;margin-left:8px;}
  .tabs{display:flex;gap:4px;border-bottom:1px solid rgba(15,31,61,0.1);margin-bottom:24px;}
  .tab{padding:10px 16px;font-size:14px;font-weight:500;color:rgba(18,20,26,0.5);border-bottom:2px solid transparent;background:none;cursor:pointer;}
  .tab.active{color:var(--fsblue);border-bottom-color:var(--fsblue);}
  .tabpanel{display:none;}
  .tabpanel.active{display:block;}
  .staffheader{background:var(--navy);color:var(--paper);}
  .staffheader .wrap{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;}
  .muted{color:rgba(18,20,26,0.5);}
  .stack > * + *{margin-top:16px;}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

// ---------------------------------------------------------------------
// Page renderers
// ---------------------------------------------------------------------
function homePage() {
  const owners = OWNERS.map(
    (o) => `<div class="card"><div class="accent-bar"></div><p style="font-family:'Source Serif 4',serif;font-weight:600;font-size:20px;color:var(--navy);margin-top:16px;">${escapeHtml(o.name)}</p><p class="muted" style="font-size:14px;margin-top:4px;">${escapeHtml(o.title)}</p></div>`
  ).join("");

  return page(
    "Florida State Roleplay",
    `
  <header class="header">
    <div class="wrap">
      <div class="brand">
        <svg viewBox="0 0 80 80" width="36" height="36" aria-hidden="true">
          <circle cx="40" cy="40" r="38" fill="none" stroke="#E8A33D" stroke-width="2"/>
          <circle cx="40" cy="40" r="31" fill="none" stroke="#5A82AC" stroke-width="1"/>
          <path d="M40 16 L46 32 L63 32 L49 42 L54 58 L40 48 L26 58 L31 42 L17 32 L34 32 Z" fill="#E8A33D"/>
        </svg>
        Florida State Roleplay
      </div>
      <nav style="display:flex;align-items:center;gap:24px;font-size:14px;">
        <a class="navlink" href="${DISCORD_URL}">Discord</a>
        <a class="btn btn-outline-dark" href="/staff/login">Staff login</a>
      </nav>
    </div>
  </header>

  <section class="hero">
    <div class="wrap">
      <h1 style="font-size:48px;">Florida State Roleplay</h1>
      <p>An Emergency Response: Liberty County community built around real departments, real chains of command, and players who take the radio seriously. Fire, EMS, police, and civilian roles are all open — the server runs on people who show up.</p>
      <div style="margin-top:24px;display:flex;gap:16px;flex-wrap:wrap;">
        <a class="btn btn-primary" href="${DISCORD_URL}">Join the Discord</a>
        <a class="btn btn-outline" href="/staff/login">Staff login</a>
      </div>
    </div>
  </section>

  <section class="strip">
    <div class="wrap grid3">
      <div>
        <h2 style="font-size:22px;">What we run</h2>
        <p class="muted" style="margin-top:10px;">ERLC (Emergency Response: Liberty County), full fire, EMS, and police departments with in-character ranks and training.</p>
      </div>
      <div>
        <h2 style="font-size:22px;">How to join</h2>
        <p class="muted" style="margin-top:10px;">Hop in the Discord, read the server rules, and grab a role in #get-roles. Server link and session times are posted there.</p>
      </div>
      <div>
        <h2 style="font-size:22px;">Applying for staff</h2>
        <p class="muted" style="margin-top:10px;">Staff applications open periodically in the Discord. If you're already on staff, use the login above.</p>
      </div>
    </div>
  </section>

  <section class="wrap" style="padding:56px 0;">
    <h2 style="font-size:28px;">Leadership</h2>
    <div class="grid3" style="padding-top:24px;">${owners}</div>
  </section>

  <footer>
    <div class="wrap">
      <p style="font-size:14px;">Florida State Roleplay is an ERLC community, unaffiliated with the State of Florida.</p>
      <a href="${DISCORD_URL}" style="color:var(--sun);font-size:14px;">discord.gg/hDkZt5kS8V</a>
    </div>
  </footer>
`
  );
}

function loginPage(error) {
  return page(
    "Staff login — Florida State Roleplay",
    `
  <div class="login-shell">
    <div class="login-card">
      <a href="/" style="color:rgba(244,246,249,0.5);font-size:14px;">&larr; Florida State Roleplay</a>
      <h1 style="color:var(--paper);font-size:24px;margin-top:16px;">Staff login</h1>
      <p style="color:rgba(244,246,249,0.5);font-size:14px;margin-top:4px;">Use the Roblox username and password you were given.</p>
      <form id="loginForm" class="stack" style="margin-top:24px;">
        <div class="field">
          <label style="color:rgba(244,246,249,0.7);">Roblox username</label>
          <input name="username" required autocomplete="username" />
        </div>
        <div class="field">
          <label style="color:rgba(244,246,249,0.7);">Password</label>
          <input name="password" type="password" required autocomplete="current-password" />
        </div>
        <p class="error" id="loginError">${error ? escapeHtml(error) : ""}</p>
        <button class="btn btn-primary" style="width:100%;" type="submit">Log in</button>
      </form>
    </div>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
      });
      if (res.ok) { window.location.href = '/staff'; return; }
      const data = await res.json().catch(() => ({}));
      document.getElementById('loginError').textContent = data.error || "Couldn't log you in.";
    });
  </script>
`
  );
}

function staffPortalPage() {
  return page(
    "Staff area — Florida State Roleplay",
    `
  <header class="staffheader">
    <div class="wrap">
      <div>
        <p style="font-family:'Source Serif 4',serif;font-weight:600;font-size:18px;">Staff Area</p>
        <p id="whoami" class="muted" style="font-size:12px;color:rgba(244,246,249,0.5);"></p>
      </div>
      <div style="display:flex;align-items:center;gap:20px;font-size:14px;">
        <a id="adminLink" href="/staff/admin" style="color:var(--sun);display:none;">Admin panel</a>
        <button id="logoutBtn" class="btn btn-outline-dark" style="padding:6px 14px;">Log out</button>
      </div>
    </div>
  </header>

  <div class="wrap" style="padding:32px 24px;">
    <div class="tabs">
      <button class="tab active" data-tab="announcements">Announcements</button>
      <button class="tab" data-tab="roster">Staff list</button>
      <button class="tab" data-tab="info">Staff information</button>
      <button class="tab" data-tab="account">My account</button>
    </div>

    <div class="tabpanel active" id="tab-announcements">
      <div id="postAnnouncementForm" class="card stack" style="display:none;margin-bottom:24px;">
        <p style="font-weight:600;color:var(--navy);">Post an announcement</p>
        <input id="annTitle" placeholder="Title" />
        <textarea id="annBody" rows="3" placeholder="What's the announcement?"></textarea>
        <p class="error" id="annError"></p>
        <button class="btn btn-primary" id="annSubmit" style="width:fit-content;">Post</button>
      </div>
      <div id="announcementsList" class="stack"></div>
    </div>

    <div class="tabpanel" id="tab-roster">
      <div id="rosterTableWrap"></div>
    </div>

    <div class="tabpanel" id="tab-info">
      <div id="postInfoForm" class="card stack" style="display:none;margin-bottom:24px;">
        <p style="font-weight:600;color:var(--navy);">Add staff information</p>
        <input id="infoTitle" placeholder="Section title" />
        <textarea id="infoBody" rows="4" placeholder="Policy, SOP, or notes for staff"></textarea>
        <p class="error" id="infoError"></p>
        <button class="btn btn-primary" id="infoSubmit" style="width:fit-content;">Save</button>
      </div>
      <div id="infoList" class="stack"></div>
    </div>

    <div class="tabpanel" id="tab-account">
      <div class="card stack" style="max-width:360px;">
        <p style="font-weight:600;color:var(--navy);">Change your password</p>
        <input id="curPass" type="password" placeholder="Current password" />
        <input id="newPass" type="password" placeholder="New password" />
        <p class="error" id="pwError"></p>
        <p class="success" id="pwSuccess"></p>
        <button class="btn btn-primary" id="pwSubmit" style="width:fit-content;">Update password</button>
      </div>
    </div>
  </div>

  <script>
    let session = null;

    function esc(s){ const d=document.createElement('div'); d.textContent=s==null?'':s; return d.innerHTML; }
    function tierLabel(t){ return { low:'Low Ranking', mid:'Mid Ranking', high:'High Ranking', founder:'Foundership' }[t] || t; }

    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tabpanel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      });
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    });

    async function loadAll() {
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) { window.location.href = '/staff/login'; return; }
      session = (await meRes.json()).session;

      document.getElementById('whoami').textContent =
        session.username + ' · ' + session.rankTitle + ' · ' + tierLabel(session.rankTier) + (session.isSiteManager ? ' · Site Manager' : '');
      if (session.isSiteManager) document.getElementById('adminLink').style.display = 'inline';

      const editAllowed = session.rankTier === 'high' || session.rankTier === 'founder' || session.isSiteManager;
      if (editAllowed) {
        document.getElementById('postAnnouncementForm').style.display = 'block';
        document.getElementById('postInfoForm').style.display = 'block';
      }

      await Promise.all([loadAnnouncements(), loadRoster(), loadInfo()]);
    }

    async function loadAnnouncements() {
      const res = await fetch('/api/announcements');
      const data = await res.json();
      const list = document.getElementById('announcementsList');
      if (!data.announcements.length) { list.innerHTML = '<p class="muted">No announcements yet.</p>'; return; }
      list.innerHTML = data.announcements.map(a => \`
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:baseline;">
            <h3 style="font-size:18px;">\${esc(a.title)}</h3>
            <span class="muted" style="font-size:12px;">\${new Date(a.created_at).toLocaleDateString()}</span>
          </div>
          <p style="margin-top:8px;white-space:pre-wrap;">\${esc(a.body)}</p>
          <p class="muted" style="font-size:12px;margin-top:12px;">Posted by \${esc(a.author)}</p>
        </div>\`).join('');
    }

    document.getElementById('annSubmit').addEventListener('click', async () => {
      const title = document.getElementById('annTitle').value;
      const body = document.getElementById('annBody').value;
      const res = await fetch('/api/announcements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      });
      if (!res.ok) { document.getElementById('annError').textContent = (await res.json()).error || "Couldn't post that."; return; }
      document.getElementById('annTitle').value = '';
      document.getElementById('annBody').value = '';
      document.getElementById('annError').textContent = '';
      loadAnnouncements();
    });

    async function loadRoster() {
      const res = await fetch('/api/admin/accounts');
      const data = await res.json();
      const sorted = [...data.accounts].sort((a,b) => ({founder:0,high:1,mid:2,low:3})[a.rank_tier] - ({founder:0,high:1,mid:2,low:3})[b.rank_tier]);
      const rows = sorted.map(a => \`
        <tr>
          <td style="font-weight:600;color:var(--navy);">\${esc(a.username)}\${a.is_site_manager ? '<span class="tag">Site Manager</span>' : ''}</td>
          <td>\${esc(a.rank_title)}</td>
          <td class="muted">\${tierLabel(a.rank_tier)}</td>
        </tr>\`).join('');
      document.getElementById('rosterTableWrap').innerHTML = \`
        <table><thead><tr><th>Username</th><th>Rank</th><th>Tier</th></tr></thead><tbody>\${rows}</tbody></table>\`;
    }

    async function loadInfo() {
      const res = await fetch('/api/staff-info');
      const data = await res.json();
      const list = document.getElementById('infoList');
      if (!data.entries.length) { list.innerHTML = '<p class="muted">Nothing posted yet.</p>'; return; }
      list.innerHTML = data.entries.map(e => \`
        <div class="card">
          <h3 style="font-size:18px;">\${esc(e.title)}</h3>
          <p style="margin-top:8px;white-space:pre-wrap;">\${esc(e.body)}</p>
          <p class="muted" style="font-size:12px;margin-top:12px;">Last updated by \${esc(e.updated_by)} on \${new Date(e.updated_at).toLocaleDateString()}</p>
        </div>\`).join('');
    }

    document.getElementById('infoSubmit').addEventListener('click', async () => {
      const title = document.getElementById('infoTitle').value;
      const body = document.getElementById('infoBody').value;
      const res = await fetch('/api/staff-info', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      });
      if (!res.ok) { document.getElementById('infoError').textContent = (await res.json()).error || "Couldn't save that."; return; }
      document.getElementById('infoTitle').value = '';
      document.getElementById('infoBody').value = '';
      document.getElementById('infoError').textContent = '';
      loadInfo();
    });

    document.getElementById('pwSubmit').addEventListener('click', async () => {
      const currentPassword = document.getElementById('curPass').value;
      const newPassword = document.getElementById('newPass').value;
      document.getElementById('pwError').textContent = '';
      document.getElementById('pwSuccess').textContent = '';
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) { document.getElementById('pwError').textContent = (await res.json()).error || "Couldn't change your password."; return; }
      document.getElementById('curPass').value = '';
      document.getElementById('newPass').value = '';
      document.getElementById('pwSuccess').textContent = 'Password changed.';
    });

    loadAll();
  </script>
`
  );
}

function adminPage() {
  const tierOptions = RANK_TIERS.map((t) => `<option value="${t.value}">${t.label}</option>`).join("");
  return page(
    "Admin panel — Florida State Roleplay",
    `
  <header class="staffheader">
    <div class="wrap">
      <div>
        <p style="font-family:'Source Serif 4',serif;font-weight:600;font-size:18px;">Admin panel</p>
        <p class="muted" style="font-size:12px;color:rgba(244,246,249,0.5);">Site Manager only</p>
      </div>
      <a href="/staff" style="font-size:14px;color:rgba(244,246,249,0.7);">Back to staff area</a>
    </div>
  </header>

  <div class="wrap" style="padding:32px 24px;">
    <div class="card stack" style="margin-bottom:32px;">
      <p style="font-weight:600;color:var(--navy);">Create a staff account</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div><label>Roblox username</label><input id="newUsername" /></div>
        <div><label>Temporary password</label><input id="newPassword" /></div>
        <div><label>Rank title</label><input id="newRankTitle" placeholder="e.g. Moderator, Director" /></div>
        <div><label>Rank tier</label><select id="newRankTier">${tierOptions}</select></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:14px;">
        <input type="checkbox" id="newIsSiteManager" style="width:auto;" /> Also give this account Site Manager access
      </label>
      <p class="error" id="createError"></p>
      <button class="btn btn-primary" id="createSubmit" style="width:fit-content;">Create account</button>
    </div>

    <div id="accountsTableWrap"></div>
  </div>

  <script>
    const TIERS = ${JSON.stringify(RANK_TIERS)};
    function esc(s){ const d=document.createElement('div'); d.textContent=s==null?'':s; return d.innerHTML; }

    async function loadAccounts() {
      const res = await fetch('/api/admin/accounts');
      if (res.status === 401) { window.location.href = '/staff/login'; return; }
      const data = await res.json();
      const options = TIERS.map(t => \`<option value="\${t.value}">\${t.label}</option>\`).join('');
      const rows = data.accounts.map(a => \`
        <tr data-id="\${a.id}">
          <td style="font-weight:600;color:var(--navy);">\${esc(a.username)}</td>
          <td><input class="rankTitleInput" data-id="\${a.id}" value="\${esc(a.rank_title)}" style="width:140px;" /></td>
          <td>
            <select class="rankTierSelect" data-id="\${a.id}">
              \${TIERS.map(t => \`<option value="\${t.value}" \${t.value===a.rank_tier?'selected':''}>\${t.label}</option>\`).join('')}
            </select>
          </td>
          <td><input type="checkbox" class="siteManagerCheck" data-id="\${a.id}" \${a.is_site_manager?'checked':''} /></td>
          <td><button class="removeBtn" data-id="\${a.id}" style="color:#dc2626;background:none;border:none;cursor:pointer;">Remove</button></td>
        </tr>\`).join('');
      document.getElementById('accountsTableWrap').innerHTML = \`
        <table>
          <thead><tr><th>Username</th><th>Rank title</th><th>Tier</th><th>Site Manager</th><th></th></tr></thead>
          <tbody>\${rows}</tbody>
        </table>\`;

      document.querySelectorAll('.rankTitleInput').forEach(el => {
        el.addEventListener('blur', () => updateAccount(el.dataset.id, { rankTitle: el.value }));
      });
      document.querySelectorAll('.rankTierSelect').forEach(el => {
        el.addEventListener('change', () => updateAccount(el.dataset.id, { rankTier: el.value }));
      });
      document.querySelectorAll('.siteManagerCheck').forEach(el => {
        el.addEventListener('change', () => updateAccount(el.dataset.id, { isSiteManager: el.checked }));
      });
      document.querySelectorAll('.removeBtn').forEach(el => {
        el.addEventListener('click', () => removeAccount(el.dataset.id));
      });
    }

    async function updateAccount(id, patch) {
      await fetch('/api/admin/accounts/' + id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      loadAccounts();
    }
    async function removeAccount(id) {
      if (!confirm("Remove this account? This can't be undone.")) return;
      await fetch('/api/admin/accounts/' + id, { method: 'DELETE' });
      loadAccounts();
    }

    document.getElementById('createSubmit').addEventListener('click', async () => {
      const body = {
        username: document.getElementById('newUsername').value,
        password: document.getElementById('newPassword').value,
        rankTitle: document.getElementById('newRankTitle').value,
        rankTier: document.getElementById('newRankTier').value,
        isSiteManager: document.getElementById('newIsSiteManager').checked,
      };
      const res = await fetch('/api/admin/accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { document.getElementById('createError').textContent = (await res.json()).error || "Couldn't create the account."; return; }
      document.getElementById('newUsername').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('newRankTitle').value = '';
      document.getElementById('newIsSiteManager').checked = false;
      document.getElementById('createError').textContent = '';
      loadAccounts();
    });

    loadAccounts();
  </script>
`
  );
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------------------------------------------------------------------
// Main handler — every request comes through here (see vercel.json)
// ---------------------------------------------------------------------
module.exports = async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;
  const method = req.method;

  try {
    // ---- public pages ----
    if (path === "/" && method === "GET") return sendHtml(res, 200, homePage());

    if (path === "/staff/login" && method === "GET") return sendHtml(res, 200, loginPage());

    // ---- staff pages (session required) ----
    if (path === "/staff" && method === "GET") {
      const session = getSession(req);
      if (!session) return redirect(res, "/staff/login");
      return sendHtml(res, 200, staffPortalPage());
    }
    if (path === "/staff/admin" && method === "GET") {
      const session = getSession(req);
      if (!session) return redirect(res, "/staff/login");
      if (!session.isSiteManager) return redirect(res, "/staff");
      return sendHtml(res, 200, adminPage());
    }

    // ---- auth API ----
    if (path === "/api/auth/login" && method === "POST") {
      const { username, password } = await readJsonBody(req);
      if (!username || !password) return sendJson(res, 400, { error: "Enter a username and password." });

      const { rows } = await sql`SELECT * FROM accounts WHERE username = ${username} LIMIT 1;`;
      const account = rows[0];
      if (!account) return sendJson(res, 401, { error: "That username or password isn't right." });

      const valid = await bcrypt.compare(password, account.password_hash);
      if (!valid) return sendJson(res, 401, { error: "That username or password isn't right." });

      const token = createSessionToken({
        id: account.id,
        username: account.username,
        rankTier: account.rank_tier,
        rankTitle: account.rank_title,
        isSiteManager: account.is_site_manager,
      });
      setSessionCookie(res, token, SESSION_MAX_AGE);
      return sendJson(res, 200, { ok: true });
    }

    if (path === "/api/auth/logout" && method === "POST") {
      clearSessionCookie(res);
      return sendJson(res, 200, { ok: true });
    }

    if (path === "/api/auth/me" && method === "GET") {
      const session = getSession(req);
      if (!session) return sendJson(res, 401, { session: null });
      return sendJson(res, 200, { session });
    }

    if (path === "/api/auth/change-password" && method === "POST") {
      const session = getSession(req);
      if (!session) return sendJson(res, 401, { error: "Not logged in." });

      const { currentPassword, newPassword } = await readJsonBody(req);
      if (!currentPassword || !newPassword) return sendJson(res, 400, { error: "Fill in both password fields." });
      if (newPassword.length < 8) return sendJson(res, 400, { error: "New password needs to be at least 8 characters." });

      const { rows } = await sql`SELECT * FROM accounts WHERE id = ${session.id} LIMIT 1;`;
      const account = rows[0];
      if (!account) return sendJson(res, 404, { error: "Account not found." });

      const valid = await bcrypt.compare(currentPassword, account.password_hash);
      if (!valid) return sendJson(res, 401, { error: "Current password is incorrect." });

      const newHash = await bcrypt.hash(newPassword, 12);
      await sql`UPDATE accounts SET password_hash = ${newHash} WHERE id = ${account.id};`;
      return sendJson(res, 200, { ok: true });
    }

    // ---- announcements ----
    if (path === "/api/announcements" && method === "GET") {
      const session = getSession(req);
      if (!session) return sendJson(res, 401, { error: "Not logged in." });
      const { rows } = await sql`SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50;`;
      return sendJson(res, 200, { announcements: rows });
    }
    if (path === "/api/announcements" && method === "POST") {
      const session = getSession(req);
      if (!session) return sendJson(res, 401, { error: "Not logged in." });
      if (!canEdit(session)) return sendJson(res, 403, { error: "Only High Ranking staff and above can post announcements." });

      const { title, body } = await readJsonBody(req);
      if (!title || !body) return sendJson(res, 400, { error: "Add a title and a message." });
      const { rows } = await sql`INSERT INTO announcements (title, body, author) VALUES (${title}, ${body}, ${session.username}) RETURNING *;`;
      return sendJson(res, 200, { announcement: rows[0] });
    }

    // ---- staff info ----
    if (path === "/api/staff-info" && method === "GET") {
      const session = getSession(req);
      if (!session) return sendJson(res, 401, { error: "Not logged in." });
      const { rows } = await sql`SELECT * FROM staff_info ORDER BY updated_at DESC;`;
      return sendJson(res, 200, { entries: rows });
    }
    if (path === "/api/staff-info" && method === "POST") {
      const session = getSession(req);
      if (!session) return sendJson(res, 401, { error: "Not logged in." });
      if (!canEdit(session)) return sendJson(res, 403, { error: "Only High Ranking staff and above can edit staff information." });

      const { title, body } = await readJsonBody(req);
      if (!title || !body) return sendJson(res, 400, { error: "Add a title and content." });
      const { rows } = await sql`INSERT INTO staff_info (title, body, updated_by) VALUES (${title}, ${body}, ${session.username}) RETURNING *;`;
      return sendJson(res, 200, { entry: rows[0] });
    }

    // ---- admin: accounts ----
    if (path === "/api/admin/accounts" && method === "GET") {
      const session = getSession(req);
      if (!session) return sendJson(res, 401, { error: "Not logged in." });
      const { rows } = await sql`SELECT id, username, rank_tier, rank_title, is_site_manager, created_at FROM accounts ORDER BY created_at ASC;`;
      return sendJson(res, 200, { accounts: rows });
    }
    if (path === "/api/admin/accounts" && method === "POST") {
      const session = getSession(req);
      if (!session) return sendJson(res, 401, { error: "Not logged in." });
      if (!session.isSiteManager) return sendJson(res, 403, { error: "Only the Site Manager can create accounts." });

      const { username, password, rankTier, rankTitle, isSiteManager } = await readJsonBody(req);
      if (!username || !password || !rankTier || !rankTitle) return sendJson(res, 400, { error: "Fill in every field." });
      if (!RANK_TIERS.some((t) => t.value === rankTier)) return sendJson(res, 400, { error: "Invalid rank tier." });
      if (password.length < 8) return sendJson(res, 400, { error: "Password needs to be at least 8 characters." });

      const hash = await bcrypt.hash(password, 12);
      try {
        const { rows } = await sql`
          INSERT INTO accounts (username, password_hash, rank_tier, rank_title, is_site_manager)
          VALUES (${username}, ${hash}, ${rankTier}, ${rankTitle}, ${!!isSiteManager})
          RETURNING id, username, rank_tier, rank_title, is_site_manager, created_at;`;
        return sendJson(res, 200, { account: rows[0] });
      } catch (err) {
        if (String(err.message).includes("duplicate key")) return sendJson(res, 409, { error: "That username is already taken." });
        return sendJson(res, 500, { error: "Couldn't create the account." });
      }
    }

    // ---- admin: single account (path like /api/admin/accounts/12) ----
    const accountMatch = path.match(/^\/api\/admin\/accounts\/(\d+)$/);
    if (accountMatch && (method === "PATCH" || method === "DELETE")) {
      const session = getSession(req);
      if (!session) return sendJson(res, 401, { error: "Not logged in." });
      if (!session.isSiteManager) return sendJson(res, 403, { error: "Only the Site Manager can edit accounts." });
      const id = Number(accountMatch[1]);

      if (method === "DELETE") {
        if (id === session.id) return sendJson(res, 400, { error: "You can't remove your own account." });
        await sql`DELETE FROM accounts WHERE id = ${id};`;
        return sendJson(res, 200, { ok: true });
      }

      const { rankTier, rankTitle, isSiteManager } = await readJsonBody(req);
      if (rankTier && !RANK_TIERS.some((t) => t.value === rankTier)) return sendJson(res, 400, { error: "Invalid rank tier." });

      const { rows } = await sql`
        UPDATE accounts SET
          rank_tier = COALESCE(${rankTier}, rank_tier),
          rank_title = COALESCE(${rankTitle}, rank_title),
          is_site_manager = COALESCE(${isSiteManager}, is_site_manager)
        WHERE id = ${id}
        RETURNING id, username, rank_tier, rank_title, is_site_manager, created_at;`;
      if (!rows[0]) return sendJson(res, 404, { error: "Account not found." });
      return sendJson(res, 200, { account: rows[0] });
    }

    // ---- fallback ----
    sendHtml(res, 404, page("Not found", `<div class="wrap" style="padding:80px 0;"><h1>Page not found</h1><p><a href="/">Go home</a></p></div>`));
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: "Something went wrong on the server." });
  }
};
