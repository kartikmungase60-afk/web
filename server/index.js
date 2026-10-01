const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config');

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger (Lightweight)
app.use((req, res, next) => {
  if (!req.url.startsWith('/css') && !req.url.startsWith('/js')) {
    console.log(`[HTTP] ${req.method} ${req.url}`);
  }
  next();
});

// API Routes
app.use('/api-public', require('./routes/publicApi'));
app.use('/api/public', require('./routes/publicApi'));
app.use('/api/status', require('./routes/publicApi'));
app.use('/store', require('./routes/storeApi'));
app.use('/api/store', require('./routes/storeApi'));
app.use('/api/webhooks', require('./routes/webhookApi'));
app.use('/skin', require('./routes/skinApi'));
app.use('/auth', require('./routes/authApi'));
app.use('/api/auth', require('./routes/authApi'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    network: 'Mine Orange',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Clean URL routing to frontend HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(config.paths.publicDir, 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(config.paths.publicDir, 'login.html'));
});

app.get('/me', (req, res) => {
  res.sendFile(path.join(config.paths.publicDir, 'me.html'));
});

// Direct logout handler with full cookie clearance
const { handleLogout } = require('./routes/authApi');
app.all(['/logout', '/auth/logout', '/api/auth/logout', '/api/logout'], handleLogout);

app.get('/store', (req, res) => {
  res.sendFile(path.join(config.paths.publicDir, 'store.html'));
});

app.get('/store/checkout', (req, res) => {
  res.sendFile(path.join(config.paths.publicDir, 'checkout.html'));
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(config.paths.publicDir, 'terms.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(config.paths.publicDir, 'privacy.html'));
});

// Static assets (CSS, JS, and HTML files)
app.use(express.static(config.paths.publicDir));

// Fallback 404 handler for HTML pages
app.use((req, res) => {
  res.status(404).sendFile(path.join(config.paths.publicDir, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Start Server if executed directly
if (require.main === module) {
  const server = app.listen(config.port, () => {
    console.log('========================================================');
    console.log(`  🥧 BATTLEPIE NETWORK BACKEND SERVER STARTED`);
    console.log(`  Local URL:       http://localhost:${config.port}`);
    console.log(`  Public Status:   http://localhost:${config.port}/api-public/status`);
    console.log(`  Discord Stats:   http://localhost:${config.port}/api-public/discord`);
    console.log(`  Store API:       http://localhost:${config.port}/store/products`);
    console.log(`  Minecraft Host:  ${config.minecraft.host}:${config.minecraft.port}`);
    console.log(`  RCON Protocol:   ${config.rcon.enabled ? 'Enabled (' + config.rcon.host + ':' + config.rcon.port + ')' : 'Development Simulation Mode'}`);
    console.log('========================================================');
    
    // Automatically poll Minecraft server logs to instantly bridge in-game /link
    try {
      const minecraftLogBridge = require('./services/minecraftLogBridge');
      minecraftLogBridge.start();
    } catch (e) {
      console.warn('[Server] Could not initialize MinecraftLogBridge:', e.message);
    }
  });
}

module.exports = app;
