const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { resolveMinecraftProfile } = require('./mojangService');

const LINKS_FILE = path.join(config.paths.dataDir, 'linked_players.json');
const CODES_FILE = path.join(config.paths.dataDir, 'active_codes.json');

// Ensure data directory exists
if (!fs.existsSync(config.paths.dataDir)) {
  fs.mkdirSync(config.paths.dataDir, { recursive: true });
}

// In-memory cache of linked players
let linkedPlayers = new Map(); // discordId -> linkData
let mcToDiscord = new Map();   // lowercase mc username -> discordId

// Active ephemeral link codes: code -> { code, discordId, discordUser, expiresAt }
const activeCodes = new Map();
const userCodes = new Map(); // discordId -> code

// Active SSE subscribers: discordId -> Set of res objects
const sseClients = new Map();

// Sync to external Firebase Realtime Database if configured
async function syncToFirebase(record) {
  const firebaseUrl = process.env.FIREBASE_DATABASE_URL || (config && config.firebaseDatabaseUrl);
  if (!firebaseUrl || !record || !record.discordId) return;
  try {
    const cleanUrl = firebaseUrl.replace(/\/$/, '');
    await fetch(`${cleanUrl}/linked_players/${record.discordId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    console.log(`[Firebase] Synced player ${record.minecraftUsername} to Firebase RTDB.`);
  } catch (err) {
    console.warn('[Firebase Sync Error]', err.message);
  }
}

// Fetch all from Firebase Realtime Database
async function fetchFromFirebase() {
  const firebaseUrl = process.env.FIREBASE_DATABASE_URL || (config && config.firebaseDatabaseUrl);
  if (!firebaseUrl) return false;
  try {
    const cleanUrl = firebaseUrl.replace(/\/$/, '');
    const res = await fetch(`${cleanUrl}/linked_players.json?t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        let count = 0;
        for (const [id, item] of Object.entries(data)) {
          if (item && item.minecraftUsername) {
            linkedPlayers.set(id, item);
            mcToDiscord.set(item.minecraftUsername.toLowerCase(), id);
            count++;
          }
        }
        if (count > 0) {
          saveLinks();
          console.log(`[Firebase] Successfully loaded ${count} linked players from Firebase RTDB.`);
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('[Firebase Fetch Error]', err.message);
  }
  return false;
}

// Fetch single player from Firebase Realtime Database
async function fetchPlayerFromFirebase(discordId) {
  const firebaseUrl = process.env.FIREBASE_DATABASE_URL || (config && config.firebaseDatabaseUrl);
  if (!firebaseUrl || !discordId) return null;
  try {
    const cleanUrl = firebaseUrl.replace(/\/$/, '');
    const res = await fetch(`${cleanUrl}/linked_players/${discordId}.json?t=${Date.now()}`);
    if (res.ok) {
      const item = await res.json();
      if (item && item.minecraftUsername) {
        linkedPlayers.set(discordId, item);
        mcToDiscord.set(item.minecraftUsername.toLowerCase(), discordId);
        saveLinks();
        return item;
      }
    }
  } catch (err) {
    console.warn('[Firebase Single Fetch Error]', err.message);
  }
  return null;
}

// Load links from disk (and Firebase fallback)
function loadLinks() {
  try {
    if (fs.existsSync(LINKS_FILE)) {
      const raw = fs.readFileSync(LINKS_FILE, 'utf8');
      const list = JSON.parse(raw);
      linkedPlayers.clear();
      mcToDiscord.clear();
      for (const item of list) {
        linkedPlayers.set(item.discordId, item);
        mcToDiscord.set(item.minecraftUsername.toLowerCase(), item.discordId);
      }
    }
  } catch (err) {
    console.error('[PlayerLinkService] Error loading links file:', err.message);
  }

  // If memory is empty and Firebase is configured, fetch from Firebase
  if (linkedPlayers.size === 0 && (process.env.FIREBASE_DATABASE_URL || (config && config.firebaseDatabaseUrl))) {
    fetchFromFirebase().catch(() => {});
  }
}

// Save links to disk
function saveLinks() {
  try {
    const list = Array.from(linkedPlayers.values());
    fs.writeFileSync(LINKS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('[PlayerLinkService] Error saving links file:', err.message);
  }
}

// Load active codes from disk
function loadCodes() {
  try {
    if (fs.existsSync(CODES_FILE)) {
      const raw = fs.readFileSync(CODES_FILE, 'utf8');
      const list = JSON.parse(raw);
      activeCodes.clear();
      userCodes.clear();
      for (const item of list) {
        if (!item.expiresAt || item.expiresAt > Date.now()) {
          activeCodes.set(item.code, item);
          if (item.discordId) {
            userCodes.set(item.discordId, item.code);
          }
        }
      }
    }
  } catch (err) {
    console.error('[PlayerLinkService] Error loading codes file:', err.message);
  }
}

// Save active codes to disk
function saveCodes() {
  try {
    const list = Array.from(activeCodes.values());
    fs.writeFileSync(CODES_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('[PlayerLinkService] Error saving codes file:', err.message);
  }
}

loadLinks();
loadCodes();

// Generate an 8-digit unique code
function generate8DigitCode() {
  let code = '';
  do {
    code = Math.floor(10000000 + Math.random() * 90000000).toString();
  } while (activeCodes.has(code));
  return code;
}

// Offline UUID Generator (RFC 4122 v3 MD5 matching Minecraft Server)
function generateOfflineUuid(username) {
  const clean = username.startsWith('.') ? username.substring(1) : username;
  const md5Bytes = crypto.createHash('md5').update('OfflinePlayer:' + clean, 'utf8').digest();
  
  // Set version to 3 (name-based MD5)
  md5Bytes[6] = (md5Bytes[6] & 0x0f) | 0x30;
  // Set variant to IETF (RFC 4122)
  md5Bytes[8] = (md5Bytes[8] & 0x3f) | 0x80;

  const hex = md5Bytes.toString('hex');
  return `${hex.substr(0, 8)}-${hex.substr(8, 4)}-${hex.substr(12, 4)}-${hex.substr(16, 4)}-${hex.substr(20)}`;
}

// Generate a cryptographically signed permanent Link Token (HMAC-SHA256)
function generateLinkToken(record) {
  if (!record || !record.discordId || !record.minecraftUsername) return null;
  const secret = (config.serverSecret || 'battlepie_secret_token_123') + '_v2_clean';
  const payload = {
    discordId: record.discordId,
    discordUsername: record.discordUsername,
    minecraftUsername: record.minecraftUsername,
    minecraftUuid: record.minecraftUuid || '',
    accountType: record.accountType || 'Java Cracked',
    isBedrock: Boolean(record.isBedrock),
    skinName: record.skinName || null,
    avatarUrl: record.avatarUrl || '',
    skinUrl: record.skinUrl || '',
    linkedAt: record.linkedAt || new Date().toISOString()
  };
  const serialized = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', secret).update(serialized).digest('hex');
  const tokenObj = { p: payload, s: sig };
  return Buffer.from(JSON.stringify(tokenObj)).toString('base64url');
}

// Verify and decode a permanent Link Token
function verifyLinkToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const tokenObj = JSON.parse(decoded);
    if (!tokenObj || !tokenObj.p || !tokenObj.s) return null;
    const secret = (config.serverSecret || 'battlepie_secret_token_123') + '_v2_clean';
    const serialized = JSON.stringify(tokenObj.p);
    const expectedSig = crypto.createHmac('sha256', secret).update(serialized).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(tokenObj.s), Buffer.from(expectedSig))) {
      return tokenObj.p;
    }
  } catch (e) {}
  return null;
}

