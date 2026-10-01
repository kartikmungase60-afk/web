const express = require('express');
const router = express.Router();
const PlayerLinkService = require('../services/playerLinkService');

// GET /skin/:username -> Redirects to the player's dynamic skin (SkinsRestorer or Mojang)
router.get('/:username', (req, res) => {
  const username = req.params.username.replace(/^\./, '');
  const link = PlayerLinkService.getLinkByUsername(username);
  if (link && link.skinUrl) {
    return res.redirect(link.skinUrl);
  }
  const target = `https://mc-heads.net/body/${encodeURIComponent(username)}/right`;
  res.redirect(target);
});

// GET /skin/head/:username -> Redirects to the player's dynamic head avatar
router.get('/head/:username', (req, res) => {
  const username = req.params.username.replace(/^\./, '');
  const size = req.query.size || 128;
  const link = PlayerLinkService.getLinkByUsername(username);
  if (link && link.avatarUrl) {
    return res.redirect(link.avatarUrl);
  }
  const target = `https://mc-heads.net/avatar/${encodeURIComponent(username)}/${size}`;
  res.redirect(target);
});

module.exports = router;
