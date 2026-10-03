const { Client } = require('ssh2');

const SKIN_PRESETS = {
  'sr-recommendation-investigator': { id: 'sr-recommendation-investigator', type: 'CUSTOM', hash: 'd860b42fa018921ee17ef4c413970ea42d76258046ebe31592c5cab85600e196', name: 'Gentleman 🎩' },
  'investigator': { id: 'sr-recommendation-investigator', type: 'CUSTOM', hash: 'd860b42fa018921ee17ef4c413970ea42d76258046ebe31592c5cab85600e196', name: 'Gentleman 🎩' },
  'gentleman': { id: 'sr-recommendation-investigator', type: 'CUSTOM', hash: 'd860b42fa018921ee17ef4c413970ea42d76258046ebe31592c5cab85600e196', name: 'Gentleman 🎩' },
  'sr-recommendation-fox': { id: 'sr-recommendation-fox', type: 'CUSTOM', hash: 'c823bceddc2ad07ccbe585ac68a06d8834086869f261d3becb08884633a51f53', name: 'Fox 🦊' },
  'fox': { id: 'sr-recommendation-fox', type: 'CUSTOM', hash: 'c823bceddc2ad07ccbe585ac68a06d8834086869f261d3becb08884633a51f53', name: 'Fox 🦊' },
  'sr-recommendation-kermit': { id: 'sr-recommendation-kermit', type: 'CUSTOM', hash: '1fa056ab42c519750cf7da45d9ea498476a9431f0db252c15e9f8ba130a520f7', name: 'Kermit 🐸' },
  'kermit': { id: 'sr-recommendation-kermit', type: 'CUSTOM', hash: '1fa056ab42c519750cf7da45d9ea498476a9431f0db252c15e9f8ba130a520f7', name: 'Kermit 🐸' },
  'sr-recommendation-boy-black-sweater': { id: 'sr-recommendation-boy-black-sweater', type: 'CUSTOM', hash: '71a7064af618ba6d5fddbde6a5b599dd35d51f34b2567a3a4c5a36e8798d8d12', name: 'Boy Hoodie 👦' },
  'boy-black-sweater': { id: 'sr-recommendation-boy-black-sweater', type: 'CUSTOM', hash: '71a7064af618ba6d5fddbde6a5b599dd35d51f34b2567a3a4c5a36e8798d8d12', name: 'Boy Hoodie 👦' },
  'sr-recommendation-incognito': { id: 'sr-recommendation-incognito', type: 'CUSTOM', hash: 'f05015f45144868f26ac713bab29611ba8f092899ee2a439141f7c8490bdd565', name: 'Incognito 🕶️' },
  'incognito': { id: 'sr-recommendation-incognito', type: 'CUSTOM', hash: 'f05015f45144868f26ac713bab29611ba8f092899ee2a439141f7c8490bdd565', name: 'Incognito 🕶️' },
  'sr-recommendation-green-bird': { id: 'sr-recommendation-green-bird', type: 'CUSTOM', hash: 'cb50beab76e56472637c304a54b330780e278decb017707bf7604e484e4d6c9f', name: 'Green Bird 🐦' },
  'green-bird': { id: 'sr-recommendation-green-bird', type: 'CUSTOM', hash: 'cb50beab76e56472637c304a54b330780e278decb017707bf7604e484e4d6c9f', name: 'Green Bird 🐦' },
  'sr-recommendation-person-black-shirt': { id: 'sr-recommendation-person-black-shirt', type: 'CUSTOM', hash: '1f5eaa74dd1df1912a1e1ab70f32ba008032ae0daa6bfe2b9ff137f9d8671930', name: 'Black Shirt 👕' },
  'person-black-shirt': { id: 'sr-recommendation-person-black-shirt', type: 'CUSTOM', hash: '1f5eaa74dd1df1912a1e1ab70f32ba008032ae0daa6bfe2b9ff137f9d8671930', name: 'Black Shirt 👕' },
  'sr-recommendation-discord-wumpus': { id: 'sr-recommendation-discord-wumpus', type: 'CUSTOM', hash: '6c84d1a9095a63f47546720fe7f6edf03e12276e062b853e207a5c697f1e521', name: 'Discord Wumpus 👾' },
  'discord-wumpus': { id: 'sr-recommendation-discord-wumpus', type: 'CUSTOM', hash: '6c84d1a9095a63f47546720fe7f6edf03e12276e062b853e207a5c697f1e521', name: 'Discord Wumpus 👾' },
  'wumpus': { id: 'sr-recommendation-discord-wumpus', type: 'CUSTOM', hash: '6c84d1a9095a63f47546720fe7f6edf03e12276e062b853e207a5c697f1e521', name: 'Discord Wumpus 👾' },
  'sr-recommendation-smily-face': { id: 'sr-recommendation-smily-face', type: 'CUSTOM', hash: 'ca93f6fc40488f1877cda94a830b54e9f6f54ab58a5453bad5c947726dd1f473', name: 'Smiley Face 😊' },
  'smily-face': { id: 'sr-recommendation-smily-face', type: 'CUSTOM', hash: 'ca93f6fc40488f1877cda94a830b54e9f6f54ab58a5453bad5c947726dd1f473', name: 'Smiley Face 😊' },
  'smiley': { id: 'sr-recommendation-smily-face', type: 'CUSTOM', hash: 'ca93f6fc40488f1877cda94a830b54e9f6f54ab58a5453bad5c947726dd1f473', name: 'Smiley Face 😊' }
};

