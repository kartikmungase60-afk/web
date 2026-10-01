const { Client } = require('ssh2');
const PlayerLinkService = require('./playerLinkService');

class MinecraftLogBridge {
  constructor() {
    this.conn = null;
    this.sftp = null;
    this.running = false;
    this.pollInterval = 2000; // 2 seconds
    this.timer = null;
    this.lastSize = 0;
    this.processedCommands = new Set();
    this.isChecking = false;
    
    this.config = {
      host: process.env.SFTP_HOST || 'Node1.mineorange.fun',
      port: parseInt(process.env.SFTP_PORT || '2022', 10),
      username: process.env.SFTP_USERNAME || 'master.006427ba',
      password: process.env.SFTP_PASSWORD || 'Kartik@1234'
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log('[MinecraftLogBridge] Starting automated in-game /link log bridge via SFTP...');
    this.connect();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.conn) {
      try { this.conn.end(); } catch (e) {}
    }
  }

  connect() {
    if (!this.running) return;

    this.conn = new Client();
    this.conn.on('ready', () => {
      console.log('[MinecraftLogBridge] Connected to Minecraft server SFTP.');
      this.conn.sftp((err, sftp) => {
        if (err) {
          console.error('[MinecraftLogBridge] SFTP session error:', err.message);
          this.scheduleReconnect();
          return;
        }
        this.sftp = sftp;
        this.checkLogs();
      });
    });

    this.conn.on('error', (err) => {
      console.warn('[MinecraftLogBridge] SFTP connection error:', err.message);
      this.scheduleReconnect();
    });

    this.conn.on('close', () => {
      console.log('[MinecraftLogBridge] SFTP connection closed.');
      this.scheduleReconnect();
    });

    try {
      this.conn.connect(this.config);
    } catch (err) {
      console.error('[MinecraftLogBridge] Connect failed:', err.message);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (!this.running) return;
    this.sftp = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.connect();
    }, 5000);
  }

  async checkLogs() {
    if (!this.running || !this.sftp || this.isChecking) return;
    this.isChecking = true;

    try {
      this.sftp.stat('logs/latest.log', (err, stats) => {
        if (err) {
          this.isChecking = false;
          this.scheduleNextCheck();
          return;
        }

        // Only read recent chunk if file is large, or read last 64KB
        const readLength = Math.min(stats.size, 65536);
        const startPos = Math.max(0, stats.size - readLength);

        this.sftp.open('logs/latest.log', 'r', (err, handle) => {
          if (err) {
            this.isChecking = false;
            this.scheduleNextCheck();
            return;
          }

          const buffer = Buffer.alloc(readLength);
          this.sftp.read(handle, buffer, 0, readLength, startPos, (err, bytesRead) => {
            this.sftp.close(handle, () => {});

            if (!err && bytesRead > 0) {
              const text = buffer.slice(0, bytesRead).toString('utf8');
              this.parseLogLines(text);
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
    const regex = /\[.*?\]\s*\[Server thread\/INFO\]:\s*([a-zA-Z0-9_\*\.]+)\s+issued server command:\s*\/link\s+([0-9a-zA-Z\-_]+)/i;

    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        const player = match[1].trim();
        const code = match[2].trim().replace(/[\-\s]/g, '');
        const key = `${player}:${code}`;

        if (!this.processedCommands.has(key)) {
          this.processedCommands.add(key);
          console.log(`[MinecraftLogBridge] Detected in-game command: Player=${player} Code=${code}`);
          this.handleLinkCommand(player, code);
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
      } else {
        console.warn(`[MinecraftLogBridge] Link failed for ${player} code ${code}:`, result.error);
      }
    } catch (err) {
      console.error('[MinecraftLogBridge] Error executing link:', err);
    }
  }

  scheduleNextCheck() {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.checkLogs();
    }, this.pollInterval);
  }
}

module.exports = new MinecraftLogBridge();
