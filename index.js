const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');
const cookie = require('cookie');
const { parse } = require('url');

// --- CONFIGURATION ---
const OWNERS = ['Jai']; // Primary founders/owners
const DISCORD_URL = 'https://discord.gg/yourserver'; // Replace with your community Discord
const RANK_TIERS = [
  { id: 'trial', name: 'Trial Staff' },
  { id: 'mod', name: 'Moderator' },
  { id: 'admin', name: 'Administrator' },
  { id: 'senior', name: 'Senior Staff' },
  { id: 'high', name: 'High Ranking' },
  { id: 'founder', name: 'Foundership' }
];

// Session helper
function getSessionUser(req) {
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    if (!cookies.session) return null;
    const secret = process.env.SESSION_SECRET || 'dev-secret';
    // Simple signed cookie verification check or JSON parse depending on how your auth was set up
    const sessionData = JSON.parse(Buffer.from(cookies.session, 'base64').toString());
    if (sessionData && sessionData.expires > Date.now()) {
      return sessionData;
    }
  } catch (e) {
    return null;
  }
  return null;
}

// HTML Shell with Florida Palm Trees and Blue Aesthetic
function layout(title, content, user) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Florida State Roleplay</title>
  <style>
    :root {
      --blue-primary: #1e3a8a;
      --blue-secondary: #3b82f6;
      --blue-dark: #0f172a;
      --accent: #60a5fa;
      --glass: rgba(15, 23, 42, 0.85);
      --border: rgba(96, 165, 250, 0.2);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: linear-gradient(rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.95)),
                  url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80') no-repeat center center fixed;
      background-size: cover;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: rgba(15, 23, 42, 0.9);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      backdrop-filter: blur(10px);
    }
    .logo {
      font-weight: 800;
      font-size: 1.25rem;
      color: #fff;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 0.5r em;
    }
    .logo span { color: var(--accent); }
    nav {
      display: flex;
      gap: 1.5rem;
      align-items: center;
    }
    nav a {
      color: #cbd5e1;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s;
    }
    nav a:hover { color: var(--accent); }
    .btn {
      background: var(--blue-secondary);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn:hover { background: #2563eb; }
    .btn-danger { background: #dc2626; }
    .btn-danger:hover { background: #b91c1c; }
    main {
      flex: 1;
      max-width: 1000px;
      width: 100%;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    .card {
      background: var(--glass);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      margin-bottom: 1.5rem;
    }
    h1, h2, h3 { margin-bottom: 1rem; color: #fff; }
    p { margin-bottom: 1rem; color: #94a3b8; line-height: 1.5; }
    form { display: flex; flex-direction: column; gap: 1rem; }
    label { font-size: 0.875rem; font-weight: 600; color: #cbd5e1; }
    input, select, textarea {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.75rem;
      color: white;
      font-size: 1rem;
      width: 100%;
    }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--accent);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
    }
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th { color: var(--accent); font-weight: 600; }
    td { color: #e2e8f0; }
    footer {
      text-align: center;
      padding: 1.5rem;
      color: #64748b;
      font-size: 0.875rem;
      border-top: 1px solid var(--border);
      background: rgba(15, 23, 42, 0.9);
    }
  </style>
</head>
<body>
  <header>
    <a href="/" class="logo">🌴 <span>Florida State</span> Roleplay</a>
    <nav>
      <a href="/">Home</a>
      <a href="/announcements">Announcements</a>
      <a href="/staff">Staff Directory</a>
      <a href="${DISCORD_URL}" target="_blank">Discord</a>
      ${user ? `
        <a href="/account">My Account</a>
        ${user.is_site_manager ? '<a href="/staff/admin" style="color: var(--accent); font-weight: 700;">Site Manager</a>' : ''}
        <a href="/logout" class="btn btn-danger" style="padding: 0.3rem 0.75rem; font-size: 0.875rem;">Logout</a>
      ` : `
        <a href="/staff/login" class="btn">Staff Login</a>
      `}
    </nav>
  </header>
  <main>
    ${content}
  </main>
  <footer>
    &copy; ${new Date().getFullYear()} Florida State Roleplay. All rights reserved.
  </footer>
</body>
</html>`;
}

// --- MAIN REQUEST HANDLER ---
module.exports = async function handler(req, res) {
  const { pathname, query } = parse(req.url, true);
  const user = getSessionUser(req);

  try {
    // --- HOME PAGE ---
    if (pathname === '/' || pathname === '') {
      const html = layout('Home', `
        <div class="card" style="text-align: center; padding: 3rem 2rem;">
          <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">Florida State Roleplay</h1>
          <p style="font-size: 1.1rem; max-width: 600px; margin: 0 auto 2rem auto;">
            Welcome to the official administrative portal for Florida State Roleplay. Access community announcements, staff directories, and internal management tools.
          </p>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <a href="/announcements" class="btn">View Announcements</a>
            <a href="${DISCORD_URL}" class="btn" style="background: #475569;">Join Discord</a>
          </div>
        </div>
      `, user);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    // --- ANNOUNCEMENTS PAGE ---
    if (pathname === '/announcements') {
      let announcements = [];
      try {
        const result = await sql`SELECT * FROM announcements ORDER BY created_at DESC`;
        announcements = result.rows;
      } catch (e) {
        // Tables might not be initialized yet
      }

      let announcementsHtml = announcements.length === 0 
        ? '<p>No announcements posted yet.</p>' 
        : announcements.map(a => `
            <div style="background: rgba(30, 41, 59, 0.4); padding: 1.25rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid var(--accent);">
              <h3 style="margin-bottom: 0.25rem;">${escapeHtml(a.title)}</h3>
              <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.75rem;">Posted by ${escapeHtml(a.author)} on ${new Date(a.created_at).toLocaleDateString()}</p>
              <p style="color: #cbd5e1; white-space: pre-wrap; margin-bottom: 0;">${escapeHtml(a.body)}</p>
            </div>
          `).join('');

      const canPost = user && (user.is_site_manager || ['high', 'founder', 'senior'].includes(user.rank_tier));

      const html = layout('Announcements', `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h2>Community Announcements</h2>
            ${canPost ? '<a href="/announcements/new" class="btn">New Announcement</a>' : ''}
          </div>
          ${announcementsHtml}
        </div>
      `, user);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    // --- STAFF DIRECTORY ---
    if (pathname === '/staff') {
      let accounts = [];
      try {
        const result = await sql`SELECT username, rank_tier, rank_title, created_at FROM accounts ORDER BY id ASC`;
        accounts = result.rows;
      } catch (e) {}

      let rows = accounts.length === 0 
        ? '<tr><td colspan="3" style="text-align: center;">No staff members registered.</td></tr>'
        : accounts.map(acc => {
            const tierObj = RANK_TIERS.find(t => t.id === acc.rank_tier) || { name: acc.rank_tier };
            return `
              <tr>
                <td><strong>${escapeHtml(acc.username)}</strong></td>
                <td>${escapeHtml(tierObj.name)}</td>
                <td>${escapeHtml(acc.rank_title || 'Staff Member')}</td>
              </tr>
            `;
          }).join('');

      const html = layout('Staff Directory', `
        <div class="card">
          <h2>Staff Directory</h2>
          <p>Active administrative and moderation personnel for Florida State Roleplay.</p>
          <table>
            <thead>
              <tr>
                <th>Roblox Username</th>
                <th>Rank Tier</th>
                <th>Title</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `, user);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    // --- LOGIN PAGE ---
    if (pathname === '/staff/login') {
      if (req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const params = new URLSearchParams(body);
        const username = params.get('username');
        const password = params.get('password');

        try {
          const result = await sql`SELECT * FROM accounts WHERE username = ${username}`;
          const account = result.rows[0];

          if (account && (await bcrypt.compare(password, account.password_hash))) {
            const sessionData = {
              id: account.id,
              username: account.username,
              rank_tier: account.rank_tier,
              is_site_manager: account.is_site_manager,
              expires: Date.now() + 86400000 * 7 // 7 days
            };
            const encodedSession = Buffer.from(JSON.stringify(sessionData)).toString('base64');
            res.setHeader('Set-Cookie', cookie.serialize('session', encodedSession, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              maxAge: 86400 * 7
            }));
            res.writeHead(302, { Location: '/staff' });
            return res.end();
          }
        } catch (e) {}

        const html = layout('Staff Login', `
          <div class="card" style="max-width: 400px; margin: 4rem auto;">
            <h2>Staff Login</h2>
            <p style="color: #ef4444; margin-bottom: 1rem;">Invalid username or password.</p>
            <form method="POST">
              <label>Roblox Username</label>
              <input type="text" name="username" required>
              <label>Password</label>
              <input type="password" name="password" required>
              <button type="submit" class="btn" style="margin-top: 1rem;">Log In</button>
            </form>
          </div>
        `, user);
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
      }

      const html = layout('Staff Login', `
        <div class="card" style="max-width: 400px; margin: 4rem auto;">
          <h2>Staff Login</h2>
          <p>Use the Roblox username and password you were given.</p>
          <form method="POST">
            <label>Roblox Username</label>
            <input type="text" name="username" required>
            <label>Password</label>
            <input type="password" name="password" required>
            <button type="submit" class="btn" style="margin-top: 1rem;">Log In</button>
          </form>
        </div>
      `, user);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    // --- LOGOUT ---
    if (pathname === '/logout') {
      res.setHeader('Set-Cookie', cookie.serialize('session', '', {
        httpOnly: true,
        expires: new Date(0),
        path: '/'
      }));
      res.writeHead(302, { Location: '/' });
      return res.end();
    }

    // --- SITE MANAGER AREA ---
    if (pathname === '/staff/admin') {
      if (!user || !user.is_site_manager) {
        res.writeHead(302, { Location: '/staff/login' });
        return res.end();
      }

      let message = '';
      if (req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const params = new URLSearchParams(body);
        const action = params.get('action');

        if (action === 'create_account') {
          const username = params.get('username');
          const password = params.get('password');
          const rank_tier = params.get('rank_tier');
          const rank_title = params.get('rank_title');
          const is_site_manager = params.get('is_site_manager') === 'on';

          try {
            const hash = await bcrypt.hash(password, 10);
            await sql`
              INSERT INTO accounts (username, password_hash, rank_tier, rank_title, is_site_manager)
              VALUES (${username}, ${hash}, ${rank_tier}, ${rank_title}, ${is_site_manager})
            `;
            message = 'Account created successfully!';
          } catch (e) {
            message = 'Error creating account (username might already exist).';
          }
        }
      }

      let accountsRes = await sql`SELECT id, username, rank_tier, rank_title, is_site_manager FROM accounts ORDER BY id ASC`;
      let accountsList = accountsRes.rows.map(acc => `
        <tr>
          <td>${escapeHtml(acc.username)}</td>
          <td>${escapeHtml(acc.rank_tier)}</td>
          <td>${acc.is_site_manager ? 'Yes' : 'No'}</td>
        </tr>
      `).join('');

      const html = layout('Site Manager', `
        <div class="card">
          <h2>Site Manager Control Center</h2>
          ${message ? `<p style="color: var(--accent); font-weight: bold;">${message}</p>` : ''}
          
          <h3 style="margin-top: 2rem;">Create Staff Account</h3>
          <form method="POST">
            <input type="hidden" name="action" value="create_account">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label>Roblox Username</label>
                <input type="text" name="username" required>
              </div>
              <div>
                <label>Temporary Password</label>
                <input type="password" name="password" required>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
              <div>
                <label>Rank Tier</label>
                <select name="rank_tier">
                  ${RANK_TIERS.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                </select>
              </div>
              <div>
                <label>Rank Title</label>
                <input type="text" name="rank_title" value="Staff Member" required>
              </div>
            </div>
            <div style="margin-top: 1rem; display: flex; align-items: center; gap: 0.5rem;">
              <input type="checkbox" name="is_site_manager" style="width: auto;">
              <label style="margin: 0;">Grant Site Manager Permissions</label>
            </div>
            <button type="submit" class="btn" style="margin-top: 1rem; width: auto;">Create Account</button>
          </form>

          <h3 style="margin-top: 3rem;">Existing Accounts</h3>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Rank Tier</th>
                <th>Site Manager</th>
              </tr>
            </thead>
            <tbody>
              ${accountsList}
            </tbody>
          </table>
        </div>
      `, user);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    // 404 Not Found
    const html = layout('Not Found', `
      <div class="card" style="text-align: center; padding: 3rem;">
        <h2>Page Not Found</h2>
        <p>The page you are looking for does not exist.</p>
        <a href="/" class="btn" style="display: inline-block; margin-top: 1rem;">Return Home</a>
      </div>
    `, user);
    res.setHeader('Content-Type', 'text/html');
    return res.status(404).send(html);

  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
