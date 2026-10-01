const { Client } = require('ssh2');

class SkinsRestorerService {
  constructor() {
    this.config = {
      host: process.env.SFTP_HOST || 'Node1.mineorange.fun',
      port: parseInt(process.env.SFTP_PORT || '2022', 10),
      username: process.env.SFTP_USERNAME || 'master.3297b18b',
      password: process.env.SFTP_PASSWORD || 'Kartik@1234'
    };
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

        if (type === 'CUSTOM') {
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
          resolve({
            skinName: identifier,
            skinSource: `SkinsRestorer Player (${identifier})`,
            skinUrl: `https://mc-heads.net/body/${encodeURIComponent(identifier)}/right`,
            avatarUrl: `https://mc-heads.net/avatar/${encodeURIComponent(identifier)}/128`
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

  // Standalone fetch creating temporary connection if needed
  async fetchPlayerSkin(playerUuid, minecraftUsername) {
    return new Promise((resolve) => {
      const conn = new Client();
      const timer = setTimeout(() => {
        try { conn.end(); } catch (e) {}
        resolve(null);
      }, 6000);

      conn.on('ready', () => {
        conn.sftp(async (err, sftp) => {
          if (err) {
            clearTimeout(timer);
            try { conn.end(); } catch (e) {}
            return resolve(null);
          }
          const res = await this.resolveSkinWithSftp(sftp, playerUuid, minecraftUsername);
          clearTimeout(timer);
          try { conn.end(); } catch (e) {}
          resolve(res);
        });
      });

      conn.on('error', () => {
        clearTimeout(timer);
        resolve(null);
      });

      try {
        conn.connect(this.config);
      } catch (e) {
        clearTimeout(timer);
        resolve(null);
      }
    });
  }
}

module.exports = new SkinsRestorerService();
