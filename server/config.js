const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  serverSecret: process.env.SERVER_SECRET || 'battlepie_secret_token_123',
  
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
    inviteCode: process.env.DISCORD_INVITE || 'rnRPZQvA8B',
    guildId: process.env.DISCORD_GUILD_ID || '',
    clientId: process.env.DISCORD_CLIENT_ID || '1554913871825735831',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/discord/callback',
  },

  // Coupon promo codes
  coupons: {
    'BATTLEPIE': { discountPercent: 10, description: '10% off network launch discount' },
    'VIP20': { discountPercent: 20, description: '20% off special VIP promotion' },
    'SUMMER50': { discountPercent: 50, description: '50% off flash community event' },
  },

  // Paths
  paths: {
    publicDir: path.join(__dirname, '..'),
    dataDir: path.join(__dirname, 'data'),
    ordersFile: path.join(__dirname, 'data', 'orders.json'),
    productsFile: path.join(__dirname, 'data', 'products.json'),
  }
};
