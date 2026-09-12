const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');
const cookie = require('cookie');
const { parse } = require('url');

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
    }
    .logo span { color: var(--accent); text-shadow: 0 0 15px var(--accent-glow); }
    nav { display: flex; gap: 1.5rem; align-items: center; }
    nav a { color: var(--text-muted); text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: color 0.2s ease; }
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
    main { flex: 1; max-width: 900px; width: 100%; margin: 2.5rem auto; padding: 0 1rem; }
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
    }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }
    footer { text-align: center; padding: 1.5rem; color: #64748b; font-size: 0.85rem; border-top: 1px solid var(--border); background: rgba(9, 13, 22, 0.85); }
  </style>
</head>
<body>
  <header>
    <a href="/" class="logo">🌴 <span>Florida State</span> Roleplay</a>
    <nav>
      <a href="/">Home</a>
      <a href="${DISCORD_URL}" target="_blank">Discord</a>
      ${user ? `
        <a href="/staff/admin" style="color: var(--accent); font-weight: 700;">Admin Panel</a>
        <a href="/logout" class="btn btn-danger" style="padding: 0.3rem 0.75rem; font-size: 0.85rem;">Logout</a>
      ` : `
        <a href="/staff/login" class="btn">Staff Login</a>
      `}
    </nav>
  </header>
  <main>${content}</main>
  <footer>&copy; ${new Date().getFullYear()} Florida State Roleplay. All rights reserved.</footer>
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
          <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">Florida State Roleplay</h1>
          <p style="max-width: 550px; margin: 0 auto 2rem auto;">Welcome to our official hub.</p>
          <a href="${DISCORD_URL}" target="_blank" class="btn">Join Discord</a>
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
              is_site_manager: account.is_site_manager,
              expires: Date.now() + 86400000 * 7
            };
            const encodedSession = Buffer.from(JSON.stringify(sessionData)).toString('base64');
            res.setHeader('Set-Cookie', cookie.serialize('session', encodedSession, {
              httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 86400 * 7
            }));
            res.writeHead(302, { Location: '/staff/admin' });
            return res.end();
          }
        } catch (e) {}
      }

      const html = layout('Staff Login', `
        <div class="card" style="max-width: 380px; margin: 3rem auto;">
          <h2>Staff Login</h2>
          <form method="POST">
            <label>Username</label>
            <input type="text" name="username" required>
            <label style="margin-top: 0.5rem;">Password</label>
            <input type="password" name="password" required>
            <button type="submit" class="btn" style="margin-top: 1rem;">Access Portal</button>
          </form>
        </div>
      `, user);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    if (pathname === '/logout') {
      res.setHeader('Set-Cookie', cookie.serialize('session', '', { httpOnly: true, expires: new Date(0), path: '/' }));
      res.writeHead(302, { Location: '/' });
      return res.end();
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

        if (action === 'deploy_custom_ticket_panel') {
          const channelId = params.get('channel_id');
          const title = params.get('title');
          const description = params.get('description');
          const footer = params.get('footer');
          const buttonLabel = params.get('button_label');
          const buttonEmoji = params.get('button_emoji');

          const payload = JSON.stringify({ channelId, title, description, footer, buttonLabel, buttonEmoji });
          await sql`INSERT INTO bot_commands_queue (action_type, payload) VALUES ('deploy_custom_ticket_panel', ${payload})`;
          message = 'Custom ticket panel deployment queued successfully!';
        }
      }

      // Fetch Channels from Discord API
      let discordChannels = [];
      try {
        const guildId = process.env.GUILD_ID;
        const botToken = process.env.DISCORD_TOKEN;
        if (guildId && botToken) {
          const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
            headers: { Authorization: `Bot ${botToken}` }
          });
          if (response.ok) {
            const channels = await response.json();
            discordChannels = channels.filter(c => c.type === 0 || c.type === 5);
          }
        }
      } catch (err) {}

      // Fallback channel option if API call fails or specific ID needs to be insured
      let channelOptions = discordChannels.map(c => `
        <option value="${c.id}" ${c.id === '1548319013011071107' ? 'selected' : ''}>#${c.name} (${c.id})</option>
      `).join('');

      if (!discordChannels.some(c => c.id === '1548319013011071107')) {
        channelOptions = `<option value="1548319013011071107" selected>Default Ticket Channel (1548319013011071107)</option>` + channelOptions;
      }

      const html = layout('Admin Ticket Customization', `
        <div class="card">
          <h2>Ticket Panel Customization & Deployment</h2>
          <p>Configure every detail of your ticket embed and dispatch it directly to your server channels.</p>
          ${message ? `<p style="color: var(--accent); font-weight: bold; margin-bottom: 1rem;">${message}</p>` : ''}
          
          <form method="POST">
            <input type="hidden" name="action" value="deploy_custom_ticket_panel">
            
            <div>
              <label>Target Channel</label>
              <select name="channel_id" required>
                ${channelOptions}
              </select>
            </div>

            <div>
              <label>Embed Title</label>
              <input type="text" name="title" value="🎫 Florida State Roleplay — Support Center" required>
            </div>

            <div>
              <label>Embed Description</label>
              <textarea name="description" rows="4" required>Need assistance, want to report a user, or have a question? Click the button below to open a private ticket with our staff team.</textarea>
            </div>

            <div>
              <label>Embed Footer Text</label>
              <input type="text" name="footer" value="Florida State Roleplay Security">
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
              <div>
                <label>Button Label</label>
                <input type="text" name="button_label" value="Create Support Ticket" required>
              </div>
              <div>
                <label>Button Emoji</label>
                <input type="text" name="button_emoji" value="🎫" required>
              </div>
            </div>

            <button type="submit" class="btn" style="margin-top: 1rem; width: auto;">Deploy Customized Ticket Panel</button>
          </form>
        </div>
      `, user);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    res.statusCode = 404;
    res.end('Not Found');
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}
