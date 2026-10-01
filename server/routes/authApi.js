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
  const sessionId = req.cookies && req.cookies['zl-user'];
  if (!sessionId) {
    return null;
  }
  // Strictly return the matching session only
  if (sessions.has(sessionId)) {
    return sessions.get(sessionId);
  }
  return null;
}

// =========================================================================
// 1. DISCORD OAUTH2 ENDPOINTS
// =========================================================================

// GET /auth/discord
// Initiates official Discord OAuth2 authorization redirect directly
router.get('/discord', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 10 * 60 * 1000 });

  const clientId = config.discord.clientId || '1554913871825735831';
  const redirectUri = encodeURIComponent(config.discord.redirectUri);
  const scope = encodeURIComponent('identify');
  const promptParam = req.query.prompt ? `&prompt=${encodeURIComponent(req.query.prompt)}` : '';
  
  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}${promptParam}`;

  return res.redirect(discordAuthUrl);
});

// GET /auth/discord/callback
// Handles code return from Discord OAuth2
router.get('/discord/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error || !code) {
    console.error('[Discord OAuth Error]', error, error_description);
    return res.redirect(`/me?error=${encodeURIComponent(error_description || 'Discord authorization canceled')}`);
  }

  try {
    if (!config.discord.clientSecret) {
      throw new Error('Discord Client Secret is missing in .env');
    }

    // Exchange Code for Access Token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.discord.redirectUri
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
    return res.redirect('/me?auth=success');
  } catch (err) {
    console.error('[Discord OAuth Callback Error]', err.message);
    res.redirect(`/me?error=${encodeURIComponent(err.message)}`);
  }
});

// GET /auth/quick-login (One-click login for local development / testing)
router.get('/quick-login', (req, res) => {
  const sessionId = 'usr_' + crypto.randomBytes(16).toString('hex');
  const sessionUser = {
    id: '768387330485518376',
    username: 'kartikplayzz1',
    global_name: 'Kartik...',
    avatarUrl: 'https://cdn.discordapp.com/avatars/768387330485518376/7cc5d375ddea98426cd718f152a0dbd8.png?size=128',
    discriminator: '0',
    joinedAt: new Date().toISOString()
  };
  sessions.set(sessionId, sessionUser);
  saveSessions();
  res.cookie('zl-user', sessionId, { path: '/', httpOnly: false, maxAge: 30 * 24 * 60 * 60 * 1000 });
  return res.redirect('/me?auth=success');
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
  return res.redirect('/me?logged_out=' + Date.now());
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

// GET /api/auth/link/status
router.get('/link/status', (req, res) => {
  const user = getSession(req);
  if (!user) {
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

// POST /api/auth/link/generate-code
// Generates a new 8-digit code with 180s (3m 00s) countdown
router.post('/link/generate-code', (req, res) => {
  const user = getSession(req);
  if (!user) {
    return res.status(401).json({ error: 'Please log in with Discord first' });
  }
  // Force generate a fresh 8-digit code (1 min expiry)
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
  if (!user) {
    return res.status(401).end();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
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

// POST /api/auth/link/unlink
router.post('/link/unlink', (req, res) => {
  const user = getSession(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const success = PlayerLinkService.unlink(user.id);
  res.json({ success });
});

module.exports = router;
