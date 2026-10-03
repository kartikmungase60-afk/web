package net.battlepie.link;

import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.player.AsyncPlayerChatEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Scanner;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Mine Orange Network In-Game Discord Account Linker Plugin
 * Complete Support:
 * - Dynamic Verification & In-Game Linking
 * - Instant Website Unlink Detection & Combat/AFK-Aware Enforcement
 * - 100% Compatible with Spigot, Paper, Purpur, and Folia
 */
public class BattlepieLinkPlugin extends JavaPlugin implements CommandExecutor, Listener {

    private String apiUrl;
    private String serverSecret;
    private final ScheduledExecutorService backgroundExecutor = Executors.newSingleThreadScheduledExecutor();

    // Combat & Activity tracking for smart unlinking
    private final Map<UUID, Long> lastPvPTime = new ConcurrentHashMap<>();
    private final Map<UUID, Long> lastActivityTime = new ConcurrentHashMap<>();

    @Override
    public void onEnable() {
        saveDefaultConfig();
        loadConfiguration();

        // Register event listener for PvP & activity detection
        getServer().getPluginManager().registerEvents(this, this);

        if (getCommand("link") != null) {
            getCommand("link").setExecutor(this);
        }
        if (getCommand("mineorangelink") != null) {
            getCommand("mineorangelink").setExecutor(this);
        }
        if (getCommand("battlepielink") != null) {
            getCommand("battlepielink").setExecutor(this);
        }

        getLogger().info("MineOrangeLinkPlugin v1.3.0 enabled! API URL: " + apiUrl);

        // Keep-alive background task: pings /health every 10 minutes
        backgroundExecutor.scheduleWithFixedDelay(() -> {
            try {
                String healthUrl = apiUrl.replace("/api/auth/link/ingame", "/health");
                URL u = new URL(healthUrl);
                HttpURLConnection conn = (HttpURLConnection) u.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("User-Agent", "MineOrangeLink/1.3.0 (KeepAlive)");
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                int code = conn.getResponseCode();
                if (code == 200) {
                    getLogger().info("Mine Orange Web API keep-alive ping successful (HTTP 200).");
                }
            } catch (Exception ignored) {}
        }, 15, 600, TimeUnit.SECONDS);

        // Instant Pending Unlinks Poller: polls every 2 seconds for website unlinks
        backgroundExecutor.scheduleWithFixedDelay(this::checkPendingUnlinks, 2, 2, TimeUnit.SECONDS);
    }

    @Override
    public void onDisable() {
        backgroundExecutor.shutdownNow();
    }

    public void loadConfiguration() {
        reloadConfig();
        this.apiUrl = getConfig().getString("api-url", "https://mineorange.fun/api/auth/link/ingame");
        this.serverSecret = getConfig().getString("server-secret", "battlepie_secret_token_123");
    }