class SkinsRestorerService {
  constructor() {
    this.config = {
      host: process.env.SFTP_HOST || 'Node1.mineorange.fun',
      port: parseInt(process.env.SFTP_PORT || '2022', 10),
      username: process.env.SFTP_USERNAME || 'master.3297b18b',
      password: process.env.SFTP_PASSWORD || 'Kartik@1234'
    };
    this.skinCache = new Map(); // uuid -> { data, timestamp }
  }

  extractTextureHash(value) {
    if (!value) return null;
    try {
      const decoded = Buffer.from(value, 'base64').toString('utf8');
      const match = decoded.match(/textures\.minecraft\.net\/texture\/([a-zA-Z0-9]+)/);
      if (match) return match[1];
    } catch (e) {}

    const match2 = value.match(/textures\.minecraft\.net\/texture\/([a-zA-Z0-9]+)/);
    if (match2) return match2[1];
    return null;
  }

  getPreset(key) {
    if (!key) return null;
    const lower = key.trim().toLowerCase();
    return SKIN_PRESETS[lower] || null;
  }

  invalidateCache(playerUuid) {
    if (playerUuid) {
      this.skinCache.delete(playerUuid);
    }
  }

  // Resolve skin directly using an existing SFTP session
  resolveSkinWithSftp(sftp, playerUuid, minecraftUsername) {
    return new Promise((resolve) => {
      if (!sftp) return resolve(null);
      const playerFilePath = `plugins/SkinsRestorer/players/${playerUuid}.player`;

      sftp.readFile(playerFilePath, (err, data) => {
        if (err || !data) {
          // Fallback check: check if filename exists by username
          const userFilePath = `plugins/SkinsRestorer/players/${minecraftUsername}.player`;
          sftp.readFile(userFilePath, (err2, data2) => {
            if (err2 || !data2) return resolve(null);
            this.parsePlayerData(sftp, data2).then(resolve);
          });
          return;
        }

        this.parsePlayerData(sftp, data).then(resolve);
      });
    });
  }

