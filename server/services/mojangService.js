const crypto = require('crypto');

// In-memory cache for Mojang profile lookups
const profileCache = new Map();

// Generate offline UUID for Bedrock players
function getBedrockUuid(username) {
  const clean = username.startsWith('.') ? username.substring(1) : username;
  const hash = crypto.createHash('md5').update('OfflinePlayer:' + clean).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-3${hash.substring(13, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

async function resolveMinecraftProfile(username, isBedrock = false) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  const cleanName = username.trim();
  const bedrock = isBedrock || cleanName.startsWith('.');
  const cacheKey = `${bedrock ? 'bedrock:' : 'java:'}${cleanName.toLowerCase()}`;

  if (profileCache.has(cacheKey)) {
    return profileCache.get(cacheKey);
  }

  if (bedrock) {
    const result = {
      valid: true,
      username: cleanName.startsWith('.') ? cleanName : `.${cleanName}`,
      rawName: cleanName.replace(/^\./, ''),
      isBedrock: true,
      uuid: getBedrockUuid(cleanName),
      avatarUrl: `https://mc-heads.net/avatar/${cleanName.replace(/^\./, '')}/128`,
      skinUrl: `https://mc-heads.net/body/${cleanName.replace(/^\./, '')}/right`
    };
    profileCache.set(cacheKey, result);
    return result;
  }

  // Java Edition Profile lookup via Mojang API
  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(cleanName)}`, {
      headers: { 'User-Agent': 'BattlepieNetwork-Backend/1.0' }
    });

    if (res.status === 200) {
      const data = await res.json();
      const formattedUuid = `${data.id.substr(0,8)}-${data.id.substr(8,4)}-${data.id.substr(12,4)}-${data.id.substr(16,4)}-${data.id.substr(20)}`;
      const result = {
        valid: true,
        username: data.name,
        isBedrock: false,
        uuid: formattedUuid,
        undashedUuid: data.id,
        avatarUrl: `https://mc-heads.net/avatar/${data.name}/128`,
        skinUrl: `https://mc-heads.net/body/${data.name}/right`
      };
      profileCache.set(cacheKey, result);
      return result;
    } else if (res.status === 404 || res.status === 204) {
      // Offline mode username fallback
      const fallback = {
        valid: true,
        username: cleanName,
        isBedrock: false,
        uuid: getBedrockUuid(cleanName),
        avatarUrl: `https://mc-heads.net/avatar/${cleanName}/128`,
        skinUrl: `https://mc-heads.net/body/${cleanName}/right`,
        isOfflineMode: true
      };
      profileCache.set(cacheKey, fallback);
      return fallback;
    }
  } catch (err) {
    // Network fallback
    const fallback = {
      valid: true,
      username: cleanName,
      isBedrock: false,
      uuid: getBedrockUuid(cleanName),
      avatarUrl: `https://mc-heads.net/avatar/${cleanName}/128`,
      skinUrl: `https://mc-heads.net/body/${cleanName}/right`,
      isOfflineFallback: true
    };
    return fallback;
  }

  return { valid: true, username: cleanName, avatarUrl: `https://mc-heads.net/avatar/${cleanName}/128` };
}

module.exports = {
  resolveMinecraftProfile
};
