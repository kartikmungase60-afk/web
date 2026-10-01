const net = require('net');
const config = require('../config');

// Packet Types
const SERVERDATA_AUTH = 3;
const SERVERDATA_EXECCOMMAND = 2;
const SERVERDATA_RESPONSE_VALUE = 0;

class RconClient {
  constructor(options = {}) {
    this.host = options.host || config.rcon.host;
    this.port = options.port || config.rcon.port;
    this.password = options.password || config.rcon.password;
    this.timeout = options.timeout || config.rcon.timeoutMs;
  }

  createPacket(id, type, payload) {
    const payloadBuf = Buffer.from(payload, 'utf8');
    const length = 4 + 4 + payloadBuf.length + 2; // id (4) + type (4) + payload + 2 null bytes
    const buf = Buffer.alloc(4 + length);

    buf.writeInt32LE(length, 0);
    buf.writeInt32LE(id, 4);
    buf.writeInt32LE(type, 8);
    payloadBuf.copy(buf, 12);
    buf.writeInt8(0, 12 + payloadBuf.length);
    buf.writeInt8(0, 12 + payloadBuf.length + 1);

    return buf;
  }

  async sendCommand(command) {
    // If RCON is disabled in configuration, simulate command execution
    if (!config.rcon.enabled) {
      console.log(`[RCON:SIMULATED] Executing command on Minecraft console: >> ${command}`);
      return { success: true, simulated: true, output: `[Simulated] Executed: ${command}` };
    }

    return new Promise((resolve) => {
      const socket = new net.Socket();
      let authed = false;
      const reqId = Math.floor(Math.random() * 100000);
      let outputBuffer = '';

      const cleanup = (res) => {
        socket.destroy();
        resolve(res);
      };

      socket.setTimeout(this.timeout);

      socket.on('connect', () => {
        // Authenticate
        const authPacket = this.createPacket(reqId, SERVERDATA_AUTH, this.password);
        socket.write(authPacket);
      });

      socket.on('data', (data) => {
        if (data.length < 12) return;
        const resId = data.readInt32LE(4);
        const resType = data.readInt32LE(8);

        if (!authed) {
          if (resId === -1) {
            return cleanup({ success: false, error: 'RCON Authentication failed: Invalid password' });
          }
          if (resId === reqId) {
            authed = true;
            // Now send actual command
            const cmdPacket = this.createPacket(reqId + 1, SERVERDATA_EXECCOMMAND, command);
            socket.write(cmdPacket);
          }
        } else {
          // Read response payload
          const body = data.toString('utf8', 12, data.length - 2);
          outputBuffer += body;
          cleanup({ success: true, output: outputBuffer });
        }
      });

      socket.on('timeout', () => cleanup({ success: false, error: 'RCON connection timed out' }));
      socket.on('error', (err) => cleanup({ success: false, error: `RCON connection error: ${err.message}` }));
    });
  }

  async executeRewardCommands(username, commands) {
    const results = [];
    for (const rawCmd of commands) {
      const parsedCmd = rawCmd.replace(/\{player\}/g, username);
      const res = await this.sendCommand(parsedCmd);
      results.push({ command: parsedCmd, ...res });
    }
    return results;
  }
}

module.exports = new RconClient();
