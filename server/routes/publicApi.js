const express = require('express');
const router = express.Router();
const { pingMinecraftServer } = require('../services/minecraftPing');
const { getDiscordStatus } = require('../services/discordService');
const { resolveMinecraftProfile } = require('../services/mojangService');

// GET /api-public/status
// Minecraft server status (online, player count, latency, motd)
router.get('/status', async (req, res) => {
  try {
    const status = await pingMinecraftServer();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve server status', details: err.message });
  }
});

// GET /api-public/discord
// Discord community stats
router.get('/discord', async (req, res) => {
  try {
    const discord = await getDiscordStatus();
    res.json(discord);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve Discord stats', details: err.message });
  }
});

// GET /api-public/player/:username
// Look up Minecraft player profile and skin
router.get('/player/:username', async (req, res) => {
  try {
    const isBedrock = req.query.bedrock === '1' || req.query.bedrock === 'true';
    const profile = await resolveMinecraftProfile(req.params.username, isBedrock);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Player lookup failed', details: err.message });
  }
});

// GET /api-public/resolve-profile?username=...&bedrock=true
router.get('/resolve-profile', async (req, res) => {
  const username = req.query.username;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username query parameter is required' });
  }
  try {
    const isBedrock = req.query.bedrock === '1' || req.query.bedrock === 'true';
    const profile = await resolveMinecraftProfile(username.trim(), isBedrock);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Profile resolution failed', details: err.message });
  }
});

module.exports = router;
