const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const config = require('../config');
const PlayerLinkService = require('../services/playerLinkService');
const { resolveMinecraftProfile } = require('../services/mojangService');

const SESSIONS_FILE = path.join(config.paths.dataDir, 'sessions.json');

// User sessions: sessionId -> user object
const sessions = new Map();

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
      const list = JSON.parse(raw);
      sessions.clear();
      for (const item of list) {
        sessions.set(item.sessionId, item.user);
      }
    }
  } catch (err) {
    console.error('[AuthApi] Error loading sessions file:', err.message);
  }
}

function saveSessions() {
  try {
    const list = Array.from(sessions.entries()).map(([sessionId, user]) => ({ sessionId, user }));
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('[AuthApi] Error saving sessions file:', err.message);
  }
}

loadSessions();

// Helper to generate avatar URL from Discord user object
function getDiscordAvatarUrl(user) {
  if (user.avatar) {
    const isAnimated = user.avatar.startsWith('a_');
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${isAnimated ? 'gif' : 'png'}?size=128`;
  }
  const index = (BigInt(user.id || 0) >> 22n) % 6n;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

// Get active session if user has logged in
function getSession(req) {
  loadSessions();
  const sessionId = (req.cookies && req.cookies['zl-user'])
    || (req.headers && req.headers['x-session-id'])
    || (req.query && req.query.session_id)
    || (req.headers && req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));

  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId);
  }

  // Also support authenticated Discord user profile passed in body
  if (req.body && req.body.user) {
    const u = req.body.user;
    if (u.id) return u;
    if (u.username) {
      u.id = 'usr_' + u.username.toLowerCase();
      return u;
    }
  }
  // Also support authenticated Discord user profile passed in query string (?user=...)
  if (req.query && req.query.user) {
    try {
      const u = typeof req.query.user === 'string' ? JSON.parse(decodeURIComponent(req.query.user)) : req.query.user;
      if (u) {
        if (u.id) return u;
        if (u.username) {
          u.id = 'usr_' + u.username.toLowerCase();
          return u;
        }
      }
    } catch (e) {}
  }
  // Also support ?user_id=...
  if (req.query && req.query.user_id) {
    return {
      id: req.query.user_id,
      username: req.query.username || 'DiscordUser',
      global_name: req.query.global_name || req.query.username || 'DiscordUser'
    };
  }
  return null;
}

// =========================================================================
// 1. DISCORD OAUTH2 ENDPOINTS
// =========================================================================

// Helper to determine the effective redirect URI
function getEffectiveRedirectUri(req) {
  // If explicitly configured to a custom domain (non-localhost) via env, respect it
  if (process.env.DISCORD_REDIRECT_URI && !process.env.DISCORD_REDIRECT_URI.includes('localhost')) {
    return process.env.DISCORD_REDIRECT_URI;
  }
  // Otherwise dynamically compute protocol + host (handles Render, Railway, localhost, etc.)
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : req.protocol || 'http');
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
  return `${proto}://${host}/auth/discord/callback`;
}

// GET /auth/discord
// Initiates official Discord OAuth2 authorization redirect directly
router.get('/discord', (req, res) => {
  const returnTo = req.query.return_to || '';
  const statePayload = {
    csrf: crypto.randomBytes(12).toString('hex'),
    return_to: returnTo
  };
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 10 * 60 * 1000 });
  if (returnTo) {
    res.cookie('oauth_return_to', returnTo, { maxAge: 10 * 60 * 1000, httpOnly: false });
  }

  const clientId = config.discord.clientId || process.env.DISCORD_CLIENT_ID || '1554913871825735831';
  const redirectUri = encodeURIComponent(getEffectiveRedirectUri(req));
  const scope = encodeURIComponent('identify');
  const promptParam = req.query.prompt ? `&prompt=${encodeURIComponent(req.query.prompt)}` : '';
  
  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}${promptParam}`;

  return res.redirect(discordAuthUrl);
});

// GET /auth/discord/callback
// Handles code return from Discord OAuth2
router.get('/discord/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Extract return_to from state or cookie
  let returnTo = null;
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      if (decoded && decoded.return_to) {
        returnTo = decoded.return_to;
      }
    } catch (e) {}
  }
  if (!returnTo && req.cookies && req.cookies.oauth_return_to) {
    returnTo = req.cookies.oauth_return_to;
  }

  const sendErrorRedirect = (msg) => {
    if (returnTo) {
      const sep = returnTo.includes('?') ? '&' : '?';
      return res.redirect(`${returnTo}${sep}error=${encodeURIComponent(msg)}`);
    }
    return res.redirect(`/me.html?error=${encodeURIComponent(msg)}`);
  };

  if (error || !code) {
    console.error('[Discord OAuth Error]', error, error_description);
    return sendErrorRedirect(error_description || 'Discord authorization canceled');
  }

  try {
    if (!config.discord.clientSecret) {
      throw new Error('Discord Client Secret is missing in server environment');
    }

    const redirectUri = getEffectiveRedirectUri(req);

    // Exchange Code for Access Token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.discord.clientId || process.env.DISCORD_CLIENT_ID || '1554913871825735831',
        client_secret: config.discord.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      throw new Error(`Token exchange failed: ${errBody}`);
    }

    const tokenData = await tokenRes.json();

    // Fetch user profile from Discord @me
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userRes.ok) throw new Error('Failed to fetch Discord user info');
    const discordUser = await userRes.json();

    // Create authentic session
    const sessionId = 'usr_' + crypto.randomBytes(16).toString('hex');
    const sessionUser = {
      id: discordUser.id,
      username: discordUser.username,
      global_name: discordUser.global_name || discordUser.username,
      avatarUrl: getDiscordAvatarUrl(discordUser),
      discriminator: discordUser.discriminator,
      joinedAt: new Date().toISOString()
    };

    sessions.set(sessionId, sessionUser);
    saveSessions();
    res.cookie('zl-user', sessionId, { path: '/', httpOnly: false, maxAge: 30 * 24 * 60 * 60 * 1000 });

    if (returnTo) {
      const sep = returnTo.includes('?') ? '&' : '?';
      return res.redirect(`${returnTo}${sep}auth=success&session_id=${sessionId}&user=${encodeURIComponent(JSON.stringify(sessionUser))}`);
    }
    return res.redirect('/me.html?auth=success');
  } catch (err) {
    console.error('[Discord OAuth Callback Error]', err.message);
    return sendErrorRedirect(err.message);
  }
});

// GET /auth/quick-login (One-click login for local development / testing)
router.get('/quick-login', (req, res) => {
  const sessionId = 'usr_' + crypto.randomBytes(16).toString('hex');
  const customUser = req.query.username ? req.query.username.trim() : 'kartikplayzz1';
  const sessionUser = {
    id: '768387330485518376',
    username: customUser,
    global_name: customUser,
    avatarUrl: `https://mc-heads.net/avatar/${encodeURIComponent(customUser)}/128`,
    discriminator: '0',
    joinedAt: new Date().toISOString()
  };
  sessions.set(sessionId, sessionUser);
  saveSessions();
  res.cookie('zl-user', sessionId, { path: '/', httpOnly: false, maxAge: 30 * 24 * 60 * 60 * 1000 });

  const returnTo = req.query.return_to;
  if (returnTo) {
    const sep = returnTo.includes('?') ? '&' : '?';
    return res.redirect(`${returnTo}${sep}auth=success&session_id=${sessionId}&user=${encodeURIComponent(JSON.stringify(sessionUser))}`);
  }
  return res.redirect('/me.html?auth=success');
});

