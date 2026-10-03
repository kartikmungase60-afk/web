const { Client } = require('ssh2');
const PlayerLinkService = require('./playerLinkService');
const SkinsRestorerService = require('./skinsRestorerService');

class MinecraftLogBridge {
  constructor() {
    this.conn = null;
    this.sftp = null;
    this.running = false;
    this.pollInterval = 1000; // 1 second
    this.timer = null;
    this.skinSyncTimer = null;
    this.processedCommands = new Set();
    this.isChecking = false;
    this.isSyncingSkins = false;
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
    console.log('[MinecraftLogBridge] Starting automated in-game /link & dynamic 1-second /skin bridge via SFTP...');
    this.connect();
    this.startPeriodicSkinSync();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.skinSyncTimer) clearTimeout(this.skinSyncTimer);
    this.isSyncingSkins = false;
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
    this.isSyncingSkins = false;
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

    // 2. Detect skin change commands (/skin <name>, /skins, /skin url ..., /sr set ...)
    const skinCmdRegex = /\[.*?\]\s*\[Server thread\/INFO\]:\s*([a-zA-Z0-9_\*\.]+)\s+issued server command:\s*\/(?:skins?|sr|skinsrestorer)\s*(.*)/i;

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

      // Check /skin command (/skin, /sr, /skinsrestorer)
      const skinCmdMatch = line.match(skinCmdRegex);
      if (skinCmdMatch) {
        const player = skinCmdMatch[1].trim();
        const args = (skinCmdMatch[2] || '').trim();
        const key = `skin:${player}:${args}:${line.substring(0, 20)}`;

        if (!this.processedCommands.has(key)) {
          this.processedCommands.add(key);
          console.log(`[MinecraftLogBridge] Detected skin change command: Player=${player} Args=${args}`);
          // Immediate check + rapid followups so disk write is captured instantly
          this.syncSkinForPlayer(player);
          setTimeout(() => this.syncSkinForPlayer(player), 500);
          setTimeout(() => this.syncSkinForPlayer(player), 1200);
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
          this.syncSkinForPlayer(player);
          setTimeout(() => this.syncSkinForPlayer(player), 500);
        }
      }

      // Check player join/login to sync skin upon server entrance
      const joinRegex = /\[.*?\]\s*\[(?:Server thread|User Authenticator.*?)\/INFO\]:\s*([a-zA-Z0-9_\*\.]+)\s+(?:joined the game|logged in with entity id)/i;
      const joinMatch = line.match(joinRegex);
      if (joinMatch) {
        const player = joinMatch[1].trim();
        const key = `join:${player}:${line.substring(0, 20)}`;
        if (!this.processedCommands.has(key)) {
          this.processedCommands.add(key);
          console.log(`[MinecraftLogBridge] Player joined game: ${player}`);
          this.syncSkinForPlayer(player);
          setTimeout(() => this.syncSkinForPlayer(player), 1000);
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
      let link = PlayerLinkService.getLinkByUsername(playerUsername);
      if (!link) {
        await PlayerLinkService.fetchAllFromFirebase();
        link = PlayerLinkService.getLinkByUsername(playerUsername);
      }
      if (!link) return;

      const uuid = playerUuid || link.minecraftUuid;
      SkinsRestorerService.invalidateCache(uuid);
      const skinData = await SkinsRestorerService.resolveSkinWithSftp(this.sftp, uuid, playerUsername);

      if (skinData && skinData.skinUrl) {
        PlayerLinkService.updatePlayerSkinByUsername(playerUsername, skinData);
      }
    } catch (err) {
      console.warn(`[MinecraftLogBridge] Failed syncing skin for ${playerUsername}:`, err.message);
    }
  }

  // Synchronize skins for all currently linked players concurrently
  async syncAllPlayerSkins() {
    if (!this.sftp || this.isSyncingSkins) return;
    this.isSyncingSkins = true;

    try {
      // Periodically refresh links from Firebase so any accounts linked via web are tracked
      if (Date.now() - this.lastSkinSyncTime > 10000) {
        this.lastSkinSyncTime = Date.now();
        await PlayerLinkService.fetchAllFromFirebase();
      }

      const links = PlayerLinkService.getAllLinks();
      if (!links || links.length === 0) return;

      const seen = new Set();
      const uniquePlayers = [];
      for (const l of links) {
        if (l && l.minecraftUsername && !seen.has(l.minecraftUsername.toLowerCase())) {
          seen.add(l.minecraftUsername.toLowerCase());
          uniquePlayers.push(l);
        }
      }

      await Promise.all(uniquePlayers.map(async (link) => {
        try {
          const skinData = await SkinsRestorerService.resolveSkinWithSftp(
            this.sftp,
            link.minecraftUuid,
            link.minecraftUsername
          );
          if (skinData && skinData.skinUrl) {
            PlayerLinkService.updatePlayerSkinByUsername(link.minecraftUsername, skinData);
          }
        } catch (e) {}
      }));
    } catch (err) {
      console.warn('[MinecraftLogBridge] Error in syncAllPlayerSkins:', err.message);
    } finally {
      this.isSyncingSkins = false;
    }
  }

  // Non-overlapping 1-second check system for all players
  startPeriodicSkinSync() {
    if (this.skinSyncTimer) clearTimeout(this.skinSyncTimer);

    const runSyncLoop = async () => {
      if (!this.running) return;
      if (this.sftp && !this.isSyncingSkins) {
        await this.syncAllPlayerSkins();
      }
      if (this.running) {
        this.skinSyncTimer = setTimeout(runSyncLoop, 1000);
      }
    };

    this.skinSyncTimer = setTimeout(runSyncLoop, 1000);
  }

  scheduleNextCheck() {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.checkLogs();
    }, this.pollInterval);
  }
}

module.exports = new MinecraftLogBridge();