  parsePlayerData(sftp, buffer) {
    return new Promise((resolve) => {
      try {
        const json = JSON.parse(buffer.toString('utf8'));
        if (!json || !json.skinIdentifier) return resolve(null);

        const { identifier, type } = json.skinIdentifier;

        // Check if identifier matches a known preset
        const preset = this.getPreset(identifier);

        if (type === 'CUSTOM') {
          if (preset && preset.hash) {
            return resolve({
              skinName: identifier,
              skinSource: `SkinsRestorer Texture (${identifier})`,
              textureHash: preset.hash,
              skinUrl: `https://mc-heads.net/body/${preset.hash}/right`,
              avatarUrl: `https://mc-heads.net/avatar/${preset.hash}/128`
            });
          }

          const skinFilePath = `plugins/SkinsRestorer/skins/${identifier}.customskin`;
          sftp.readFile(skinFilePath, (err, skinData) => {
            if (err || !skinData) {
              return resolve({
                skinName: identifier,
                skinSource: `SkinsRestorer Custom (${identifier})`,
                skinUrl: `https://mc-heads.net/body/${encodeURIComponent(identifier)}/right`,
                avatarUrl: `https://mc-heads.net/avatar/${encodeURIComponent(identifier)}/128`
              });
            }

            try {
              const skinJson = JSON.parse(skinData.toString('utf8'));
              const hash = this.extractTextureHash(skinJson.value);
              if (hash) {
                return resolve({
                  skinName: identifier,
                  skinSource: `SkinsRestorer Texture (${identifier})`,
                  textureHash: hash,
                  skinUrl: `https://mc-heads.net/body/${hash}/right`,
                  avatarUrl: `https://mc-heads.net/avatar/${hash}/128`
                });
              }
            } catch (e) {}

            resolve({
              skinName: identifier,
              skinSource: `SkinsRestorer Custom (${identifier})`,
              skinUrl: `https://mc-heads.net/body/${encodeURIComponent(identifier)}/right`,
              avatarUrl: `https://mc-heads.net/avatar/${encodeURIComponent(identifier)}/128`
            });
          });
        } else if (type === 'PLAYER') {
          // SkinsRestorer v15 stores player skins under plugins/SkinsRestorer/skins/${identifier}.playerskin
          const playerSkinPath = `plugins/SkinsRestorer/skins/${identifier}.playerskin`;
          sftp.readFile(playerSkinPath, (err, pData) => {
            if (!err && pData) {
              try {
                const pJson = JSON.parse(pData.toString('utf8'));
                const hash = this.extractTextureHash(pJson.value);
                const playerName = pJson.lastKnownName || identifier;
                if (hash) {
                  return resolve({
                    skinName: playerName,
                    skinSource: `SkinsRestorer Player (${playerName})`,
                    textureHash: hash,
                    skinUrl: `https://mc-heads.net/body/${hash}/right`,
                    avatarUrl: `https://mc-heads.net/avatar/${hash}/128`
                  });
                }
              } catch (e) {}
            }

            // Fallback for player skin
            resolve({
              skinName: identifier,
              skinSource: `SkinsRestorer Player (${identifier})`,
              skinUrl: `https://mc-heads.net/body/${encodeURIComponent(identifier)}/right`,
              avatarUrl: `https://mc-heads.net/avatar/${encodeURIComponent(identifier)}/128`
            });
          });
        } else if (type === 'URL') {
          const hash = this.extractTextureHash(identifier);
          if (hash) {
            resolve({
              skinName: 'Custom URL',
              skinSource: 'SkinsRestorer URL',
              textureHash: hash,
              skinUrl: `https://mc-heads.net/body/${hash}/right`,
              avatarUrl: `https://mc-heads.net/avatar/${hash}/128`
            });
          } else {
            resolve({
              skinName: 'Custom URL',
              skinSource: 'SkinsRestorer URL',
              skinUrl: identifier,
              avatarUrl: identifier
            });
          }
        } else {
          resolve(null);
        }
      } catch (e) {
        resolve(null);
      }
    });
  }

  // Standalone fetch creating temporary connection if needed (with 1s cache, reusing long-lived SFTP session when available)
  async fetchPlayerSkin(playerUuid, minecraftUsername) {
    if (!playerUuid) return null;

    const cached = this.skinCache.get(playerUuid);
    if (cached && Date.now() - cached.timestamp < 1000) {
      return cached.data;
    }

    try {
      const minecraftLogBridge = require('./minecraftLogBridge');
      if (minecraftLogBridge && minecraftLogBridge.sftp) {
        const res = await this.resolveSkinWithSftp(minecraftLogBridge.sftp, playerUuid, minecraftUsername);
        if (res) {
          this.skinCache.set(playerUuid, { data: res, timestamp: Date.now() });
        }
        return res || (cached ? cached.data : null);
      }
    } catch (e) {}

    return new Promise((resolve) => {
      const conn = new Client();
      const timer = setTimeout(() => {
        try { conn.end(); } catch (e) {}
        resolve(cached ? cached.data : null);
      }, 5000);

      conn.on('ready', () => {
        conn.sftp(async (err, sftp) => {
          if (err) {
            clearTimeout(timer);
            try { conn.end(); } catch (e) {}
            return resolve(cached ? cached.data : null);
          }
          const res = await this.resolveSkinWithSftp(sftp, playerUuid, minecraftUsername);
          clearTimeout(timer);
          try { conn.end(); } catch (e) {}
          if (res) {
            this.skinCache.set(playerUuid, { data: res, timestamp: Date.now() });
          }
          resolve(res);
        });
      });

      conn.on('error', () => {
        clearTimeout(timer);
        resolve(cached ? cached.data : null);
      });

      try {
        conn.connect(this.config);
      } catch (e) {
        clearTimeout(timer);
        resolve(cached ? cached.data : null);
      }
    });
  }