// GET & POST /auth/logout
const handleLogout = (req, res) => {
  const sessionId = req.cookies && req.cookies['zl-user'];
  if (sessionId) {
    sessions.delete(sessionId);
  }
  // Thoroughly clear all sessions on disk and memory
  sessions.clear();
  saveSessions();

  // Explicitly clear cookies across all possible paths
  const clearPaths = ['/', '/auth', '/api', '/me', ''];
  for (const p of clearPaths) {
    const opts = p ? { path: p } : {};
    res.clearCookie('zl-user', opts);
    res.clearCookie('oauth_state', opts);
  }

  // Force expired Set-Cookie headers
  res.setHeader('Set-Cookie', [
    'zl-user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax',
    'oauth_state=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax'
  ]);

  if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
    return res.json({ success: true, authenticated: false });
  }
  const returnTo = req.query.return_to || '/me.html';
  const sep = returnTo.includes('?') ? '&' : '?';
  return res.redirect(`${returnTo}${sep}logged_out=` + Date.now());
};

router.get('/logout', handleLogout);
router.post('/logout', handleLogout);
router.all('/logout', handleLogout);

// Export handleLogout for direct server mounting
router.handleLogout = handleLogout;

// =========================================================================
// 2. AUTH STATUS & PROFILE
// =========================================================================

