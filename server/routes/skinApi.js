const express = require('express');
const router = express.Router();

// GET /skin/:username -> Redirects or streams 3D Minecraft skin
router.get('/:username', (req, res) => {
  const username = req.params.username.replace(/^\./, '');
  const target = `https://mc-heads.net/body/${encodeURIComponent(username)}/right`;
  res.redirect(target);
});

// GET /skin/head/:username -> Redirects or streams Minecraft head
router.get('/head/:username', (req, res) => {
  const username = req.params.username.replace(/^\./, '');
  const size = req.query.size || 128;
  const target = `https://mc-heads.net/avatar/${encodeURIComponent(username)}/${size}`;
  res.redirect(target);
});

module.exports = router;