  // Resolve skin preset or Minecraft username to proper identifiers and textures
  async resolveSkinPresetOrUser(skinInput) {
    if (!skinInput) return null;
    const clean = skinInput.trim();

    // 1. Is it a preset?
    const preset = this.getPreset(clean);
    if (preset) {
      return {
        identifier: preset.id,
        type: 'CUSTOM',
        skinName: preset.name,
        textureHash: preset.hash,
        skinUrl: `https://mc-heads.net/body/${preset.hash}/right`,
        avatarUrl: `https://mc-heads.net/avatar/${preset.hash}/128`
      };
    }

    // 2. Is it already a dashed Mojang UUID?
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    if (isUuid) {
      return {
        identifier: clean,
        type: 'PLAYER',
        skinName: clean,
        skinUrl: `https://mc-heads.net/body/${clean}/right`,
        avatarUrl: `https://mc-heads.net/avatar/${clean}/128`
      };
    }

    // 3. It's a player username: resolve official Mojang UUID and textures
    try {
      const profileRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(clean)}`);
      if (profileRes.ok) {
        const pData = await profileRes.json();
        if (pData && pData.id) {
          const rawId = pData.id;
          const dashedUuid = rawId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
          const officialName = pData.name || clean;

          // Attempt to fetch textures
          let textureHash = null;
          try {
            const sessRes = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${rawId}`);
            if (sessRes.ok) {
              const sessData = await sessRes.json();
              if (sessData.properties && sessData.properties[0]) {
                textureHash = this.extractTextureHash(sessData.properties[0].value);
              }
            }
          } catch (e) {}

          const skinUrl = textureHash
            ? `https://mc-heads.net/body/${textureHash}/right`
            : `https://mc-heads.net/body/${dashedUuid}/right`;
          const avatarUrl = textureHash
            ? `https://mc-heads.net/avatar/${textureHash}/128`
            : `https://mc-heads.net/avatar/${dashedUuid}/128`;

          return {
            identifier: dashedUuid,
            type: 'PLAYER',
            skinName: officialName,
            textureHash,
            skinUrl,
            avatarUrl
          };
        }
      }
    } catch (e) {}

    // Fallback: use clean name
    return {
      identifier: clean,
      type: 'PLAYER',
      skinName: clean,
      skinUrl: `https://mc-heads.net/body/${encodeURIComponent(clean)}/right`,
      avatarUrl: `https://mc-heads.net/avatar/${encodeURIComponent(clean)}/128`
    };
  }

  // Set skin directly into SkinsRestorer player file via SFTP
  async setPlayerSkinFile(playerUuid, skinIdentifier, type = 'PLAYER') {
    return new Promise((resolve) => {
      this.invalidateCache(playerUuid);
      const conn = new Client();
      const timer = setTimeout(() => {
        try { conn.end(); } catch (e) {}
        resolve(false);
      }, 7000);

      conn.on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) {
            clearTimeout(timer);
            try { conn.end(); } catch (e) {}
            return resolve(false);
          }
          const playerFilePath = `plugins/SkinsRestorer/players/${playerUuid}.player`;
          const payload = JSON.stringify({
            uniqueId: playerUuid,
            skinIdentifier: {
              identifier: skinIdentifier,
              type: type
            },
            offlineModeWarningDismissed: false,
            history: [
              {
                timestamp: Math.floor(Date.now() / 1000),
                skinIdentifier: {
                  identifier: skinIdentifier,
                  type: type
                }
              }
            ],
            dataVersion: 2
          }, null, 2);

          sftp.writeFile(playerFilePath, Buffer.from(payload, 'utf8'), (wErr) => {
            clearTimeout(timer);
            try { conn.end(); } catch (e) {}
            if (wErr) {
              console.warn('[SkinsRestorer] Failed to write player file:', wErr.message);
              return resolve(false);
            }
            console.log(`[SkinsRestorer] Successfully wrote skin '${skinIdentifier}' (${type}) for UUID ${playerUuid}`);
            resolve(true);
          });
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timer);
        console.warn('[SkinsRestorer SFTP error]', err.message);
        resolve(false);
      });

      try {
        conn.connect(this.config);
      } catch (e) {
        clearTimeout(timer);
        resolve(false);
      }
    });
  }

  // Delete skin from SkinsRestorer player file (reset to default)
  async deletePlayerSkinFile(playerUuid) {
    this.invalidateCache(playerUuid);
    return new Promise((resolve) => {
      const conn = new Client();
      const timer = setTimeout(() => {
        try { conn.end(); } catch (e) {}
        resolve(false);
      }, 7000);

      conn.on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) {
            clearTimeout(timer);
            try { conn.end(); } catch (e) {}
            return resolve(false);
          }
          const playerFilePath = `plugins/SkinsRestorer/players/${playerUuid}.player`;
          sftp.unlink(playerFilePath, (uErr) => {
            clearTimeout(timer);
            try { conn.end(); } catch (e) {}
            resolve(!uErr);
          });
        });
      });

      conn.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });

      try {
        conn.connect(this.config);
      } catch (e) {
        clearTimeout(timer);
        resolve(false);
      }
    });
  }
}

module.exports = new SkinsRestorerService();
