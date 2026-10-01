# Battlepie Network — Full-Stack Reverse Engineered Platform

A high-fidelity, complete full-stack reverse-engineered replication of the [Battlepie](https://battlepie.net/) Minecraft gaming network and official web store.

> **Active Workspace Recommendation:**  
> Please set `C:\Users\Kartikplayzz\.gemini\antigravity-ide\scratch\battlepie-clone` as your active workspace in your IDE / editor.

---

## 🚀 Overview

Battlepie is an Indian Minecraft gaming network (`battlepie.net` / `play.battlepie.net`) featuring Lifesteal SMP, custom gamemodes, proximity voice chat, and an integrated in-game web store.

This repository contains both the **reconstructed client frontend** and a **production-ready Node.js / Express backend** with live TCP Server List Ping, Mojang UUID verification, session cart, order management, and Minecraft RCON command execution.

---

## 📂 Project Structure

```
battlepie-clone/
│
├── package.json         # Node.js backend configuration & npm scripts
├── README.md            # Comprehensive architecture and developer guide
│
├── index.html           # Replicated landing page (Hero, 3D cube, live status, IP copy, Discord)
├── store.html           # Web Store (Top donor, recent payments, categories, products, quick-view)
├── checkout.html        # Checkout funnel (Skin avatar preview, Bedrock toggle, discount coupons)
├── terms.html           # Full Terms & Conditions (Player agreement, voice-chat AI disclosure)
├── privacy.html         # Full Privacy Policy (DPDPA 2023 compliance, Discord bot disclosures)
│
├── css/
│   └── styles.css       # Design tokens, themes (dark/light), animations, glassmorphism, scrollbars
│
├── js/
│   ├── store-data.js    # Catalog database (Ranks, Coins, Perks, top donor, recent payments)
│   └── app.js           # Core client engine (Theme toggle, Cart drawer, IP copy, Toast, API status)
│
└── server/
    ├── index.js         # Main Express entry point, clean routing & static file server
    ├── config.js        # Server settings, Minecraft host/port, RCON credentials, coupons
    ├── test-api.js      # Automated backend endpoint & RCON fulfillment test suite
    │
    ├── data/
    │   ├── products.json # Database of products with pricing, perks, and RCON reward commands
    │   └── orders.json   # Persistent order storage, recent payments, and top donor records
    │
    ├── routes/
    │   ├── publicApi.js  # /api-public/status, /api-public/discord, /api-public/player/:username
    │   ├── storeApi.js   # /store/cart, /store/cart/update, /api/store/checkout, /validate-coupon
    │   ├── skinApi.js    # /skin/:username, /skin/head/:username (avatar/body proxy)
    │   └── webhookApi.js # /api/webhooks/payment (payment gateway callback & perk delivery)
    │
    └── services/
        ├── minecraftPing.js # Native TCP Server List Ping (SLP) client with latency calculator
        ├── mojangService.js # Mojang API UUID resolver & Bedrock Floodgate UUID generator
        ├── discordService.js# Live Discord community stats and online presence fetcher
        ├── rconService.js   # Minecraft RCON client for in-game console command execution
        └── orderStore.js    # File-backed JSON database for orders, donors, and payment logs
```

---

## 🖥️ Backend Architecture & Endpoints

### 1. Public Network APIs (`/api-public/*`)
- `GET /api-public/status`: Uses native TCP sockets to perform a Minecraft Server List Ping (protocol 765, 1.20.4+) against `play.battlepie.net:25565` or your own server. Returns live online players, max capacity, MOTD, and ping latency.
- `GET /api-public/discord`: Fetches real-time Discord community statistics (member counts and active presences).
- `GET /api-public/player/:username`: Resolves authentic Mojang UUIDs, skin links, and Floodgate Bedrock profiles.

### 2. Store & Cart APIs (`/store/*` & `/api/store/*`)
- `GET /store/products`: Returns the entire product catalog, categories, pricing, and perks.
- `GET /store/cart`: Cookie/session-based cart retrieval matching Alpine.js drawer contracts.
- `POST /store/cart/update`: Add or update line item quantities.
- `POST /store/cart/remove`: Remove items from cart.
- `POST /api/store/validate-coupon`: Validates promo codes (`BATTLEPIE`, `VIP20`, `SUMMER50`).
- `POST /api/store/checkout`: Validates player username, computes discounts, creates an order, and prepares payment.
- `POST /api/store/simulate-payment`: Sandbox testing endpoint to mark orders paid and trigger in-game commands.

### 3. Automated In-Game Delivery (RCON Bridge)
When an order is confirmed (either via `/api/store/simulate-payment` or `/api/webhooks/payment`), the backend connects to your Minecraft server via RCON and executes the reward commands configured in `server/data/products.json`:
- `lp user {player} parent add pie`
- `eco give {player} 5000`
- `broadcast &6&lBATTLEPIE &8» &f{player} &7just unlocked &ePie Rank&7!`

---

## ⚡ Running the Backend Server

### Step 1: Install Dependencies
```powershell
cd "C:\Users\Kartikplayzz\.gemini\antigravity-ide\scratch\battlepie-clone"
npm install
```

### Step 2: Start Server
```powershell
npm start
```
Or for development with auto-reloading:
```powershell
npm run dev
```

The server will start at **`http://localhost:3000`** and serve both the frontend HTML pages and the live backend API routes.

### Step 3: Run Automated Test Suite
```powershell
npm test
```
This tests all endpoints, live ping, Mojang resolution, checkout creation, and RCON reward delivery.

---

## ⚙️ Configuration & Customization (`server/config.js`)

You can configure your server settings either by editing `server/config.js` or via environment variables:

| Setting | Default Value | Description |
|---|---|---|
| `PORT` | `3000` | HTTP Web and API port |
| `MC_HOST` | `play.battlepie.net` | Target Minecraft server host |
| `MC_PORT` | `25565` | Target Minecraft server port |
| `RCON_ENABLED` | `false` | Set to `true` to connect to real server console |
| `RCON_HOST` | `127.0.0.1` | Minecraft RCON IP address |
| `RCON_PORT` | `25575` | Minecraft RCON port |
| `RCON_PASSWORD` | `battlepie_rcon_secret` | RCON password from `server.properties` |
| `DISCORD_INVITE` | `battlepie` | Discord server invite code |

---

## 🛡️ License & Mojang Compliance

*This project is an educational reverse-engineering study. Battlepie operates under Mojang Studios' Commercial Usage Guidelines. Battlepie and this project are not affiliated with Mojang Studios or Microsoft.*
