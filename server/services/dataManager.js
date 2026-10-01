const fs = require('fs');
const path = require('path');
const config = require('../config');

// Ensure data and uploads directory exist
const DATA_DIR = config.paths.dataDir || path.join(__dirname, '../data');
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function safeReadJson(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error(`[DataManager] Error reading ${filePath}:`, err.message);
  }
  safeWriteJson(filePath, defaultValue);
  return defaultValue;
}

function safeWriteJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`[DataManager] Error writing ${filePath}:`, err.message);
    return false;
  }
}

// File paths
const TOURNAMENTS_FILE = path.join(DATA_DIR, 'tournaments.json');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'applications.json');
const MAILBOX_FILE = path.join(DATA_DIR, 'mailbox.json');
const PASSWORDS_FILE = path.join(DATA_DIR, 'passwords.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'site_settings.json');
const AUDIT_LOGS_FILE = path.join(DATA_DIR, 'audit_logs.json');
const PRODUCTS_FILE = config.paths.productsFile || path.join(DATA_DIR, 'products.json');

// Initial Tournaments Data
const defaultTournaments = [
  {
    id: "bedwars-tournament",
    name: "BEDWARS TOURNAMENT",
    slug: "bedwars",
    status: "Registration open",
    isOpen: true,
    bannerImage: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80",
    badgeIcon: "https://mc-heads.net/head/Bed/64",
    description: "Mine Orange is hosting a BedWars tournament, and it's time to see which team has what it takes to come out on top. Gather your teammates, defend your bed, collect resources, and fight your way across the map. Every match will test your teamwork, strategy, and ability to pull off a clutch when it matters most.\n\nWill your team rush to victory, or make an incredible comeback when the odds are against you? Step into the arena, take on the competition, and prove you're the best BedWars team on Mine Orange!",
    rules: [
      "No hacking, auto-clickers, or blacklisted client modifications.",
      "4 main players per team + up to 2 optional substitutes.",
      "All team members must have linked their Minecraft account on mineorange.fun.",
      "Matches will be officiated by server referees with instant replay."
    ],
    maxTeams: 32,
    prizes: [
      "1st Place: 100,000 Coins + 30 Days MVP++ Rank for all players",
      "2nd Place: 50,000 Coins + 30 Days MVP+ Rank",
      "3rd Place: 25,000 Coins + 30 Days VIP Rank"
    ],
    teams: [
      {
        id: "team_1",
        name: "OrangeKnights",
        logo: "bear",
        leader: "Kartikplayzz",
        players: ["Kartikplayzz", "ShadowRider", "Frosty_Boy", "PixelPro"],
        substitutes: ["VortexMC"],
        status: "APPROVED",
        registeredAt: "2026-10-01T12:00:00Z"
      },
      {
        id: "team_2",
        name: "BedBusters",
        logo: "crocodile",
        leader: "DragonSlayer99",
        players: ["DragonSlayer99", "NovaBlade", "AeroSwift", "BlazeKing"],
        substitutes: [],
        status: "APPROVED",
        registeredAt: "2026-10-01T14:30:00Z"
      }
    ]
  }
];

// Initial Applications Configuration & Submissions
const defaultApplications = {
  discordStaff: {
    id: "discord-staff",
    title: "Discord Staff Application",
    questionsCount: 11,
    isOpen: true,
    description: "Join our official Discord moderation team. Help moderate channels, host events, and support community members.",
    questions: [
      { id: "q1", text: "What is your Discord username and tag?", type: "text", required: true },
      { id: "q2", text: "What is your age?", type: "number", required: true },
      { id: "q3", text: "What time zone are you in?", type: "text", required: true },
      { id: "q4", text: "How many hours per week can you dedicate to moderation?", type: "text", required: true },
      { id: "q5", text: "Do you have previous staff experience on Minecraft/Discord servers?", type: "textarea", required: true },
      { id: "q6", text: "How would you handle a member spamming NSFW or malicious links in chat?", type: "textarea", required: true },
      { id: "q7", text: "How do you defuse a heated argument between two players?", type: "textarea", required: true },
      { id: "q8", text: "What makes you different from other applicants?", type: "textarea", required: true },
      { id: "q9", text: "Are you familiar with Discord automod, Dyno, and ticket bots?", type: "text", required: true },
      { id: "q10", text: "Have you ever received a mute or ban on Mine Orange?", type: "text", required: true },
      { id: "q11", text: "Any additional details or comments you'd like to share?", type: "textarea", required: false }
    ],
    submissions: [
      {
        id: "sub_disc_101",
        applicant: "Kartikplayzz",
        discordId: "kartik_xd1",
        submittedAt: "2026-10-01T15:20:00Z",
        status: "UNDER REVIEW",
        answers: {
          q1: "kartik_xd1#0001",
          q2: "18",
          q3: "IST (UTC+5:30)",
          q4: "20-25 hours",
          q5: "Yes, moderated two community servers with 1,500+ members.",
          q6: "Immediately delete the messages, timeout the user, warn the channel, and notify higher staff if a raid is occurring.",
          q7: "Instruct both parties to stop calmly, move private disputes to DMs, and issue warnings if rules are broken.",
          q8: "High activity during late hours when few moderators are active, very patient and calm.",
          q9: "Yes, experienced with Carl-bot, Dyno, and ticket systems.",
          q10: "No, never.",
          q11: "Eager to help keep Mine Orange safe and welcoming!"
        }
      }
    ]
  },
  minecraftStaff: {
    id: "minecraft-staff",
    title: "Minecraft Staff Application",
    questionsCount: 16,
    isOpen: true,
    description: "By checking the option below, You will agree to every single rule which our server follows without any hesitation. If you get selected for the Discord Staff or Minecraft Staff than you have to maintain high professionalism and fairness.",
    questions: [
      { id: "q1", text: "What is your in-game Minecraft username?", type: "text", required: true },
      { id: "q2", text: "Are you Java or Bedrock player?", type: "text", required: true },
      { id: "q3", text: "What is your age?", type: "number", required: true },
      { id: "q4", text: "What time zone are you in?", type: "text", required: true },
      { id: "q5", text: "How long have you played on Mine Orange?", type: "text", required: true },
      { id: "q6", text: "How many hours per day can you be active in-game?", type: "text", required: true },
      { id: "q7", text: "Do you have working microphone and Discord voice capability?", type: "text", required: true },
      { id: "q8", text: "Can you record 60fps gameplay clips as proof of rule violations?", type: "text", required: true },
      { id: "q9", text: "Do you have prior staff experience on Minecraft servers?", type: "textarea", required: true },
      { id: "q10", text: "How would you identify and handle an undercover xray or fly hacker?", type: "textarea", required: true },
      { id: "q11", text: "What would you do if a VIP player was swearing and harassing new players?", type: "textarea", required: true },
      { id: "q12", text: "What would you do if a fellow staff member abused permissions?", type: "textarea", required: true },
      { id: "q13", text: "Which CoreProtect and LiteBans commands are you familiar with?", type: "text", required: true },
      { id: "q14", text: "Why do you want to join the Mine Orange staff team?", type: "textarea", required: true },
      { id: "q15", text: "Have you ever been punished on this or any other network?", type: "textarea", required: true },
      { id: "q16", text: "Do you accept that staff duty requires prioritizing tickets over casual play?", type: "text", required: true }
    ],
    submissions: []
  }
};

// Initial Site Settings
const defaultSettings = {
  serverName: "Mine Orange",
  serverIp: "play.mineorange.fun",
  serverPort: 25565,
  bedrockPort: 19132,
  discordInvite: "https://discord.gg/mineorange",
  bannerText: "SEASON 3 TOURNAMENTS ARE NOW LIVE! BEDWARS REGISTRATION OPEN!",
  bannerEnabled: true,
  maintenanceMode: false,
  onlinePlayersBoost: 42
};

// Initial Audit Logs (Sample for immediate user demonstration)
const defaultAuditLogs = [
  {
    id: "log_101",
    timestamp: "2026-10-01T22:30:15Z",
    date: "2026-10-01",
    time: "22:30:15",
    ip: "103.156.42.118",
    category: "Store",
    action: "UPDATE_PRODUCT",
    details: "Modified price and perks for 'MVP+ Rank' in Ranks category",
    adminAccount: "[Protected Admin]"
  },
  {
    id: "log_102",
    timestamp: "2026-10-01T22:35:40Z",
    date: "2026-10-01",
    time: "22:35:40",
    ip: "103.156.42.118",
    category: "Tournaments",
    action: "OPEN_REGISTRATION",
    details: "Opened registration slots for BedWars Tournament (max 32 teams)",
    adminAccount: "[Protected Admin]"
  },
  {
    id: "log_103",
    timestamp: "2026-10-01T22:42:01Z",
    date: "2026-10-01",
    time: "22:42:01",
    ip: "152.56.88.24",
    category: "Applications",
    action: "UPDATE_STATUS",
    details: "Moved submission sub_disc_101 for Kartikplayzz to 'UNDER REVIEW'",
    adminAccount: "[Protected Admin]"
  }
];

class DataManager {
  // Tournaments
  getTournaments() {
    return safeReadJson(TOURNAMENTS_FILE, defaultTournaments);
  }

  saveTournaments(tournaments) {
    return safeWriteJson(TOURNAMENTS_FILE, tournaments);
  }

  getTournament(id) {
    const list = this.getTournaments();
    return list.find(t => t.id === id || t.slug === id);
  }

  // Applications
  getApplications() {
    return safeReadJson(APPLICATIONS_FILE, defaultApplications);
  }

  saveApplications(apps) {
    return safeWriteJson(APPLICATIONS_FILE, apps);
  }

  // Mailbox
  getMailbox() {
    return safeReadJson(MAILBOX_FILE, { invites: [], messages: [] });
  }

  saveMailbox(mailbox) {
    return safeWriteJson(MAILBOX_FILE, mailbox);
  }

  // Passwords
  getPasswords() {
    return safeReadJson(PASSWORDS_FILE, { logs: [] });
  }

  savePasswords(data) {
    return safeWriteJson(PASSWORDS_FILE, data);
  }

  // Settings
  getSettings() {
    return safeReadJson(SETTINGS_FILE, defaultSettings);
  }

  saveSettings(settings) {
    return safeWriteJson(SETTINGS_FILE, settings);
  }

  // Audit Logs
  getAuditLogs() {
    return safeReadJson(AUDIT_LOGS_FILE, defaultAuditLogs);
  }

  addAuditLog({ ip, category, action, details }) {
    const logs = this.getAuditLogs();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    // Clean IP address
    let cleanIp = ip || '127.0.0.1';
    if (cleanIp.startsWith('::ffff:')) {
      cleanIp = cleanIp.substring(7);
    }

    const newLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: now.toISOString(),
      date: dateStr,
      time: timeStr,
      ip: cleanIp,
      category: category || 'General',
      action: action || 'ADMIN_ACTION',
      details: details || '',
      // MANDATORY RULE: strictly hide which admin account performed the action
      adminAccount: '[Protected Admin]'
    };

    logs.unshift(newLog);
    // Keep last 500 audit logs
    if (logs.length > 500) logs.pop();
    safeWriteJson(AUDIT_LOGS_FILE, logs);
    return newLog;
  }

  // Products
  getProducts() {
    try {
      if (fs.existsSync(PRODUCTS_FILE)) {
        return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('[DataManager] Error reading products:', e.message);
    }
    return [];
  }

  saveProducts(products) {
    return safeWriteJson(PRODUCTS_FILE, products);
  }
}

module.exports = new DataManager();
