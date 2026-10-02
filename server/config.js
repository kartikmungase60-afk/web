const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  serverSecret: process.env.SERVER_SECRET || 'battlepie_secret_token_123',
  firebaseDatabaseUrl: process.env.FIREBASE_DATABASE_URL || 'https://mine-orange-default-rtdb.asia-southeast1.firebasedatabase.app',
  
  // Minecraft Server Ping target
  minecraft: {
    host: process.env.MC_HOST || 'Node1.mineorange.fun',
    port: parseInt(process.env.MC_PORT || '25569', 10),
    bedrockPort: parseInt(process.env.MC_BEDROCK_PORT || '19132', 10),
    cacheSeconds: 15,
  },

  // Minecraft RCON Configuration for in-game perk execution
  rcon: {
    enabled: process.env.RCON_ENABLED === 'true' || false,
    host: process.env.RCON_HOST || '127.0.0.1',
    port: parseInt(process.env.RCON_PORT || '25575', 10),
    password: process.env.RCON_PASSWORD || 'battlepie_rcon_secret',
    timeoutMs: 5000,
  },

  // Discord Configuration
  discord: {
    inviteCode: process.env.DISCORD_INVITE || 'mineorange',
    guildId: process.env.DISCORD_GUILD_ID || '1545338483886002186',
    clientId: process.env.DISCORD_CLIENT_ID || '1555211386198696049',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || 'U9oUs61e2dEby7ikapN80tQ0ZT3aabJ1',
    redirectUri: process.env.DISCORD_REDIRECT_URI || 'https://mineorange.fun/auth/discord/callback',
  },

  // Admin Portal Authentication
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'MineOrange@2026!',
    sessionSecret: process.env.ADMIN_SECRET || 'mineorange_admin_vault_secret_8842',
  },

  // Coupon promo codes
  coupons: {
    'MINEORANGE': { discountPercent: 10, description: '10% off Mine Orange launch discount' },
    'BATTLEPIE': { discountPercent: 10, description: '10% off network launch discount' },
    'VIP20': { discountPercent: 20, description: '20% off special VIP promotion' },
    'SUMMER50': { discountPercent: 50, description: '50% off flash community event' },
  },

  // Paths
  paths: (() => {
    const fs = require('fs');
    const isVercel = !!process.env.VERCEL;
    const originalDataDir = path.join(__dirname, 'data');
    const targetDataDir = isVercel ? '/tmp/mineorange_data' : originalDataDir;

    if (isVercel) {
      try {
        if (!fs.existsSync(targetDataDir)) {
          fs.mkdirSync(targetDataDir, { recursive: true });
        }
        const seedFiles = ['orders.json', 'products.json', 'sessions.json', 'linked_players.json', 'active_codes.json'];
        for (const file of seedFiles) {
          const src = path.join(originalDataDir, file);
          const dest = path.join(targetDataDir, file);
          if (fs.existsSync(src) && !fs.existsSync(dest)) {
            fs.copyFileSync(src, dest);
          }
        }
      } catch (e) {
        console.warn('[Config] Notice initializing /tmp data directory:', e.message);
      }
    }

    return {
      publicDir: path.join(__dirname, '..'),
      dataDir: targetDataDir,
      ordersFile: path.join(targetDataDir, 'orders.json'),
      productsFile: path.join(targetDataDir, 'products.json'),
    };
  })()
};