class PlayerLinkService {
  // Create or refresh an ephemeral 8-digit link code for a Discord user
  static createLinkCode(discordUser, forceNew = false, customCode = null) {
    // UI countdown duration: 120 seconds (2 minutes)
    const UI_TTL_SECONDS = 120;
    // Backend validity: 10 minutes (600 seconds) grace period so in-game typing never fails
    const BACKEND_TTL_SECONDS = 600;

    loadCodes();

    // Check if user already has an existing valid code and we are not forcing a new one
    const existingCode = userCodes.get(discordUser.id);
    if (existingCode && !forceNew && !customCode) {
      const existing = activeCodes.get(existingCode);
      if (existing && existing.uiExpiresAt > Date.now()) {
        const raw = Math.floor((existing.uiExpiresAt - Date.now()) / 1000);
        existing.expiresInSeconds = Math.max(0, Math.min(UI_TTL_SECONDS, raw));
        return existing;
      }
    }

    // Do NOT delete previous codes immediately — keep them valid for their 10 min window!
    const code = customCode || generate8DigitCode();
    const entry = {
      code,
      discordId: discordUser.id,
      discordUser: {
        id: discordUser.id,
        username: discordUser.username,
        global_name: discordUser.global_name || discordUser.username,
        avatarUrl: discordUser.avatarUrl || '/uploads/kartik_avatar.png'
      },
      uiExpiresAt: Date.now() + UI_TTL_SECONDS * 1000,
      expiresAt: Date.now() + BACKEND_TTL_SECONDS * 1000,
      expiresInSeconds: UI_TTL_SECONDS
    };

    activeCodes.set(code, entry);
    userCodes.set(discordUser.id, code);

    // Garbage collect genuinely expired codes (> 10 mins)
    const now = Date.now();
    for (const [c, item] of activeCodes.entries()) {
      if (item.expiresAt <= now) {
        activeCodes.delete(c);
      }
    }

    saveCodes();
    return entry;
  }

