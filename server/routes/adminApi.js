const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const dataManager = require('../services/dataManager');
const orderStore = require('../services/orderStore');
const PlayerLinkService = require('../services/playerLinkService');
const config = require('../config');

const crypto = require('crypto');

// Helper to extract client IP
function getClientIp(req) {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  if (typeof ip === 'string' && ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return ip;
}

// ---------------------------------------------------------------------------
// ADMIN AUTHENTICATION HELPERS & TOKENS
// ---------------------------------------------------------------------------
const ADMIN_SECRET = (config.admin && config.admin.sessionSecret) || 'mineorange_admin_vault_secret_8842';
const ADMIN_USER = (config.admin && config.admin.username) || process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = (config.admin && config.admin.password) || process.env.ADMIN_PASSWORD || 'MineOrange@2026!';

function createAdminToken(user) {
  const ts = Date.now();
  const payload = `${user}:${ts}`;
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64');
}

function verifyAdminToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [user, tsStr, sig] = parts;
    const ts = parseInt(tsStr, 10);
    // Valid for 7 days
    if (isNaN(ts) || Date.now() - ts > 7 * 24 * 60 * 60 * 1000) return false;
    const expectedSig = crypto.createHmac('sha256', ADMIN_SECRET).update(`${user}:${tsStr}`).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

// =========================================================================
// 0. ADMIN AUTHENTICATION ENDPOINTS (Public for Login)
// =========================================================================
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUser = (username || '').trim();
  const cleanPass = (password || '').trim();

  if (cleanUser === ADMIN_USER && cleanPass === ADMIN_PASS) {
    const token = createAdminToken(cleanUser);
    res.cookie('mineorange_admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Auth',
      action: 'ADMIN_LOGIN_SUCCESS',
      details: 'Staff member authenticated into admin dashboard'
    });

    return res.json({
      success: true,
      authenticated: true,
      token,
      message: 'Login successful'
    });
  }

  dataManager.addAuditLog({
    ip: getClientIp(req),
    category: 'Auth',
    action: 'ADMIN_LOGIN_FAILED',
    details: `Failed admin login attempt with user: '${cleanUser || 'anonymous'}'`
  });

  return res.status(401).json({
    success: false,
    authenticated: false,
    error: 'Invalid admin username or password'
  });
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('mineorange_admin_token', { path: '/' });
  dataManager.addAuditLog({
    ip: getClientIp(req),
    category: 'Auth',
    action: 'ADMIN_LOGOUT',
    details: 'Staff member logged out of admin dashboard'
  });
  return res.json({ success: true, authenticated: false, message: 'Logged out successfully' });
});

router.get('/auth/check', (req, res) => {
  const token = (req.cookies && req.cookies.mineorange_admin_token) ||
    (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '').trim() : null);
  const isValid = verifyAdminToken(token);
  return res.json({
    success: true,
    authenticated: isValid
  });
});

// =========================================================================
// AUTHENTICATION PROTECTION MIDDLEWARE
// =========================================================================
// All subsequent /api/admin/* endpoints require valid admin token
router.use((req, res, next) => {
  const token = (req.cookies && req.cookies.mineorange_admin_token) ||
    (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '').trim() : null);

  if (!verifyAdminToken(token)) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      error: 'Admin authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  next();
});

