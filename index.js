const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');
const cookie = require('cookie');
const { parse } = require('url');

// --- CONFIGURATION ---
const OWNERS = ['Jai']; 
const DISCORD_URL = 'https://discord.gg/6MhH9Gh7DJ';
const RANK_TIERS = [
  { id: 'trial', name: 'Trial Staff' },
  { id: 'mod', name: 'Moderator' },
  { id: 'admin', name: 'Administrator' },
  { id: 'senior', name: 'Senior Staff' },
  { id: 'high', name: 'High Ranking' },
  { id: 'founder', name: 'Foundership' }
];

function getSessionUser(req) {
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    if (!cookies.session) return null;
    const sessionData = JSON.parse(Buffer.from(cookies.session, 'base64').toString());
    if (sessionData && sessionData.expires > Date.now()) {
      return sessionData;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function layout(title, content, user) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Florida State Roleplay</title>
  <style>
    :root {
      --bg-base: #090d16;
      --bg-surface: #111827;
      --bg-card: rgba(17, 24, 39, 0.82);
      --accent: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.15);
      --border: rgba(255, 255, 255, 0.08);
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: linear-gradient(135deg, rgba(5, 8, 17, 0.88) 0%, rgba(15, 23, 42, 0.92) 100%),
                  url('https://raw.githubusercontent.com/mrlowkey0811-afk/Florida-State-Roleplay/main/cruiser.png') no-repeat center center fixed;
      background-blend-mode: overlay;
      background-size: cover;
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: rgba(9, 13, 22, 0.85);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .logo {
      font-weight: 800;
      font-size: 1.2rem;
      color: #fff;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      letter-spacing: -0.3px;
    }
    .logo span { color: var(--accent); text-shadow: 0 0 15px var(--accent-glow); }
    nav {
      display: flex;
      gap: 1.5rem;
      align-items: center;
    }
    nav a {
      color: var(--text-muted);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.9rem;
      transition: color 0.2s ease;
    }
    nav a:hover { color: var(--accent); }
    .btn {
      background: #0284c7;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
    }
    .btn:hover { background-color: #0369a1; transform: translateY(-1px); }
    .btn-danger { background-color: #dc2626; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25); }
    .btn-danger:hover { background-color: #b91c1c; }
    .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.8rem; border-radius: 6px; }
    
    main {
      flex: 1;
      max-width: 900px;
      width: 100%;
      margin: 2.5rem auto;
      padding: 0 1rem;
    }
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2.25rem;
      backdrop-filter: blur(16px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      margin-bottom: 1.5rem;
    }
    h1, h2, h3 { margin-bottom: 0.75rem; color: #fff; letter-spacing: -0.5px; }
    p { margin-bottom: 1rem; color: var(--text-muted); line-height: 1.6; font-size: 0.95rem; }
    form { display: flex; flex-direction: column; gap: 1rem; }
    label { font-size: 0.85rem; font-weight: 600; color: #cbd5e1; }
    input, select, textarea {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem;
      color: white;
      font-size: 0.95rem;
      width: 100%;
      transition: all 0.2s ease;
    }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
    }
    th, td {
      padding: 0.85rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th { color: var(--accent); font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.8px; }
    td { color: #e2e8f0; font-size: 0.9rem; }
    
    .broadcast-feed {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 1.25rem;
    }
    .broadcast-item {
      background: linear-gradient(145deg, rgba(17, 24, 39, 0.9) 0%, rgba(11, 17, 32, 0.95) 100%);
      border: 1px solid var(--border);
      border-left: 3px solid var(--accent);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    }
    .broadcast-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .broadcast-tag {
      background: var(--accent-glow);
      color: var(--accent);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
    }
    .broadcast-date { font-size: 0.8rem; color: #64748b; }
    .broadcast-heading { font-size: 1.15rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; }
    .broadcast-content { color: #cbd5e1; font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap; }
    .broadcast-footer-info {
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(255, 255, 255, 0.04);
      font-size: 0.8rem;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    footer {
      text-align: center;
      padding: 1.5rem;
      color: #64748b;
      font-size: 0.85rem;
      border-top: 1px solid var(--border);
      background: rgba(9, 13, 22, 0.85);
    }
  </style>
</head>
<body>
  <header>
    <a href="/" class="logo">🌴 <span>Florida State</span> Roleplay</a>
    <nav>
      <a href="/">Home</a>
      <a href="/announcements">Announcements</a>
      ${user ? `<a href="/staff-announcements" style="color: var(--accent);">Staff Memos</a>` : ''}
      <a href="/staff">Directory</a>
      <a href="${DISCORD_URL}" target="_blank">Discord</a>
      ${user ? `
        <a href="/staff">Dashboard</a>
        <a href="/staff/account">Account</a>
        ${user.is_site_manager ? '<a href="/staff/admin" style="color: var(--accent); font-weight: 700;">Admin & Bot Control</a>' : ''}
        <a href="/logout" class="btn btn-danger" style="padding: 0.3rem 0.75rem; font-size: 0.85rem;">Logout</a>
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

module.exports = async function handler(req, res) {
  const parsedUrl = parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const user = getSessionUser(req);

  try {
    if (pathname === '/' || pathname === '') {
      const html = layout('Home', `
        <div class="card" style="text-align: center; padding: 4rem 2rem;">
          <h1 style="font-size: 2.5rem; margin-bottom: 1rem; font-weight: 800;">Florida State Roleplay</h1>
          <p style="font-size: 1.05rem; max-width: 550px; margin: 0 auto 2rem auto;">
            The premier immersive roleplay experience. Check out community updates or connect with us on Discord below.
          </p>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <a href="/announcements" class="btn">View Announcements</a>
            <a href="${DISCORD_URL}" target="_blank" class="btn" style="background: #1e293b; border: 1px solid var(--border);">Join Discord</a>
          </div>
        </div>
      `, user);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    if (pathname === '/announcements') {
      let announcements = [];
      try {
        const result = await sql`SELECT * FROM announcements ORDER BY created_at DESC`;
        announcements = result.rows || [];
      } catch (e) {
        announcements = [];
      }

      let announcementsHtml = announcements.length === 0 
        ? '<div class="card" style="text-align: center;"><p style="margin-bottom: 0;">No broadcasts posted yet. Check back later.</p></div>' 
        : `<div class="broadcast-feed">` + announcements.map(a => {
            const dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
            return `
              <div class="broadcast-item">
                <div class="broadcast-top">
                  <span class="broadcast-tag">Broadcast</span>
                  <span class="broadcast-date">${dateStr}</span>
                </div>
                <div class="broadcast-heading">${escapeHtml(a.title)}</div>
                <div class="broadcast-content">${escapeHtml(a.body)}</div>
                <div class="broadcast-footer-info">
                  <span>Posted by <strong>${escapeHtml(a.author || 'Administration')}</strong></span>
                </div>
              </div>
            `;
          }).join('') + `</div>`;

      const html = layout('Announcements', `
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 0.5rem;">
          <div>
            <h2>Community Broadcasts</h2>
            <p style="margin-bottom: 0;">Official network updates, patch notes, and community events.</p>
          </div>
        </div>
        ${announcementsHtml}
      `, user);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    if (pathname === '/staff-announcements') {
      if (!user) {
        res.writeHead(302, { Location: '/staff/login' });
        return res.end();
      }

      let announcements = [];
      try {
        const result = await sql`SELECT * FROM staff_announcements ORDER BY created_at DESC`;
        announcements = result.rows || [];
      } catch (e) {
        announcements = [];
      }

      let announcementsHtml = announcements.length === 0 
        ? '<div class="card" style="text-align: center;"><p style="margin-bottom: 0;">No internal staff memos found.</p></div>' 
        : `<div class="broadcast-feed">` + announcements.map(a => {
            const dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
            return `
              <div class="broadcast-item" style="border-left-color: #3b82f6;">
                <div class="broadcast-top">
                  <span class="broadcast-tag" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa;">Internal Memo</span>
                  <span class="broadcast-date">${dateStr}</span>
                </div>
                <div class="broadcast-heading">${escapeHtml(a.title)}</div>
                <div class="broadcast-content">${escapeHtml(a.content)}</div>
                <div class="broadcast-footer-info">
                  <span>Issued by <strong>${escapeHtml(a.author || 'Management')}</strong></span>
                </div>
              </div>
            `;
          }).join('') + `</div>`;

      const html = layout('Staff Memos', `
        <div style="margin-bottom: 0.5rem;">
          <h2>Staff Operations Board</h2>
          <p style="margin-bottom: 0;">Confidential notices and updates restricted to active team members.</p>
        </div>
        ${announcementsHtml}
      `, user);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    if (pathname === '/staff') {
      let accounts = [];
      try {
        const result = await sql`SELECT username, rank_tier, rank_title FROM accounts ORDER BY id ASC`;
        accounts = result.rows || [];
      } catch (e) {
        accounts = [];
      }

      let rows = accounts.length === 0 
        ? '<tr><td colspan="3" style="text-align: center;">No active staff records.</td></tr>'
        : accounts.map(acc => {
            const tierObj = RANK_TIERS.find(t => t.id === acc.rank_tier) || { name: acc.rank_tier || 'Staff' };
            return `
              <tr>
                <td><strong>${escapeHtml(acc.username)}</strong></td>
                <td><span style="background: var(--accent-glow); color: var(--accent); padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">${escapeHtml(tierObj.name)}</span></td>
                <td>${escapeHtml(acc.rank_title || 'Staff Member')}</td>
              </tr>
            `;
          }).join('');

      const html = layout('Staff Directory', `
        <div class="card">
          <h2>Staff Directory</h2>
          <p>Active administrative and moderation personnel currently serving the community.</p>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Tier</th>
                <th>Role Title</th>
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
              expires: Date.now() + 86400000 * 7
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
          <div class="card" style="max-width: 380px; margin: 3rem auto;">
            <h2>Staff Login</h2>
            <p style="color: #ef4444; margin-bottom: 1rem; font-size: 0.85rem;">Invalid credentials provided.</p>
            <form method="POST">
              <label>Username</label>
              <input type="text" name="username" required>
              <label>Password</label>
              <input type="password" name="password" required>
              <button type="submit" class="btn" style="margin-top: 0.5rem;">Access Portal</button>
            </form>
          </div>
        `, user);
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
      }

      const html = layout('Staff Login', `
        <div class="card" style="max-width: 380px; margin: 3rem auto;">
          <h2>Staff Login</h2>
          <p>Enter your designated credentials to proceed.</p>
          <form method="POST">
            <label>Username</label>
            <input type="text" name="username" required>
            <label>Password</label>
            <input type="password" name="password" required>
            <button type="submit" class="btn" style="margin-top: 0.5rem;">Access Portal</button>
          </form>
        </div>
      `, user);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    if (pathname === '/logout') {
      res.setHeader('Set-Cookie', cookie.serialize('session', '', {
        httpOnly: true,
        expires: new Date(0),
        path: '/'
      }));
      res.writeHead(302, { Location: '/' });
      return res.end();
    }

    if (pathname === '/staff/account') {
      if (!user) {
        res.writeHead(302, { Location: '/staff/login' });
        return res.end();
      }

      let message = '';
      if (req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const params = new URLSearchParams(body);
        const currentPassword = params.get('current_password');
        const newPassword = params.get('new_password');

        try {
          const result = await sql`SELECT * FROM accounts WHERE id = ${user.id}`;
          const account = result.rows[0];

          if (account && (await bcrypt.compare(currentPassword, account.password_hash))) {
            const newHash = await bcrypt.hash(newPassword, 10);
            await sql`UPDATE accounts SET password_hash = ${newHash} WHERE id = ${user.id}`;
            message = 'Password updated successfully.';
          } else {
            message = 'Incorrect current password.';
          }
        } catch (e) {
          message = 'Error processing request.';
        }
      }

      const html = layout('Account Settings', `
        <div class="card" style="max-width: 450px; margin: 2rem auto;">
          <h2>Account Security</h2>
          <p>Modify your portal access password.</p>
          ${message ? `<p style="color: var(--accent); font-weight: bold; font-size: 0.85rem; margin-bottom: 1rem;">${message}</p>` : ''}
          <form method="POST">
            <label>Current Password</label>
            <input type="password" name="current_password" required>
            <label>New Password</label>
            <input type="password" name="new_password" required>
            <button type="submit" class="btn" style="margin-top: 0.5rem;">Update Password</button>
          </form>
        </div>
      `, user);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

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

        try {
          await sql`
            CREATE TABLE IF NOT EXISTS bot_commands_queue (
              id SERIAL PRIMARY KEY,
              action_type VARCHAR(100) NOT NULL,
              payload TEXT NOT NULL,
              status VARCHAR(50) DEFAULT 'pending',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `;
        } catch(e) {}

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
            message = 'Staff account provisioned successfully.';
          } catch (e) {
            message = 'Error: Username might already be in use.';
          }
        } else if (action === 'create_announcement') {
          const title = params.get('title');
          const bodyContent = params.get('body');
          const target = params.get('target');

          try {
            if (target === 'staff') {
              await sql`
                CREATE TABLE IF NOT EXISTS staff_announcements (
                  id SERIAL PRIMARY KEY,
                  title VARCHAR(255) NOT NULL,
                  content TEXT NOT NULL,
                  author VARCHAR(255),
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
              `;
              await sql`
                INSERT INTO staff_announcements (title, content, author)
                VALUES (${title}, ${bodyContent}, ${user.username})
              `;
              message = 'Staff memo published successfully.';
            } else {
              await sql`
                INSERT INTO announcements (title, body, author)
                VALUES (${title}, ${bodyContent}, ${user.username})
              `;
              message = 'Community broadcast published successfully.';
            }
          } catch (e) {
            message = 'Error posting broadcast.';
          }
        } else if (action === 'delete_announcement') {
          const id = params.get('id');
          const type = params.get('type');
          try {
            if (type === 'staff') {
              await sql`DELETE FROM staff_announcements WHERE id = ${id}`;
            } else {
              await sql`DELETE FROM announcements WHERE id = ${id}`;
            }
            message = 'Announcement deleted successfully.';
          } catch (e) {
            message = 'Error deleting announcement.';
          }
        } else if (action === 'deploy_ticket_panel') {
          const channelId = params.get('channel_id');
          await sql`INSERT INTO bot_commands_queue (action_type, payload) VALUES ('deploy_ticket_panel', ${channelId})`;
          message = 'Ticket panel deploy command sent to bot queue!';
        } else if (action === 'send_embed') {
          const channelId = params.get('channel_id');
          const embedTitle = params.get('embed_title');
          const embedDescription = params.get('embed_description');
          const payload = JSON.stringify({ channelId, embedTitle, embedDescription });
          await sql`INSERT INTO bot_commands_queue (action_type, payload) VALUES ('send_embed', ${payload})`;
          message = 'Custom embed dispatch command sent to bot queue!';
        } else if (action === 'assign_role') {
          const discordUserId = params.get('discord_user_id');
          const roleId = params.get('role_id');
          const payload = JSON.stringify({ discordUserId, roleId });
          await sql`INSERT INTO bot_commands_queue (action_type, payload) VALUES ('assign_role', ${payload})`;
          message = 'Role assignment command sent to bot queue!';
        }
      }

      let accountsRes = { rows: [] };
      let publicAnnouncements = [];

      try {
        accountsRes = await sql`SELECT id, username, rank_tier, rank_title, is_site_manager FROM accounts ORDER BY id ASC`;
      } catch (e) {}

      try {
        const pubRes = await sql`SELECT id, title, author, created_at FROM announcements ORDER BY created_at DESC`;
        publicAnnouncements = pubRes.rows || [];
      } catch (e) {}

      let accountsList = (accountsRes.rows || []).map(acc => `
        <tr>
          <td>${escapeHtml(acc.username)}</td>
          <td>${escapeHtml(acc.rank_tier)}</td>
          <td>${acc.is_site_manager ? 'Yes' : 'No'}</td>
        </tr>
      `).join('');

      let manageAnnouncementsList = '';
      if (publicAnnouncements.length > 0) {
        manageAnnouncementsList += `<h4 style="color: var(--accent); margin-top: 1rem; font-size: 0.9rem;">Public Broadcasts</h4><table><thead><tr><th>Title</th><th>Author</th><th style="text-align: right;">Action</th></tr></thead><tbody>`;
        manageAnnouncementsList += publicAnnouncements.map(a => `
          <tr>
            <td>${escapeHtml(a.title)}</td>
            <td>${escapeHtml(a.author || 'N/A')}</td>
            <td style="text-align: right;">
              <form method="POST" style="display:inline;">
                <input type="hidden" name="action" value="delete_announcement">
                <input type="hidden" name="id" value="${a.id}">
                <input type="hidden" name="type" value="public">
                <button type="submit" class="btn btn-danger btn-sm" onclick="return confirm('Delete this broadcast?')">Delete</button>
              </form>
            </td>
          </tr>
        `).join('');
        manageAnnouncementsList += `</tbody></table>`;
      }

      const html = layout('Admin & Bot Control', `
        <div class="card">
          <h2>Admin Control Center & Bot Management</h2>
          ${message ? `<p style="color: var(--accent); font-weight: bold; font-size: 0.85rem; margin-bottom: 1rem;">${message}</p>` : ''}
          
          <h3 style="margin-top: 1.5rem; font-size: 1rem;">🎫 Deploy Ticket Panel to Channel</h3>
          <form method="POST">
            <input type="hidden" name="action" value="deploy_ticket_panel">
            <div>
              <label>Discord Channel ID</label>
              <input type="text" name="channel_id" placeholder="e.g. 123456789012345678" required>
            </div>
            <button type="submit" class="btn" style="margin-top: 0.5rem; width: auto;">Post Ticket Panel</button>
          </form>

          <h3 style="margin-top: 2rem; font-size: 1rem;">🎨 Send Custom Embed to Channel</h3>
          <form method="POST">
            <input type="hidden" name="action" value="send_embed">
            <div style="display: grid; grid-template-columns: 1fr; gap: 0.5rem;">
              <div>
                <label>Channel ID</label>
                <input type="text" name="channel_id" placeholder="Channel ID" required>
              </div>
              <div>
                <label>Embed Title</label>
                <input type="text" name="embed_title" placeholder="Important Notice" required>
              </div>
              <div>
                <label>Embed Description / Content</label>
                <textarea name="embed_description" rows="3" placeholder="Message content goes here..." required></textarea>
              </div>
            </div>
            <button type="submit" class="btn" style="margin-top: 0.5rem; width: auto;">Dispatch Embed</button>
          </form>

          <h3 style="margin-top: 2rem; font-size: 1rem;">🛡️ Manage User Roles (Site-to-Discord)</h3>
          <form method="POST">
            <input type="hidden" name="action" value="assign_role">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label>Discord User ID</label>
                <input type="text" name="discord_user_id" placeholder="User ID" required>
              </div>
              <div>
                <label>Discord Role ID</label>
                <input type="text" name="role_id" placeholder="Role ID to assign" required>
              </div>
            </div>
            <button type="submit" class="btn" style="margin-top: 0.5rem; width: auto;">Assign Role</button>
          </form>

          <h3 style="margin-top: 2rem; font-size: 1rem;">Publish Announcement</h3>
          <form method="POST">
            <input type="hidden" name="action" value="create_announcement">
            <div>
              <label>Title / Headline</label>
              <input type="text" name="title" required>
            </div>
            <div style="margin-top: 0.5rem;">
              <label>Body Content</label>
              <textarea name="body" rows="3" required></textarea>
            </div>
            <div style="margin-top: 0.5rem;">
              <label>Target Channel</label>
              <select name="target">
                <option value="public">Community Broadcast</option>
                <option value="staff">Staff Memo Only</option>
              </select>
            </div>
            <button type="submit" class="btn" style="margin-top: 0.5rem; width: auto;">Publish Broadcast</button>
          </form>

          <h3 style="margin-top: 2rem; font-size: 1rem;">Active Announcements Management</h3>
          ${manageAnnouncementsList}

          <h3 style="margin-top: 2rem; font-size: 1rem;">Provision Staff Account</h3>
          <form method="POST">
            <input type="hidden" name="action" value="create_account">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label>Username</label>
                <input type="text" name="username" required>
              </div>
              <div>
                <label>Temporary Password</label>
                <input type="password" name="password" required>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem;">
              <div>
                <label>Rank Tier</label>
                <select name="rank_tier">
                  ${RANK_TIERS.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                </select>
              </div>
              <div>
                <label>Role Title</label>
                <input type="text" name="rank_title" value="Staff Member" required>
              </div>
            </div>
            <div style="margin-top: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
              <input type="checkbox" name="is_site_manager" style="width: auto;">
              <label style="margin: 0;">Grant Admin Control Access</label>
            </div>
            <button type="submit" class="btn" style="margin-top: 0.5rem; width: auto;">Create Account</button>
          </form>

          <h3 style="margin-top: 2rem; font-size: 1rem;">Registered Staff Roster</h3>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Tier</th>
                <th>Admin Access</th>
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

    const html = layout('Not Found', `
      <div class="card" style="text-align: center; padding: 3rem;">
        <h2>Page Not Found</h2>
        <p>The requested route does not exist.</p>
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