// GET /api/auth/me
router.get('/me', (req, res) => {
  const user = getSession(req);
  if (!user) {
    return res.json({ authenticated: false, user: null });
  }
  res.json({ authenticated: true, user });
});

// =========================================================================
// 3. MINECRAFT LINKING ENGINE (CRACK + PREMIUM + BEDROCK PE)
// =========================================================================

// GET & POST /api/auth/link/status
router.all('/link/status', (req, res) => {
  let user = getSession(req);
  if (!user && req.query.user) {
    try { user = JSON.parse(decodeURIComponent(req.query.user)); } catch (e) {}
  }
  if (!user && req.body && req.body.user) {
    user = req.body.user;
  }

  if (!user || !user.id) {
    return res.json({
      authenticated: false,
      user: null,
      isLinked: false,
      linkedPlayer: null,
      activeCode: null
    });
  }

  const linkRecord = PlayerLinkService.getLinkStatus(user.id);
  let activeCode = PlayerLinkService.getActiveCode(user.id);
  if (!activeCode && !linkRecord) {
    activeCode = PlayerLinkService.createLinkCode(user);
  }

  res.json({
    authenticated: true,
    user,
    isLinked: !!linkRecord,
    linkedPlayer: linkRecord,
    activeCode: activeCode ? {
      code: activeCode.code,
      expiresAt: activeCode.expiresAt,
      expiresInSeconds: activeCode.expiresInSeconds
    } : null
  });
});

// GET & POST /api/auth/link/generate-code
// Generates a new 8-digit code with 120s countdown
router.all('/link/generate-code', (req, res) => {
  let user = getSession(req);
  if (!user && req.query.user) {
    try { user = JSON.parse(decodeURIComponent(req.query.user)); } catch (e) {}
  }
  if (!user && req.body && req.body.user) {
    user = req.body.user;
  }

  if (!user || !user.id) {
    return res.status(401).json({ error: 'Please log in with Discord first' });
  }

  // Force generate a fresh 8-digit code
  const codeEntry = PlayerLinkService.createLinkCode(user, true);

  res.json({
    success: true,
    code: codeEntry.code,
    formattedCode: codeEntry.code.split('').join(' '),
    command: `/link ${codeEntry.code}`,
    expiresAt: codeEntry.expiresAt,
    expiresInSeconds: codeEntry.expiresInSeconds
  });
});

// GET /api/auth/link/events (Server-Sent Events)
// Real-time notification stream for /me page when in-game /link executes
router.get('/link/events', (req, res) => {
  const user = getSession(req);
  if (!user || !user.id) {
    return res.status(401).end();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.flushHeaders && res.flushHeaders();

  PlayerLinkService.addSseClient(user.id, res);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ event: 'connected', userId: user.id })}\n\n`);
});

// POST /api/auth/link/ingame
// Production endpoint called by Minecraft Server Plugin / Skript on `/link <code>`
router.post('/link/ingame', async (req, res) => {
  const { code, player, uuid, isBedrock, skinName, serverSecret } = req.body;

  // Optional shared secret check
  if (config.serverSecret && serverSecret && serverSecret !== config.serverSecret) {
    return res.status(403).json({ success: false, error: 'Unauthorized Minecraft server secret' });
  }

  if (!code || !player) {
    return res.status(400).json({ success: false, error: 'Missing code or player name' });
  }

  const result = await PlayerLinkService.verifyAndLink({
    code,
    minecraftUsername: player,
    isBedrock: Boolean(isBedrock),
    serverUuid: uuid,
    skinName: skinName || null
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json({
    success: true,
    message: result.message,
    player: result.player,
    minecraftChatResponse: `§8[§cBattlepie§8] §aSuccessfully linked §e${result.player.minecraftUsername} §7(${result.player.accountType}) §ato Discord §e@${result.player.discordUsername}§a!`
  });
});

// POST /api/auth/link/verify
// Browser verification endpoint
router.post('/link/verify', async (req, res) => {
  const { code, minecraftUsername, isBedrock } = req.body;
  const result = await PlayerLinkService.verifyAndLink({
    code,
    minecraftUsername,
    isBedrock: Boolean(isBedrock)
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// POST & GET /api/auth/link/unlink
router.all('/link/unlink', (req, res) => {
  const user = getSession(req);
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const success = PlayerLinkService.unlink(user.id);
  res.json({ success });
});

module.exports = router;