// =========================================================================
// 1. OVERVIEW & STATS
// =========================================================================
router.get('/overview', (req, res) => {
  try {
    const products = dataManager.getProducts();
    const ordersData = orderStore.orders || { orders: [] };
    const allOrders = ordersData.orders || [];
    const paidOrders = allOrders.filter(o => o.status === 'PAID');
    const totalRevenueCents = paidOrders.reduce((sum, o) => sum + (o.totalCents || 0), 0);

    const apps = dataManager.getApplications();
    const discSubs = apps.discordStaff ? (apps.discordStaff.submissions || []).length : 0;
    const mcSubs = apps.minecraftStaff ? (apps.minecraftStaff.submissions || []).length : 0;

    const tournaments = dataManager.getTournaments();
    let totalTeams = 0;
    for (const t of tournaments) {
      totalTeams += (t.teams || []).length;
    }

    const linkedList = PlayerLinkService.getAllLinks ? PlayerLinkService.getAllLinks() : [];
    const logs = dataManager.getAuditLogs();

    res.json({
      success: true,
      stats: {
        totalProducts: products.length,
        totalOrders: allOrders.length,
        paidOrders: paidOrders.length,
        totalRevenue: '$' + (totalRevenueCents / 100).toFixed(2),
        totalApplications: discSubs + mcSubs,
        activeTournaments: tournaments.length,
        registeredTeams: totalTeams,
        linkedPlayers: linkedList.length,
        totalLogs: logs.length
      },
      recentLogs: logs.slice(0, 10),
      recentOrders: allOrders.slice(-5).reverse()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 2. STORE & PRODUCTS MANAGEMENT
// =========================================================================
router.get('/products', (req, res) => {
  const products = dataManager.getProducts();
  res.json({ success: true, products });
});

router.post('/products', (req, res) => {
  try {
    const { name, category, priceUsdCents, originalPriceUsdCents, description, perks, imageUrl, badge, rconCommands } = req.body;
    if (!name || !priceUsdCents) {
      return res.status(400).json({ success: false, error: 'Product name and price are required' });
    }

    const products = dataManager.getProducts();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id = slug + '-' + Date.now().toString(36).substring(2, 6);

    const newProd = {
      id,
      name,
      slug,
      category: category || 'ranks',
      priceUsdCents: parseInt(priceUsdCents, 10),
      originalPriceUsdCents: originalPriceUsdCents ? parseInt(originalPriceUsdCents, 10) : null,
      saleName: originalPriceUsdCents ? 'Special Offer' : null,
      badge: badge || null,
      imageUrl: imageUrl || 'https://battlepie.net/uploads/pie-rank-icon.png',
      allowQuantity: category === 'lifesteal' || category === 'items',
      isSubscription: false,
      description: description || '',
      perks: Array.isArray(perks) ? perks : (typeof perks === 'string' ? perks.split('\n').filter(Boolean) : []),
      rconCommands: Array.isArray(rconCommands) ? rconCommands : []
    };

    products.push(newProd);
    dataManager.saveProducts(products);

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Store',
      action: 'CREATE_PRODUCT',
      details: `Created new product '${name}' in category '${newProd.category}' for $${(newProd.priceUsdCents / 100).toFixed(2)}`
    });

    res.json({ success: true, product: newProd });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const products = dataManager.getProducts();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const old = products[idx];
    const updated = {
      ...old,
      ...req.body,
      id: old.id // Preserve ID
    };

    if (req.body.priceUsdCents !== undefined) {
      updated.priceUsdCents = parseInt(req.body.priceUsdCents, 10);
    }
    if (req.body.originalPriceUsdCents !== undefined) {
      updated.originalPriceUsdCents = req.body.originalPriceUsdCents ? parseInt(req.body.originalPriceUsdCents, 10) : null;
    }
    if (typeof req.body.perks === 'string') {
      updated.perks = req.body.perks.split('\n').map(s => s.trim()).filter(Boolean);
    }

    products[idx] = updated;
    dataManager.saveProducts(products);

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Store',
      action: 'UPDATE_PRODUCT',
      details: `Updated product '${updated.name}' ($${(updated.priceUsdCents / 100).toFixed(2)})`
    });

    res.json({ success: true, product: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const products = dataManager.getProducts();
    const item = products.find(p => p.id === id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const filtered = products.filter(p => p.id !== id);
    dataManager.saveProducts(filtered);

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Store',
      action: 'DELETE_PRODUCT',
      details: `Deleted product '${item.name}' (ID: ${item.id})`
    });

    res.json({ success: true, message: `Product ${item.name} deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 3. ORDERS MANAGEMENT
// =========================================================================
router.get('/orders', (req, res) => {
  try {
    const ordersData = orderStore.orders || { orders: [] };
    const allOrders = ordersData.orders || [];
    const status = req.query.status;
    let list = allOrders;
    if (status && status !== 'all') {
      list = list.filter(o => o.status === status);
    }
    res.json({ success: true, orders: list.slice().reverse() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const order = orderStore.getOrder(id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const prevStatus = order.status;
    order.status = status;

    if (status === 'PAID' && prevStatus !== 'PAID') {
      order.paidAt = new Date().toISOString();
      // Optional reward trigger
      try {
        const rconClient = require('../services/rconService');
        for (const item of (order.items || [])) {
          if (item.rconCommands && item.rconCommands.length > 0) {
            await rconClient.executeRewardCommands(order.username, item.rconCommands);
          }
        }
      } catch (e) {
        console.warn('[Admin] RCON dispatch notice:', e.message);
      }
    }

    orderStore.save();

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Store',
      action: 'UPDATE_ORDER_STATUS',
      details: `Changed order ${order.id} for player '${order.username}' from ${prevStatus} to ${status}`
    });

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 4. APPLICATIONS MANAGEMENT
// =========================================================================
router.get('/applications', (req, res) => {
  try {
    const apps = dataManager.getApplications();
    res.json({ success: true, applications: apps });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/applications/config', (req, res) => {
  try {
    const { type, isOpen, description, questions } = req.body;
    const apps = dataManager.getApplications();
    if (!apps[type]) {
      return res.status(400).json({ success: false, error: 'Unknown application type: ' + type });
    }

    if (isOpen !== undefined) apps[type].isOpen = Boolean(isOpen);
    if (description !== undefined) apps[type].description = description;
    if (Array.isArray(questions)) {
      apps[type].questions = questions;
      apps[type].questionsCount = questions.length;
    }

    dataManager.saveApplications(apps);

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Applications',
      action: 'UPDATE_APP_CONFIG',
      details: `Updated configuration and questions for '${apps[type].title}' (Status: ${apps[type].isOpen ? 'OPEN' : 'CLOSED'})`
    });

    res.json({ success: true, application: apps[type] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/applications/submissions', (req, res) => {
  try {
    const apps = dataManager.getApplications();
    const list = [];
    if (apps.discordStaff && apps.discordStaff.submissions) {
      for (const s of apps.discordStaff.submissions) {
        list.push({ ...s, type: 'discordStaff', appTitle: 'Discord Staff' });
      }
    }
    if (apps.minecraftStaff && apps.minecraftStaff.submissions) {
      for (const s of apps.minecraftStaff.submissions) {
        list.push({ ...s, type: 'minecraftStaff', appTitle: 'Minecraft Staff' });
      }
    }
    res.json({ success: true, submissions: list.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/applications/submissions/:id/review', (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body; // APPROVED, REJECTED, UNDER REVIEW
    const apps = dataManager.getApplications();

    let foundSub = null;
    let foundType = null;

    for (const key of ['discordStaff', 'minecraftStaff']) {
      if (apps[key] && apps[key].submissions) {
        const sub = apps[key].submissions.find(s => s.id === id);
        if (sub) {
          foundSub = sub;
          foundType = key;
          break;
        }
      }
    }

    if (!foundSub) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }

    foundSub.status = status || foundSub.status;
    foundSub.adminNote = note || foundSub.adminNote || '';
    foundSub.reviewedAt = new Date().toISOString();

    dataManager.saveApplications(apps);

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Applications',
      action: 'REVIEW_SUBMISSION',
      details: `Marked application ${id} (${foundSub.applicant}) as '${status}'`
    });

    res.json({ success: true, submission: foundSub });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 5. TOURNAMENTS & EVENTS MANAGEMENT
// =========================================================================
router.get('/tournaments', (req, res) => {
  try {
    const tournaments = dataManager.getTournaments();
    res.json({ success: true, tournaments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/tournaments', (req, res) => {
  try {
    const { name, bannerImage, description, maxTeams, isOpen, rules, prizes } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Tournament name is required' });
    }

    const tournaments = dataManager.getTournaments();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id = slug + '-' + Date.now().toString(36).substring(2, 6);

    const newTourney = {
      id,
      name,
      slug,
      status: isOpen ? 'Registration open' : 'Closed',
      isOpen: Boolean(isOpen),
      bannerImage: bannerImage || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
      badgeIcon: 'https://mc-heads.net/head/Bed/64',
      description: description || '',
      rules: Array.isArray(rules) ? rules : [],
      prizes: Array.isArray(prizes) ? prizes : [],
      maxTeams: maxTeams ? parseInt(maxTeams, 10) : 32,
      teams: []
    };

    tournaments.push(newTourney);
    dataManager.saveTournaments(tournaments);

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Tournaments',
      action: 'CREATE_TOURNAMENT',
      details: `Created tournament '${name}' (Max teams: ${newTourney.maxTeams})`
    });

    res.json({ success: true, tournament: newTourney });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/tournaments/:id', (req, res) => {
  try {
    const { id } = req.params;
    const tournaments = dataManager.getTournaments();
    const idx = tournaments.findIndex(t => t.id === id || t.slug === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    const old = tournaments[idx];
    const updated = {
      ...old,
      ...req.body,
      id: old.id,
      slug: old.slug
    };

    if (req.body.isOpen !== undefined) {
      updated.isOpen = Boolean(req.body.isOpen);
      updated.status = updated.isOpen ? 'Registration open' : 'Registration closed';
    }

    tournaments[idx] = updated;
    dataManager.saveTournaments(tournaments);

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Tournaments',
      action: 'UPDATE_TOURNAMENT',
      details: `Updated tournament '${updated.name}' (Status: ${updated.status})`
    });

    res.json({ success: true, tournament: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/tournaments/:id', (req, res) => {
  try {
    const { id } = req.params;
    const tournaments = dataManager.getTournaments();
    const item = tournaments.find(t => t.id === id || t.slug === id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    const filtered = tournaments.filter(t => t.id !== id && t.slug !== id);
    dataManager.saveTournaments(filtered);

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Tournaments',
      action: 'DELETE_TOURNAMENT',
      details: `Deleted tournament '${item.name}' (ID: ${item.id})`
    });

    res.json({ success: true, message: `Tournament ${item.name} deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/tournaments/:id/teams/:teamId/status', (req, res) => {
  try {
    const { id, teamId } = req.params;
    const { status } = req.body; // APPROVED, REJECTED, DISQUALIFIED
    const tournaments = dataManager.getTournaments();
    const tourney = tournaments.find(t => t.id === id || t.slug === id);
    if (!tourney) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    const team = (tourney.teams || []).find(tm => tm.id === teamId);
    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }

    const prev = team.status;
    team.status = status;
    dataManager.saveTournaments(tournaments);

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Tournaments',
      action: 'UPDATE_TEAM_STATUS',
      details: `Changed status for team '${team.name}' in '${tourney.name}' from ${prev} to ${status}`
    });

    res.json({ success: true, team });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 6. PLAYERS & ACCOUNTS CONTROL
// =========================================================================
router.get('/players', (req, res) => {
  try {
    const list = PlayerLinkService.getAllLinks ? PlayerLinkService.getAllLinks() : [];
    res.json({ success: true, players: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/players/:discordId', async (req, res) => {
  try {
    const { discordId } = req.params;
    const status = PlayerLinkService.getLinkStatus(discordId);
    const username = status ? status.minecraftUsername : 'Unknown';

    await PlayerLinkService.unlink(discordId);

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Players',
      action: 'UNLINK_ACCOUNT',
      details: `Unlinked Minecraft account '${username}' from Discord ID ${discordId}`
    });

    res.json({ success: true, message: `Unlinked account successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/players/:username/reset-skin', (req, res) => {
  try {
    const { username } = req.params;
    const link = PlayerLinkService.getLinkByUsername(username);
    if (link) {
      link.skinUrl = null;
      link.avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(username)}/128`;
      PlayerLinkService.save && PlayerLinkService.save();
    }

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Players',
      action: 'RESET_SKIN',
      details: `Reset custom skin for player '${username}' to default Steve model`
    });

    res.json({ success: true, message: `Skin for ${username} reset successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/passwords', (req, res) => {
  try {
    const data = dataManager.getPasswords();
    res.json({ success: true, logs: data.logs || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 7. SITE SETTINGS
// =========================================================================
router.get('/settings', (req, res) => {
  try {
    const settings = dataManager.getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/settings', (req, res) => {
  try {
    const current = dataManager.getSettings();
    const updated = {
      ...current,
      ...req.body
    };

    dataManager.saveSettings(updated);

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Settings',
      action: 'UPDATE_SETTINGS',
      details: `Updated site banner and server parameters (Banner: ${updated.bannerText ? updated.bannerText.substring(0, 30) + '...' : 'None'})`
    });

    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 8. REAL-TIME MEDIA UPLOAD
// =========================================================================
router.post('/upload', (req, res) => {
  try {
    const { filename, base64Data } = req.body;
    if (!base64Data) {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }

    // Strip prefix if present (data:image/png;base64,...)
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const ext = (filename && path.extname(filename)) || '.png';
    const safeName = 'upload_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + ext;
    const targetPath = path.join(__dirname, '../../uploads', safeName);

    fs.writeFileSync(targetPath, buffer);

    const publicUrl = `/uploads/${safeName}`;

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Media',
      action: 'UPLOAD_FILE',
      details: `Uploaded new asset file '${safeName}' (${(buffer.length / 1024).toFixed(1)} KB)`
    });

    res.json({ success: true, url: publicUrl, filename: safeName });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 9. AUDIT LOGS (MANDATORY: Date, Time, IP, Action, strictly hide admin account)
// =========================================================================
router.get('/audit-logs', (req, res) => {
  try {
    const logs = dataManager.getAuditLogs();
    const category = req.query.category;
    let list = logs;
    if (category && category !== 'all') {
      list = list.filter(l => l.category.toLowerCase() === category.toLowerCase());
    }

    // Sanitize to guarantee admin account is hidden
    const sanitized = list.map(l => ({
      id: l.id,
      date: l.date,
      time: l.time,
      ip: l.ip,
      category: l.category,
      action: l.action,
      details: l.details,
      adminAccount: '[Protected Admin]' // Strictly anonymized as instructed
    }));

    res.json({ success: true, logs: sanitized });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
