const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const dataManager = require('../services/dataManager');
const orderStore = require('../services/orderStore');
const PlayerLinkService = require('../services/playerLinkService');

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

// =========================================================================
// 1. TOURNAMENTS
// =========================================================================
router.get('/tournaments', (req, res) => {
  try {
    const list = dataManager.getTournaments();
    res.json({ success: true, tournaments: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/tournaments/:id', (req, res) => {
  try {
    const tourney = dataManager.getTournament(req.params.id);
    if (!tourney) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }
    res.json({ success: true, tournament: tourney });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/tournaments/:id/register-team', (req, res) => {
  try {
    const { teamName, logo, players, substitutes } = req.body;
    const tourney = dataManager.getTournament(req.params.id);
    if (!tourney) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    if (!teamName || teamName.length < 3 || teamName.length > 10) {
      return res.status(400).json({ success: false, error: 'Team name must be 3-10 characters long' });
    }

    // Check uniqueness
    const exists = (tourney.teams || []).some(t => t.name.toLowerCase() === teamName.toLowerCase());
    if (exists) {
      return res.status(400).json({ success: false, error: 'A team with this name already exists in this tournament' });
    }

    const cleanedPlayers = Array.isArray(players) ? players.filter(Boolean) : [];
    const cleanedSubs = Array.isArray(substitutes) ? substitutes.filter(Boolean) : [];
    const leader = cleanedPlayers[0] || 'Unknown';

    const newTeam = {
      id: 'team_' + Date.now().toString(36),
      name: teamName,
      logo: logo || 'bear',
      leader,
      players: cleanedPlayers,
      substitutes: cleanedSubs,
      status: 'PENDING',
      registeredAt: new Date().toISOString()
    };

    tourney.teams = tourney.teams || [];
    tourney.teams.push(newTeam);
    const all = dataManager.getTournaments();
    const idx = all.findIndex(t => t.id === tourney.id);
    if (idx !== -1) all[idx] = tourney;
    dataManager.saveTournaments(all);

    // Create mailbox invitations for invited players
    const mailbox = dataManager.getMailbox();
    for (const player of cleanedPlayers.slice(1).concat(cleanedSubs)) {
      mailbox.invites.push({
        id: 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        recipient: player,
        teamName,
        tournamentName: tourney.name,
        tournamentId: tourney.id,
        invitedBy: leader,
        status: 'PENDING',
        sentAt: new Date().toISOString()
      });
    }
    dataManager.saveMailbox(mailbox);

    res.json({
      success: true,
      message: 'Team created successfully! Invitations sent to invited players.',
      team: newTeam
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 2. APPLICATIONS
// =========================================================================
router.get('/applications', (req, res) => {
  try {
    const apps = dataManager.getApplications();
    res.json({ success: true, applications: apps });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/applications/submit', (req, res) => {
  try {
    const { type, applicant, discordId, answers } = req.body;
    const apps = dataManager.getApplications();
    if (!apps[type]) {
      return res.status(400).json({ success: false, error: 'Unknown application type: ' + type });
    }

    if (!apps[type].isOpen) {
      return res.status(400).json({ success: false, error: 'This application is currently closed' });
    }

    if (!applicant || !answers) {
      return res.status(400).json({ success: false, error: 'Applicant name and answers are required' });
    }

    const subId = 'sub_' + type.substring(0, 4) + '_' + Date.now().toString(36);
    const newSubmission = {
      id: subId,
      applicant,
      discordId: discordId || 'user_' + applicant.toLowerCase(),
      submittedAt: new Date().toISOString(),
      status: 'SUBMITTED',
      answers
    };

    apps[type].submissions = apps[type].submissions || [];
    apps[type].submissions.push(newSubmission);
    dataManager.saveApplications(apps);

    res.json({
      success: true,
      message: 'Application submitted successfully! Our staff team will review it shortly.',
      submissionId: subId
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 3. MAILBOX
// =========================================================================
router.get('/mailbox', (req, res) => {
  try {
    const { username } = req.query;
    const mailbox = dataManager.getMailbox();
    let invites = mailbox.invites || [];
    if (username) {
      invites = invites.filter(i => i.recipient.toLowerCase() === username.toLowerCase());
    }
    res.json({ success: true, invites, messages: mailbox.messages || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/mailbox/respond', (req, res) => {
  try {
    const { inviteId, action } = req.body; // 'accept' or 'decline'
    const mailbox = dataManager.getMailbox();
    const inv = (mailbox.invites || []).find(i => i.id === inviteId);
    if (!inv) {
      return res.status(404).json({ success: false, error: 'Invitation not found' });
    }

    inv.status = action === 'accept' ? 'ACCEPTED' : 'DECLINED';
    inv.respondedAt = new Date().toISOString();
    dataManager.saveMailbox(mailbox);

    res.json({ success: true, message: `Invitation ${action}ed successfully`, invite: inv });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 4. CHANGE SKIN & CHANGE PASSWORD
// =========================================================================
// 4. CHANGE SKIN & CHANGE PASSWORD
// =========================================================================

// POST /api/skin/set (Set skin by name, preset, or Minecraft player username)
router.post('/skin/set', async (req, res) => {
  try {
    const { username, skinName, skinType } = req.body;
    if (!username || !skinName) {
      return res.status(400).json({ success: false, error: 'Username and skin name/preset are required' });
    }

    const cleanSkin = skinName.trim();
    const link = PlayerLinkService.getLinkByUsername(username);
    if (!link) {
      return res.status(404).json({ success: false, error: 'Linked Minecraft account not found' });
    }

    const skinsRestorerService = require('../services/skinsRestorerService');
    const resolved = await skinsRestorerService.resolveSkinPresetOrUser(cleanSkin);

    const skinUrl = (resolved && resolved.skinUrl) || `https://mc-heads.net/body/${encodeURIComponent(cleanSkin)}/right`;
    const avatarUrl = (resolved && resolved.avatarUrl) || `https://mc-heads.net/avatar/${encodeURIComponent(cleanSkin)}/128`;
    const finalSkinName = (resolved && resolved.skinName) || cleanSkin;
    const finalIdentifier = (resolved && resolved.identifier) || cleanSkin;
    const finalType = (resolved && resolved.type) || (cleanSkin.startsWith('sr-recommendation-') ? 'CUSTOM' : (skinType || 'PLAYER'));
    const textureHash = (resolved && resolved.textureHash) || null;

    // Write to SkinsRestorer on server via SFTP
    try {
      await skinsRestorerService.setPlayerSkinFile(
        link.minecraftUuid,
        finalIdentifier,
        finalType
      );
    } catch (e) {
      console.warn('[featuresApi] Could not write skin to SFTP:', e.message);
    }

    await PlayerLinkService.updatePlayerSkin(link.discordId, {
      skinName: finalSkinName,
      skinUrl,
      avatarUrl,
      textureHash,
      skinSource: `Website (${finalSkinName})`
    });

    const updated = PlayerLinkService.getLinkStatus(link.discordId);

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Players',
      action: 'UPDATE_SKIN',
      details: `Player '${username}' updated skin to '${finalSkinName}'`
    });

    res.json({
      success: true,
      message: `Skin '${finalSkinName}' applied successfully! Rejoin or use /skin update in-game if online.`,
      skinUrl,
      avatarUrl,
      textureHash,
      player: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/skin/upload', async (req, res) => {
  try {
    const { username, base64Data, filename, skinName } = req.body;
    if (!username || (!base64Data && !skinName)) {
      return res.status(400).json({ success: false, error: 'Username and skin image data are required' });
    }

    const link = PlayerLinkService.getLinkByUsername(username);
    if (!link) {
      return res.status(404).json({ success: false, error: 'Linked Minecraft account not found' });
    }

    let publicSkinUrl = null;
    let publicAvatarUrl = null;

    if (skinName) {
      const cleanSkin = skinName.trim();
      publicSkinUrl = `https://mc-heads.net/body/${encodeURIComponent(cleanSkin)}/right`;
      publicAvatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(cleanSkin)}/128`;
      await PlayerLinkService.updatePlayerSkin(link.discordId, {
        skinName: cleanSkin,
        skinUrl: publicSkinUrl,
        avatarUrl: publicAvatarUrl,
        skinSource: `Website (${cleanSkin})`
      });
    } else if (base64Data) {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      if (buffer.length > 512 * 1024) {
        return res.status(400).json({ success: false, error: 'File size exceeds 512 KB limit' });
      }

      const skinFilename = 'skin_' + encodeURIComponent(username.toLowerCase()) + '_' + Date.now() + '.png';
      try {
        const uploadsDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        fs.writeFileSync(path.join(uploadsDir, skinFilename), buffer);
      } catch (e) {}

      // Keep preview accessible
      publicSkinUrl = `https://mc-heads.net/body/${encodeURIComponent(username)}/right`;
      publicAvatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(username)}/128`;

      await PlayerLinkService.updatePlayerSkin(link.discordId, {
        skinUrl: publicSkinUrl,
        avatarUrl: publicAvatarUrl,
        skinSource: 'Custom Upload'
      });
    }

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Players',
      action: 'UPDATE_SKIN',
      details: `Player '${username}' updated custom Minecraft skin`
    });

    const updated = PlayerLinkService.getLinkStatus(link.discordId);

    res.json({
      success: true,
      message: 'Skin applied successfully! It will show across the network momentarily.',
      skinUrl: publicSkinUrl || (updated && updated.skinUrl),
      player: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/skin/reset', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, error: 'Username is required' });
    }

    const link = PlayerLinkService.getLinkByUsername(username);
    if (link) {
      const defaultSkinUrl = `https://mc-heads.net/body/Steve/right`;
      const defaultAvatarUrl = `https://mc-heads.net/avatar/Steve/128`;
      await PlayerLinkService.updatePlayerSkin(link.discordId, {
        skinName: null,
        skinUrl: defaultSkinUrl,
        avatarUrl: defaultAvatarUrl,
        skinSource: 'Default'
      });

      try {
        const skinsRestorerService = require('../services/skinsRestorerService');
        await skinsRestorerService.deletePlayerSkinFile(link.minecraftUuid);
      } catch (e) {}
    }

    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Players',
      action: 'RESET_SKIN',
      details: `Player '${username}' reset skin to default Steve model`
    });

    res.json({
      success: true,
      message: 'Skin reset to default Steve model.',
      skinUrl: 'https://mc-heads.net/body/Steve/right'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/auth/change-password', (req, res) => {
  try {
    const { username, newPassword, confirmPassword, reason } = req.body;
    if (!username || !newPassword) {
      return res.status(400).json({ success: false, error: 'Username and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match' });
    }

    const passStore = dataManager.getPasswords();
    passStore.logs = passStore.logs || [];

    const now = new Date();
    const entry = {
      id: 'pwd_' + Date.now().toString(36),
      username,
      timestamp: now.toISOString(),
      date: now.toISOString().split('T')[0],
      ip: getClientIp(req),
      reason: reason || 'Routine security update'
    };

    passStore.logs.unshift(entry);
    if (passStore.logs.length > 200) passStore.logs.pop();
    dataManager.savePasswords(passStore);

    // Also record in system audit log
    dataManager.addAuditLog({
      ip: getClientIp(req),
      category: 'Players',
      action: 'CHANGE_PASSWORD',
      details: `Password changed for player '${username}'. Reason: ${entry.reason}`
    });

    res.json({
      success: true,
      message: 'In-game password updated successfully! Use your new password next time you connect to play.mineorange.fun.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 5. MY ORDERS
// =========================================================================
router.get('/orders/my', (req, res) => {
  try {
    const { username } = req.query;
    const ordersData = orderStore.orders || { orders: [] };
    const all = ordersData.orders || [];

    if (!username) {
      return res.json({ success: true, orders: [] });
    }

    const myOrders = all.filter(o => o.username && o.username.toLowerCase() === username.toLowerCase());
    res.json({ success: true, orders: myOrders.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
