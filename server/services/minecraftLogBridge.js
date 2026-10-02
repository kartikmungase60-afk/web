const { Client } = require('ssh2');
const PlayerLinkService = require('./playerLinkService');
const SkinsRestorerService = require('./skinsRestorerService');

class MinecraftLogBridge {
  constructor() {
    this.conn = null;
    this.sftp = null;
    this.running = false;
    this.pollInterval = 2000; // 2 seconds
    this.timer = null;
    this.skinSyncTimer = null;
    this.processedCommands = new Set();
    this.isChecking = false;
    this.lastSkinSyncTime = 0;
    
    this.config = {
      host: process.env.SFTP_HOST || 'Node1.mineorange.fun',
      port: parseInt(process.env.SFTP_PORT || '2022', 10),
      username: process.env.SFTP_USERNAME || 'master.3297b18b',
      password: process.env.SFTP_PASSWORD || 'Kartik@1234',
      readyTimeout: 10000,
      keepaliveInterval: 10000
    };
    this.reconnectTimer = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log('[MinecraftLogBridge] Starting automated in-game /link & dynamic /skin bridge via SFTP...');
    this.connect();
    this.startPeriodicSkinSync();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.skinSyncTimer) clearInterval(this.skinSyncTimer);
    this.sftp = null;
    if (this.conn) {
      try { this.conn.destroy(); } catch (e) {}
      this.conn = null;
    }
  }

  connect() {
    if (!this.running) return;

    if (this.conn) {
      try { this.conn.destroy(); } catch (e) {}
      this.conn = null;
    }
    this.sftp = null;

    try {
      this.conn = new Client();
      this.conn.on('ready', () => {
        console.log('[MinecraftLogBridge] Connected to Minecraft server SFTP.');
        if (!this.conn) return;
        this.conn.sftp((err, sftp) => {
          if (err || !sftp) {
            console.error('[MinecraftLogBridge] SFTP session error:', err ? err.message : 'No SFTP session');
            this.scheduleReconnect();
            return;
          }
          this.sftp = sftp;
          this.checkLogs();
          // Immediately sync all skins on fresh connection
          this.syncAllPlayerSkins();
        });
      });

      this.conn.on('error', (err) => {
        console.warn('[MinecraftLogBridge] SFTP connection error:', err ? err.message : 'Unknown');
        this.scheduleReconnect();
      });

      this.conn.on('close', () => {
        console.log('[MinecraftLogBridge] SFTP connection closed.');
        this.scheduleReconnect();
      });

      this.conn.connect(this.config);
    } catch (err) {
      console.error('[MinecraftLogBridge] Connect failed:', err ? err.message : 'Unknown');
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (!this.running) return;
    this.isChecking = false;
    this.sftp = null;
    if (this.conn) {
      try { this.conn.destroy(); } catch (e) {}
      this.conn = null;
    }
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }

  async checkLogs() {
    if (!this.running || !this.sftp || this.isChecking) return;
    this.isChecking = true;

    try {
      const activeSftp = this.sftp;
      if (!activeSftp) {
        this.isChecking = false;
        this.scheduleNextCheck();
        return;
      }

      activeSftp.stat('logs/latest.log', (statErr, stats) => {
        if (statErr || !stats || !this.sftp || this.sftp !== activeSftp) {
          this.isChecking = false;
          this.scheduleNextCheck();
          return;
        }

        // Read last 64KB of log file
        const readLength = Math.min(stats.size, 65536);
        const startPos = Math.max(0, stats.size - readLength);

        activeSftp.open('logs/latest.log', 'r', (openErr, handle) => {
          if (openErr || !handle || !this.sftp || this.sftp !== activeSftp) {
            this.isChecking = false;
            this.scheduleNextCheck();
            return;
          }

          const buffer = Buffer.alloc(readLength);
          activeSftp.read(handle, buffer, 0, readLength, startPos, (readErr, bytesRead) => {
            // Safely close file handle with try/catch and existence guard
            try {
              if (activeSftp && handle && typeof activeSftp.close === 'function') {
                activeSftp.close(handle, () => {});
              }
            } catch (closeErr) {}

            try {
              if (!readErr && bytesRead > 0) {
                const text = buffer.slice(0, bytesRead).toString('utf8');
                this.parseLogLines(text);
              }
            } catch (parseErr) {
              console.warn('[MinecraftLogBridge] Error parsing log lines:', parseErr ? parseErr.message : parseErr);
            }

            this.isChecking = false;
            this.scheduleNextCheck();
          });
        });
      });
    } catch (e) {
      this.isChecking = false;
      this.scheduleNextCheck();
    }
  }

  parseLogLines(text) {
    const lines = text.split('\n');

    // 1. Detect /link <8-digit code>
    const linkRegex = /\[.*?\]\s*\[Server thread\/INFO\]:\s*([a-zA-Z0-9_\*\.]+)\s+issued server command:\s*\/link\s+([0-9a-zA-Z\-_]+)/i;

    // 2. Detect skin change commands (/skin <name>, /skin url ..., /sr set ...)
    const skinCmdRegex = /\[.*?\]\s*\[Server thread\/INFO\]:\s*([a-zA-Z0-9_\*\.]+)\s+issued server command:\s*\/(?:skin|sr|skinsrestorer)\s*(.*)/i;

    // 3. Detect SkinsRestorer success messages
    const srLogRegex = /\[.*?\]\s*\[(?:Server thread|Async Chat Thread.*?)\/INFO\]:\s*\[SkinsRestorer\]\s*(?:Successfully set skin of|Set skin of|Skin of)\s*([a-zA-Z0-9_\*\.]+)/i;

    for (const line of lines) {
      // Check /link
      const linkMatch = line.match(linkRegex);
      if (linkMatch) {
        const player = linkMatch[1].trim();
        const code = linkMatch[2].trim().replace(/[\-\s]/g, '');
        const key = `link:${player}:${code}`;

        if (!this.processedCommands.has(key)) {
          this.processedCommands.add(key);
          console.log(`[MinecraftLogBridge] Detected in-game command: Player=${player} Code=${code}`);
          this.handleLinkCommand(player, code);
        }
      }

      // Check /skin command
      const skinCmdMatch = line.match(skinCmdRegex);
      if (skinCmdMatch) {
        const player = skinCmdMatch[1].trim();
        const args = (skinCmdMatch[2] || '').trim();
        const key = `skin:${player}:${args}:${line.substring(0, 20)}`;

        if (!this.processedCommands.has(key)) {
          this.processedCommands.add(key);
          console.log(`[MinecraftLogBridge] Detected skin change command: Player=${player} Args=${args}`);
          // Wait 2 seconds for SkinsRestorer to commit change to disk, then sync
          setTimeout(() => {
            this.syncSkinForPlayer(player);
          }, 2000);
        }
      }

      // Check SkinsRestorer system log
      const srLogMatch = line.match(srLogRegex);
      if (srLogMatch) {
        const player = srLogMatch[1].trim();
        const key = `srlog:${player}:${line.substring(0, 20)}`;
        if (!this.processedCommands.has(key)) {
          this.processedCommands.add(key);
          console.log(`[MinecraftLogBridge] SkinsRestorer log confirmed for player: ${player}`);
          setTimeout(() => {
            this.syncSkinForPlayer(player);
          }, 1500);
        }
      }
    }
  }

  async handleLinkCommand(player, code) {
    try {
      const isBedrock = player.startsWith('.') || player.startsWith('*');
      const result = await PlayerLinkService.verifyAndLink({
        code,
        minecraftUsername: player,
        isBedrock
      });

      if (result.success) {
        console.log(`[MinecraftLogBridge] SUCCESS: Linked ${player} to Discord @${result.player.discordUsername}!`);
        // Immediately fetch their custom SkinsRestorer skin so the web shows their real in-game skin
        await this.syncSkinForPlayer(player, result.player.minecraftUuid);
      } else {
        console.warn(`[MinecraftLogBridge] Link failed for ${player} code ${code}:`, result.error);
      }
    } catch (err) {
      console.error('[MinecraftLogBridge] Error executing link:', err);
    }
  }

  // Synchronize skin for a single player
  async syncSkinForPlayer(playerUsername, playerUuid = null) {
    if (!this.sftp) return;

    try {
      const link = PlayerLinkService.getLinkByUsername(playerUsername);
      if (!link) return;

      const uuid = playerUuid || link.minecraftUuid;
      SkinsRestorerService.invalidateCache(uuid);
      const skinData = await SkinsRestorerService.resolveSkinWithSftp(this.sftp, uuid, playerUsername);

      if (skinData && skinData.skinUrl) {
        PlayerLinkService.updatePlayerSkin(link.discordId, skinData);
      }
    } catch (err) {
      console.warn(`[MinecraftLogBridge] Failed syncing skin for ${playerUsername}:`, err.message);
    }
  }

  // Synchronize skins for all currently linked players
  async syncAllPlayerSkins() {
    if (!this.sftp) return;

    try {
      const links = PlayerLinkService.getAllLinks();
      for (const link of links) {
        if (link.minecraftUsername) {
          const skinData = await SkinsRestorerService.resolveSkinWithSftp(
            this.sftp,
            link.minecraftUuid,
            link.minecraftUsername
          );
          if (skinData && skinData.skinUrl) {
            PlayerLinkService.updatePlayerSkin(link.discordId, skinData);
          }
        }
      }
    } catch (err) {
      console.warn('[MinecraftLogBridge] Error in syncAllPlayerSkins:', err.message);
    }
  }

  // Periodic skin sync every 15 seconds
  startPeriodicSkinSync() {
    if (this.skinSyncTimer) clearInterval(this.skinSyncTimer);
    this.skinSyncTimer = setInterval(() => {
      if (this.running && this.sftp) {
        this.syncAllPlayerSkins();
      }
    }, 15000);
  }

  scheduleNextCheck() {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.checkLogs();
    }, this.pollInterval);
  }
}

module.exports = new MinecraftLogBridge();