  // Get active code for Discord user
  static getActiveCode(discordId) {
    loadCodes();
    const code = userCodes.get(discordId);
    let entry = code ? activeCodes.get(code) : null;
    if (!entry) {
      // If there's an active code in activeCodes for this user, find it
      for (const item of activeCodes.values()) {
        if (item.discordId === discordId && (!item.expiresAt || item.expiresAt > Date.now())) {
          entry = item;
          userCodes.set(discordId, item.code);
          break;
        }
      }
    }
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      activeCodes.delete(entry.code);
      userCodes.delete(discordId);
      saveCodes();
      return null;
    }
    const rawLeft = entry.uiExpiresAt ? Math.floor((entry.uiExpiresAt - Date.now()) / 1000) : 120;
    entry.expiresInSeconds = Math.max(0, Math.min(120, rawLeft > 0 ? rawLeft : 120));
    return entry;
  }

  // Verify and link an in-game Minecraft player with a code
  static async verifyAndLink({ code, minecraftUsername, isBedrock = false, serverUuid = null, skinName = null }) {
    if (!code) {
      return { success: false, error: 'Link code is required' };
    }
    if (!minecraftUsername || typeof minecraftUsername !== 'string') {
      return { success: false, error: 'Minecraft username is required' };
    }

    const cleanUsername = minecraftUsername.trim();
    const cleanCode = code.toString().replace(/[\s\-\<\>]/g, '').trim();

    loadCodes();
    let codeEntry = activeCodes.get(cleanCode);

    // Fallback 1: Check case or scan through activeCodes values
    if (!codeEntry) {
      for (const item of activeCodes.values()) {
        if (item.code === cleanCode) {
          codeEntry = item;
          break;
        }
      }
    }

    if (!codeEntry) {
      return { success: false, error: 'Invalid link code. Please check the code on https://mineorange.fun/me' };
    }

    if (codeEntry.expiresAt && codeEntry.expiresAt <= Date.now()) {
      activeCodes.delete(cleanCode);
      saveCodes();
      return { success: false, error: 'Code has expired. Please click "Generate new code" on the website.' };
    }

    // Determine Player Type (Bedrock PE, Java Premium, or Java Cracked)
    const isBedrockPlayer = isBedrock || cleanUsername.startsWith('.') || cleanUsername.startsWith('*');
    let accountType = 'Java Cracked';
    let playerUuid = serverUuid;
    let avatarUrl = '';
    let skinUrl = '';

    if (isBedrockPlayer) {
      accountType = 'Bedrock PE (Geyser/Floodgate)';
      const rawBedrockName = cleanUsername.replace(/^[\.\*]/, '');
      playerUuid = playerUuid || generateOfflineUuid(cleanUsername);
      avatarUrl = `https://mc-heads.net/avatar/${rawBedrockName}/128`;
      skinUrl = `https://mc-heads.net/body/${rawBedrockName}/right`;
    } else {
      // Check Java Edition via Mojang API
      try {
        const mojang = await resolveMinecraftProfile(cleanUsername, false);
        if (mojang && mojang.valid && !mojang.isOfflineMode && !mojang.isOfflineFallback) {
          accountType = 'Java Premium';
          playerUuid = mojang.uuid;
          avatarUrl = mojang.avatarUrl;
          skinUrl = mojang.skinUrl;
        } else {
          accountType = 'Java Cracked (Offline Mode)';
          playerUuid = playerUuid || generateOfflineUuid(cleanUsername);
          avatarUrl = `https://mc-heads.net/avatar/${cleanUsername}/128`;
          skinUrl = `https://mc-heads.net/body/${cleanUsername}/right`;
        }
      } catch (e) {
        accountType = 'Java Cracked';
        playerUuid = playerUuid || generateOfflineUuid(cleanUsername);
        avatarUrl = `https://mc-heads.net/avatar/${cleanUsername}/128`;
        skinUrl = `https://mc-heads.net/body/${cleanUsername}/right`;
      }
    }

    // If custom skin is supplied via SkinsRestorer (e.g. cracked player used /skin <name>)
    let skinSource = 'Default / Mojang';
    if (skinName && typeof skinName === 'string' && skinName.trim() && skinName.trim() !== 'null') {
      const cleanSkin = skinName.trim();
      avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(cleanSkin)}/128`;
      skinUrl = `https://mc-heads.net/body/${encodeURIComponent(cleanSkin)}/right`;
      skinSource = `SkinsRestorer (${cleanSkin})`;
    }

    const linkRecord = {
      discordId: codeEntry.discordId,
      discordUsername: codeEntry.discordUser.username,
      discordGlobalName: codeEntry.discordUser.global_name,
      minecraftUsername: cleanUsername,
      minecraftUuid: playerUuid,
      accountType: accountType,
      isBedrock: isBedrockPlayer,
      isCracked: accountType.includes('Cracked'),
      isPremium: accountType === 'Java Premium',
      skinName: skinName && skinName !== 'null' ? skinName.trim() : null,
      skinSource,
      avatarUrl,
      skinUrl,
      linkedAt: new Date().toISOString()
    };

    linkRecord.linkToken = generateLinkToken(linkRecord);

    // Store link
    linkedPlayers.set(codeEntry.discordId, linkRecord);
    mcToDiscord.set(cleanUsername.toLowerCase(), codeEntry.discordId);
    saveLinks();
    syncToFirebase(linkRecord);

    // Invalidate all active codes for this user upon successful link
    for (const [c, item] of activeCodes.entries()) {
      if (item.discordId === codeEntry.discordId) {
        activeCodes.delete(c);
      }
    }
    userCodes.delete(codeEntry.discordId);
    saveCodes();

    // Notify connected SSE browser clients for this user
    PlayerLinkService.notifySse(codeEntry.discordId, {
      event: 'linked',
      player: linkRecord
    });

    console.log(`[PlayerLinkService] Successfully linked ${cleanUsername} (${accountType}) to Discord @${codeEntry.discordUser.username}`);

    return {
      success: true,
      player: linkRecord,
      message: `Successfully linked ${cleanUsername} to Discord @${codeEntry.discordUser.username}`
    };
  }

  // Generate a cryptographically signed permanent Link Token
  static generateLinkToken(record) {
    return generateLinkToken(record);
  }

  // Verify and decode a permanent Link Token
  static verifyLinkToken(token) {
    return verifyLinkToken(token);
  }

  // Sync player to Firebase Realtime Database
  static syncToFirebase(record) {
    return syncToFirebase(record);
  }

  // Fetch all from Firebase Realtime Database
  static fetchFromFirebase() {
    return fetchFromFirebase();
  }

  // Get link status for a Discord user (with token & cache resilience)
  static getLinkStatus(discordId, discordUsername = null, linkToken = null, cachedPlayer = null) {
    if (!discordId && !discordUsername && !linkToken && !cachedPlayer) return null;
    loadLinks();

    // 1. Direct memory/file lookup by Discord ID
    if (discordId && linkedPlayers.has(discordId)) {
      const rec = linkedPlayers.get(discordId);
      if (!rec.linkToken) rec.linkToken = generateLinkToken(rec);
      return rec;
    }

    // 2. Fallback username lookup
    const lowerUsername = (discordUsername || '').toLowerCase();
    for (const item of linkedPlayers.values()) {
      if (discordId && item.discordId === discordId) {
        if (!item.linkToken) item.linkToken = generateLinkToken(item);
        return item;
      }
      if (lowerUsername && item.discordUsername && item.discordUsername.toLowerCase() === lowerUsername) {
        if (!item.linkToken) item.linkToken = generateLinkToken(item);
        return item;
      }
    }

    // 3. Cryptographic Token Rehydration (Vercel Serverless & Server reboot resilience)
    const tokenToVerify = linkToken || (cachedPlayer && cachedPlayer.linkToken);
    if (tokenToVerify) {
      const verified = verifyLinkToken(tokenToVerify);
      if (verified && (verified.discordId === discordId || (lowerUsername && verified.discordUsername && verified.discordUsername.toLowerCase() === lowerUsername))) {
        const restored = {
          discordId: verified.discordId,
          discordUsername: verified.discordUsername,
          discordGlobalName: (cachedPlayer && cachedPlayer.discordGlobalName) || verified.discordUsername,
          minecraftUsername: verified.minecraftUsername,
          minecraftUuid: verified.minecraftUuid,
          accountType: verified.accountType || 'Java Cracked',
          isBedrock: Boolean(verified.isBedrock),
          isCracked: Boolean(verified.accountType && verified.accountType.includes('Cracked')),
          isPremium: Boolean(verified.accountType && verified.accountType.includes('Premium')),
          skinName: verified.skinName || (cachedPlayer && cachedPlayer.skinName) || null,
          skinSource: (cachedPlayer && cachedPlayer.skinSource) || 'SkinsRestorer / Mojang',
          avatarUrl: verified.avatarUrl || (cachedPlayer && cachedPlayer.avatarUrl) || `https://mc-heads.net/avatar/${verified.minecraftUsername}/128`,
          skinUrl: verified.skinUrl || (cachedPlayer && cachedPlayer.skinUrl) || `https://mc-heads.net/body/${verified.minecraftUsername}/right`,
          linkedAt: verified.linkedAt || new Date().toISOString(),
          lastSkinUpdate: new Date().toISOString(),
          linkToken: tokenToVerify
        };
        linkedPlayers.set(restored.discordId, restored);
        mcToDiscord.set(restored.minecraftUsername.toLowerCase(), restored.discordId);
        saveLinks();
        syncToFirebase(restored);
        console.log(`[PlayerLinkService] Re-hydrated linked player ${restored.minecraftUsername} from verified Link Token!`);
        return restored;
      }
    }

    return null;
  }

  // Get link by Minecraft username
  static getLinkByUsername(username) {
    if (!username) return null;
    loadLinks();
    const discordId = mcToDiscord.get(username.toLowerCase());
    if (discordId) {
      return linkedPlayers.get(discordId) || null;
    }
    for (const item of linkedPlayers.values()) {
      if (item.minecraftUsername && item.minecraftUsername.toLowerCase() === username.toLowerCase()) {
        return item;
      }
    }
    return null;
  }

  // Get all linked players
  static getAllLinks() {
    loadLinks();
    return Array.from(linkedPlayers.values());
  }

  // Direct static access to fetch single player from Firebase
  static async fetchPlayerFromFirebase(discordId) {
    return await fetchPlayerFromFirebase(discordId);
  }

  // Direct static access to fetch all players from Firebase
  static async fetchAllFromFirebase() {
    return await fetchFromFirebase();
  }

  // Ensure data is loaded from Firebase if empty (async helper for serverless/cold starts)
  static async ensureLoaded() {
    loadLinks();
    if (linkedPlayers.size === 0) {
      await fetchFromFirebase();
    }
  }

  // Async getLinkStatus ensuring Firebase sync
  static async getLinkStatusAsync(discordId, discordUsername, linkToken, cachedPlayer) {
    if (discordId) {
      await fetchPlayerFromFirebase(discordId);
    } else {
      await PlayerLinkService.ensureLoaded();
    }
    let link = PlayerLinkService.getLinkStatus(discordId, discordUsername, linkToken, cachedPlayer);
    return link;
  }

  // Update skin for all linked records that share a Minecraft username
  static updatePlayerSkinByUsername(minecraftUsername, { skinUrl, avatarUrl, skinName, skinSource, textureHash, skinModel }) {
    if (!minecraftUsername) return false;
    loadLinks();
    let anyChanged = false;
    const lowerName = minecraftUsername.toLowerCase();

    for (const [id, link] of linkedPlayers.entries()) {
      if (link && link.minecraftUsername && link.minecraftUsername.toLowerCase() === lowerName) {
        let changed = false;
        if (skinUrl && link.skinUrl !== skinUrl) {
          link.skinUrl = skinUrl;
          changed = true;
        }
        if (avatarUrl && link.avatarUrl !== avatarUrl) {
          link.avatarUrl = avatarUrl;
          changed = true;
        }
        if (skinName !== undefined && link.skinName !== skinName) {
          link.skinName = skinName;
          changed = true;
        }
        if (skinSource !== undefined && link.skinSource !== skinSource) {
          link.skinSource = skinSource;
          changed = true;
        }
        if (textureHash !== undefined && link.textureHash !== textureHash) {
          link.textureHash = textureHash;
          changed = true;
        }
        if (skinModel !== undefined && link.skinModel !== skinModel) {
          link.skinModel = skinModel;
          changed = true;
        }

        if (changed) {
          anyChanged = true;
          link.lastSkinUpdate = new Date().toISOString();
          link.linkToken = generateLinkToken(link);
          linkedPlayers.set(id, link);
          syncToFirebase(link);

          PlayerLinkService.notifySse(id, {
            event: 'skin_updated',
            player: link
          });
          console.log(`[PlayerLinkService] Dynamic skin updated for @${link.discordUsername} (${link.minecraftUsername}): ${skinUrl} (Synced to Firebase)`);
        }
      }
    }

    if (anyChanged) {
      saveLinks();
    }
    return anyChanged;
  }

  // Update skin for a player dynamically
  static updatePlayerSkin(discordId, { skinUrl, avatarUrl, skinName, skinSource, textureHash, skinModel }) {
    loadLinks();
    const link = linkedPlayers.get(discordId);
    if (!link) return false;

    // Keep all linked accounts with the same Minecraft username in sync
    if (link.minecraftUsername) {
      return PlayerLinkService.updatePlayerSkinByUsername(link.minecraftUsername, { skinUrl, avatarUrl, skinName, skinSource, textureHash, skinModel });
    }

    let changed = false;
    if (skinUrl && link.skinUrl !== skinUrl) {
      link.skinUrl = skinUrl;
      changed = true;
    }
    if (avatarUrl && link.avatarUrl !== avatarUrl) {
      link.avatarUrl = avatarUrl;
      changed = true;
    }
    if (skinName !== undefined && link.skinName !== skinName) {
      link.skinName = skinName;
      changed = true;
    }
    if (skinSource !== undefined && link.skinSource !== skinSource) {
      link.skinSource = skinSource;
      changed = true;
    }
    if (textureHash !== undefined && link.textureHash !== textureHash) {
      link.textureHash = textureHash;
      changed = true;
    }
    if (skinModel !== undefined && link.skinModel !== skinModel) {
      link.skinModel = skinModel;
      changed = true;
    }

    if (changed) {
      link.lastSkinUpdate = new Date().toISOString();
      link.linkToken = generateLinkToken(link);
      linkedPlayers.set(discordId, link);
      saveLinks();
      syncToFirebase(link);

      // Emit live SSE update to the web browser
      PlayerLinkService.notifySse(discordId, {
        event: 'skin_updated',
        player: link
      });
      console.log(`[PlayerLinkService] Dynamic skin updated for ${link.minecraftUsername}: ${skinUrl} (Synced to Firebase)`);
    }
    return changed;
  }

  // Unlink an account
  static async unlink(discordId) {
    let unlinkedUsername = null;
    const existing = linkedPlayers.get(discordId);
    if (existing) {
      unlinkedUsername = existing.minecraftUsername;
      linkedPlayers.delete(discordId);
      mcToDiscord.delete(existing.minecraftUsername.toLowerCase());
      saveLinks();
      PlayerLinkService.notifySse(discordId, { event: 'unlinked' });
    } else {
      for (const [id, item] of linkedPlayers.entries()) {
        if (item.discordId === discordId || (item.discordUsername && item.discordUsername.toLowerCase() === (discordId || '').toLowerCase())) {
          linkedPlayers.delete(id);
          mcToDiscord.delete(item.minecraftUsername.toLowerCase());
          saveLinks();
          PlayerLinkService.notifySse(id, { event: 'unlinked' });
          break;
        }
      }
    }

    // Delete from Firebase RTDB
    const firebaseUrl = process.env.FIREBASE_DATABASE_URL || (config && config.firebaseDatabaseUrl);
    if (firebaseUrl) {
      try {
        const cleanUrl = firebaseUrl.replace(/\/$/, '');
        await fetch(`${cleanUrl}/linked_players/${discordId}.json`, { method: 'DELETE' });
      } catch (err) {}
    }
    return true;
  }

  // Clear all links across memory, disk, and Firebase (for full testing reset)
  static async clearAll() {
    linkedPlayers.clear();
    mcToDiscord.clear();
    activeCodes.clear();
    userCodes.clear();
    saveLinks();
    saveCodes();

    const firebaseUrl = process.env.FIREBASE_DATABASE_URL || (config && config.firebaseDatabaseUrl);
    if (firebaseUrl) {
      try {
        const cleanUrl = firebaseUrl.replace(/\/$/, '');
        await fetch(`${cleanUrl}/linked_players.json`, { method: 'DELETE' });
      } catch (err) {}
    }
    return true;
  }

  // Register SSE client
  static addSseClient(discordId, res) {
    if (!sseClients.has(discordId)) {
      sseClients.set(discordId, new Set());
    }
    sseClients.get(discordId).add(res);

    res.on('close', () => {
      const set = sseClients.get(discordId);
      if (set) {
        set.delete(res);
        if (set.size === 0) sseClients.delete(discordId);
      }
    });
  }

  // Save links explicitly
  static save() {
    saveLinks();
  }

  // Notify SSE clients
  static notifySse(discordId, payload) {
    const clients = sseClients.get(discordId);
    if (!clients) return;
    const msg = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of clients) {
      try {
        res.write(msg);
      } catch (err) {}
    }
  }
}

module.exports = PlayerLinkService;