    // ==========================================
    // ⚔️ PVP & AFK EVENT LISTENERS
    // ==========================================

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onEntityDamage(EntityDamageByEntityEvent event) {
        if (event.getEntity() instanceof Player) {
            Player victim = (Player) event.getEntity();
            Player damager = null;
            if (event.getDamager() instanceof Player) {
                damager = (Player) event.getDamager();
            } else if (event.getDamager() instanceof Projectile) {
                Projectile proj = (Projectile) event.getDamager();
                if (proj.getShooter() instanceof Player) {
                    damager = (Player) proj.getShooter();
                }
            }
            if (damager != null) {
                long now = System.currentTimeMillis();
                lastPvPTime.put(victim.getUniqueId(), now);
                lastPvPTime.put(damager.getUniqueId(), now);
                lastActivityTime.put(victim.getUniqueId(), now);
                lastActivityTime.put(damager.getUniqueId(), now);
            }
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerMove(PlayerMoveEvent event) {
        if (event.getFrom().getBlockX() != event.getTo().getBlockX() ||
            event.getFrom().getBlockY() != event.getTo().getBlockY() ||
            event.getFrom().getBlockZ() != event.getTo().getBlockZ()) {
            lastActivityTime.put(event.getPlayer().getUniqueId(), System.currentTimeMillis());
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerChat(AsyncPlayerChatEvent event) {
        lastActivityTime.put(event.getPlayer().getUniqueId(), System.currentTimeMillis());
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerInteract(PlayerInteractEvent event) {
        lastActivityTime.put(event.getPlayer().getUniqueId(), System.currentTimeMillis());
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        lastPvPTime.remove(event.getPlayer().getUniqueId());
        lastActivityTime.remove(event.getPlayer().getUniqueId());
    }

    // ==========================================
    // 🔍 SMART STATUS DETECTION (AFK / PVP)
    // ==========================================

    public boolean isPlayerAfk(Player player) {
        if (player == null || !player.isOnline()) return false;

        // 1. EssentialsX API check via reflection
        try {
            Plugin essPlugin = Bukkit.getPluginManager().getPlugin("Essentials");
            if (essPlugin != null && essPlugin.isEnabled()) {
                Object user = essPlugin.getClass().getMethod("getUser", Player.class).invoke(essPlugin, player);
                if (user != null) {
                    Object afk = user.getClass().getMethod("isAfk").invoke(user);
                    if (afk instanceof Boolean && (Boolean) afk) {
                        return true;
                    }
                }
            }
        } catch (Throwable ignored) {}

        // 2. Metadata check (supported by multiple AFK plugins)
        if (player.hasMetadata("afk") || player.hasMetadata("isAfk") || player.hasMetadata("AFK")) {
            return true;
        }

        // 3. Movement idle tracker: if player hasn't moved / acted in > 5 minutes
        long lastActive = lastActivityTime.getOrDefault(player.getUniqueId(), System.currentTimeMillis());
        if (System.currentTimeMillis() - lastActive > 300000L) {
            return true;
        }

        return false;
    }

    public boolean isPlayerInPvP(Player player) {
        if (player == null || !player.isOnline()) return false;

        // 1. Combat timestamp check: within last 15 seconds
        long lastPvp = lastPvPTime.getOrDefault(player.getUniqueId(), 0L);
        if (System.currentTimeMillis() - lastPvp < 15000L) {
            return true;
        }

        // 2. Metadata checks (JustCombat, CombatLogX, PvPManager, DeluxeCombat)
        if (player.hasMetadata("combat") || 
            player.hasMetadata("tagged") || 
            player.hasMetadata("in-combat") || 
            player.hasMetadata("combat-tag") || 
            player.hasMetadata("justcombat:tagged") ||
            player.hasMetadata("pvp")) {
            return true;
        }

        // 3. JustCombat reflection check if present
        try {
            Plugin jc = Bukkit.getPluginManager().getPlugin("JustCombat");
            if (jc != null && jc.isEnabled()) {
                for (java.lang.reflect.Method m : jc.getClass().getMethods()) {
                    if ((m.getName().toLowerCase().contains("combat") || m.getName().toLowerCase().contains("tagged"))
                        && m.getParameterCount() == 1 && m.getParameterTypes()[0].isAssignableFrom(Player.class)) {
                        Object res = m.invoke(jc, player);
                        if (res instanceof Boolean && (Boolean) res) return true;
                    }
                }
            }
        } catch (Throwable ignored) {}

        return false;
    }

    // ==========================================
    // 🌐 IN-GAME UNLINKING & DISPATCHER
    // ==========================================

    public void unlinkInGame(Player player) {
        if (player == null) return;
        try {
            Bukkit.getScheduler().runTask(this, () -> {
                try {
                    // Delete Skript variable {mineorange::linked::%player's uuid%}
                    Bukkit.dispatchCommand(Bukkit.getConsoleSender(), "sk run delete {mineorange::linked::" + player.getUniqueId() + "}");
                } catch (Throwable ignored) {}
            });
        } catch (Throwable ignored) {}
    }

    private void checkPendingUnlinks() {
        try {
            String pendingUrl = apiUrl.replace("/ingame", "/pending-unlinks");
            URL u = new URL(pendingUrl);
            HttpURLConnection conn = (HttpURLConnection) u.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "MineOrangeLink/1.3.0 (UnlinkPoller)");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            int code = conn.getResponseCode();
            if (code == 200) {
                String body;
                try (Scanner scanner = new Scanner(conn.getInputStream(), StandardCharsets.UTF_8.name())) {
                    body = scanner.useDelimiter("\\A").hasNext() ? scanner.next() : "";
                }
                if (body != null && body.contains("\"player\"")) {
                    processPendingUnlinksJson(body);
                }
            }
        } catch (Exception ignored) {}
    }

    private void processPendingUnlinksJson(String json) {
        Pattern p = Pattern.compile("\"player\"\\s*:\\s*\"([^\"]+)\"");
        Matcher m = p.matcher(json);
        while (m.find()) {
            String playerName = m.group(1).trim();
            handleUnlinkedPlayer(playerName);
        }
    }

    private void handleUnlinkedPlayer(String playerName) {
        // Acknowledge right away so it doesn't repeatedly trigger
        ackUnlink(playerName);

        Runnable action = () -> {
            Player target = Bukkit.getPlayerExact(playerName);
            if (target == null || !target.isOnline()) {
                getLogger().info("[MineOrangeLink] Player " + playerName + " was unlinked on website while offline.");
                return;
            }

            // Cleanly unlink in-game data
            unlinkInGame(target);

            if (isPlayerAfk(target)) {
                // Rule: "If the player was AFK, don't show it."
                getLogger().info("[MineOrangeLink] Player " + playerName + " was unlinked on website while AFK. Kept undisturbed (no kick, no message).");
            } else if (isPlayerInPvP(target)) {
                // Rule: "If the player was in PVP, don't kick him. Only show the message. Show the message: 'You are successfully unlinked from your account.'"
                getLogger().info("[MineOrangeLink] Player " + playerName + " was unlinked on website while in PVP. Showing message only, not kicking.");
                sendMsg(target, "&8[&6&lMine Orange&8] &cYou are successfully unlinked from your account.");
            } else {
                // Rule: "If the player was moving or doing nothing, then kick him, or not fake a message."
                getLogger().info("[MineOrangeLink] Player " + playerName + " was unlinked on website while active/idle. Kicking player with unlinked message.");
                String kickReason = "&c&lUnlinked Successfully\n\n&7You are successfully unlinked from your account.\n&eVisit https://mineorange.fun/me to re-link.";
                kickPlayerSync(target, kickReason);
            }
        };

        // Execute on main thread
        try {
            Bukkit.getScheduler().runTask(this, action);
        } catch (Throwable t) {
            action.run();
        }
    }

    private void ackUnlink(String playerName) {
        runAsync(() -> {
            try {
                String ackUrl = apiUrl.replace("/ingame", "/ack-unlink");
                URL u = new URL(ackUrl);
                HttpURLConnection conn = (HttpURLConnection) u.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                conn.setRequestProperty("User-Agent", "MineOrangeLink/1.3.0 (AckUnlink)");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                String json = String.format("{\"player\":\"%s\",\"serverSecret\":\"%s\"}", playerName, serverSecret);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(json.getBytes(StandardCharsets.UTF_8));
                }
                conn.getResponseCode();
            } catch (Exception ignored) {}
        });
    }

    // ==========================================
    // 💬 MESSAGE & KICK HELPERS (PAPER / FOLIA / SPIGOT)
    // ==========================================

    public void sendMsg(Player player, String message) {
        if (player == null || !player.isOnline()) return;
        final String colored = ChatColor.translateAlternateColorCodes('&', message);

        // 1. Try Folia EntityScheduler via reflection
        try {
            Object entityScheduler = player.getClass().getMethod("getScheduler").invoke(player);
            entityScheduler.getClass().getMethod("run", org.bukkit.plugin.Plugin.class, Consumer.class, Runnable.class)
                .invoke(entityScheduler, this, (Consumer<Object>) (task) -> player.sendMessage(colored), null);
            return;
        } catch (Throwable ignored) {}

        // 2. Try Bukkit Sync Scheduler
        try {
            Bukkit.getScheduler().runTask(this, () -> player.sendMessage(colored));
            return;
        } catch (Throwable ignored) {}

        // 3. Direct thread-safe send
        try {
            player.sendMessage(colored);
        } catch (Throwable t) {
            getLogger().warning("Failed to send message to player: " + t.getMessage());
        }
    }

    public void kickPlayerSync(Player player, String reason) {
        if (player == null || !player.isOnline()) return;
        final String colored = ChatColor.translateAlternateColorCodes('&', reason);

        // 1. Try Folia EntityScheduler via reflection
        try {
            Object entityScheduler = player.getClass().getMethod("getScheduler").invoke(player);
            entityScheduler.getClass().getMethod("run", org.bukkit.plugin.Plugin.class, Consumer.class, Runnable.class)
                .invoke(entityScheduler, this, (Consumer<Object>) (task) -> player.kickPlayer(colored), null);
            return;
        } catch (Throwable ignored) {}

        // 2. Try Bukkit Sync Scheduler
        try {
            Bukkit.getScheduler().runTask(this, () -> player.kickPlayer(colored));
            return;
        } catch (Throwable ignored) {}

        // 3. Fallback direct kick
        try {
            player.kickPlayer(colored);
        } catch (Throwable t) {
            getLogger().warning("Failed to kick player: " + t.getMessage());
        }
    }

    public void runAsync(Runnable runnable) {
        // 1. Try Folia Async Scheduler
        try {
            Object asyncScheduler = Bukkit.class.getMethod("getAsyncScheduler").invoke(null);
            asyncScheduler.getClass().getMethod("runNow", org.bukkit.plugin.Plugin.class, Consumer.class)
                .invoke(asyncScheduler, this, (Consumer<Object>) (task) -> runnable.run());
            return;
        } catch (Throwable ignored) {}

        // 2. Try Standard Bukkit Async Scheduler
        try {
            Bukkit.getScheduler().runTaskAsynchronously(this, runnable);
            return;
        } catch (Throwable ignored) {}

        // 3. Fallback worker thread
        new Thread(runnable, "BattlepieLink-Worker").start();
    }

    // ==========================================
    // ⌨️ COMMAND EXECUTOR (/link <code>, /link unlink, reload)
    // ==========================================

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        // Admin reload command
        if (args.length >= 1 && args[0].equalsIgnoreCase("reload")) {
            if (sender.isOp() || sender.hasPermission("mineorange.admin") || sender.hasPermission("battlepie.admin")) {
                loadConfiguration();
                sender.sendMessage(ChatColor.translateAlternateColorCodes('&', 
                    "&8[&6&lMine Orange&8] &aConfiguration reloaded! API URL: &e" + apiUrl));
                return true;
            }
        }

        if (!(sender instanceof Player)) {
            sender.sendMessage(ChatColor.RED + "Only in-game players can use /link <code>.");
            return true;
        }

        Player player = (Player) sender;
        if (args.length < 1) {
            sendMsg(player, "&8[&6&lMine Orange&8] &cUsage: &e/link <8-digit code>\n&7Get your link code at: &fhttps://mineorange.fun/me");
            return true;
        }

        // Support in-game unlinking via /link unlink
        if (args[0].equalsIgnoreCase("unlink")) {
            unlinkInGame(player);
            final String pName = player.getName();
            sendMsg(player, "&8[&6&lMine Orange&8] &7Unlinking your account on Mine Orange network...");
            runAsync(() -> {
                try {
                    String unlinkUrl = apiUrl.replace("/ingame", "/unlink-ingame");
                    URL u = new URL(unlinkUrl);
                    HttpURLConnection conn = (HttpURLConnection) u.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    conn.setDoOutput(true);
                    String json = String.format("{\"player\":\"%s\",\"serverSecret\":\"%s\"}", pName, serverSecret);
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(json.getBytes(StandardCharsets.UTF_8));
                    }
                    conn.getResponseCode();
                } catch (Exception ignored) {}
            });
            sendMsg(player, "&8[&6&lMine Orange&8] &cYou are successfully unlinked from your account.");
            return true;
        }

        String code = args[0].trim();
        String playerName = player.getName();
        String playerUuid = player.getUniqueId().toString();

        // Check if player is Bedrock / Pocket Edition
        boolean isBedrock = playerName.startsWith(".") || playerName.startsWith("*");
        try {
            Class<?> floodgateClass = Class.forName("org.geysermc.floodgate.api.FloodgateApi");
            Object instance = floodgateClass.getMethod("getInstance").invoke(null);
            Object result = floodgateClass.getMethod("isFloodgatePlayer", java.util.UUID.class).invoke(instance, player.getUniqueId());
            if (result instanceof Boolean && (Boolean) result) {
                isBedrock = true;
            }
        } catch (Throwable ignored) {}

        // Check SkinsRestorer custom skin
        String skinName = null;
        try {
            Class<?> srProviderClass = Class.forName("net.skinsrestorer.api.SkinsRestorerProvider");
            Object srApi = srProviderClass.getMethod("get").invoke(null);
            Object playerStorage = srApi.getClass().getMethod("getPlayerStorage").invoke(srApi);
            Object skinIdOpt = playerStorage.getClass().getMethod("getSkinId", java.util.UUID.class).invoke(playerStorage, player.getUniqueId());
            if (skinIdOpt instanceof java.util.Optional) {
                java.util.Optional<?> opt = (java.util.Optional<?>) skinIdOpt;
                if (opt.isPresent()) {
                    skinName = opt.get().toString();
                }
            }
        } catch (Throwable t1) {
            try {
                Class<?> srApiClass = Class.forName("net.skinsrestorer.api.SkinsRestorerAPI");
                Object srApi = srApiClass.getMethod("getApi").invoke(null);
                Object skin = srApi.getClass().getMethod("getSkinName", String.class).invoke(srApi, player.getName());
                if (skin != null) skinName = skin.toString();
            } catch (Throwable ignored) {}
        }

        sendMsg(player, "&8[&6&lMine Orange&8] &7Contacting Mine Orange network to verify code &e" + code + "&7...");

        final boolean finalIsBedrock = isBedrock;
        final String finalSkinName = skinName;
        final String currentApiUrl = this.apiUrl;
        final String currentSecret = this.serverSecret;

        runAsync(() -> {
            try {
                URL url = new URL(currentApiUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                conn.setRequestProperty("Accept", "application/json");
                conn.setRequestProperty("User-Agent", "MineOrangeLink/1.3.0 (Minecraft Server)");
                conn.setDoOutput(true);
                conn.setConnectTimeout(25000);
                conn.setReadTimeout(25000);

                String escapedSkin = finalSkinName != null ? "\"" + finalSkinName.replace("\"", "\\\"") + "\"" : "null";
                String jsonInput = String.format(
                    "{\"code\":\"%s\",\"player\":\"%s\",\"uuid\":\"%s\",\"isBedrock\":%b,\"skinName\":%s,\"serverSecret\":\"%s\"}",
                    code, playerName, playerUuid, finalIsBedrock, escapedSkin, currentSecret
                );

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonInput.getBytes(StandardCharsets.UTF_8);
                    os.write(input, 0, input.length);
                }

                int statusCode = conn.getResponseCode();
                InputStream stream = (statusCode >= 400) ? conn.getErrorStream() : conn.getInputStream();
                String responseBody = "";
                if (stream != null) {
                    try (Scanner scanner = new Scanner(stream, StandardCharsets.UTF_8.name())) {
                        responseBody = scanner.useDelimiter("\\A").hasNext() ? scanner.next() : "";
                    }
                }

                getLogger().info("[MineOrangeLink] Verification for " + playerName + " (code: " + code + ") returned HTTP " + statusCode);

                if (statusCode == 200) {
                    getLogger().info("[MineOrangeLink] Verification successful for " + playerName + " (code: " + code + ")! Disconnecting player with linked screen...");
                    String kickScreen = "&a&lLinked Successfully\n\n&7Your Minecraft account is now linked.\n&ePlease rejoin the server.";
                    kickPlayerSync(player, kickScreen);
                } else {
                    String errMsg = "Invalid or expired link code.";
                    if (responseBody.contains("\"error\":\"")) {
                        try {
                            int sIdx = responseBody.indexOf("\"error\":\"") + 9;
                            int eIdx = responseBody.indexOf("\"", sIdx);
                            if (eIdx > sIdx) errMsg = responseBody.substring(sIdx, eIdx);
                        } catch (Exception ignored) {}
                    }
                    sendMsg(player, "&8[&6&lMine Orange&8] &c&lFAILED: &7" + errMsg + " Please check your code on https://mineorange.fun/me");
                }
            } catch (Exception ex) {
                getLogger().severe("[MineOrangeLink] Error connecting to Web API: " + ex.getMessage());
                String msg = ex.getMessage();
                sendMsg(player, "&8[&6&lMine Orange&8] &cError connecting to Mine Orange Web API: &7" + msg);
            }
        });

        return true;
    }
}
