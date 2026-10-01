package net.battlepie.link;

import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * Battlepie Network In-Game Discord Account Linker Plugin
 * 100% Compatible with Spigot, Paper, Purpur, and Folia multi-threading (1.8 through 1.21+ / 26.3)
 */
public class BattlepieLinkPlugin extends JavaPlugin implements CommandExecutor {

    private String apiUrl;
    private String serverSecret;
    private final ScheduledExecutorService backgroundExecutor = Executors.newSingleThreadScheduledExecutor();

    @Override
    public void onEnable() {
        saveDefaultConfig();
        loadConfiguration();

        if (getCommand("link") != null) {
            getCommand("link").setExecutor(this);
        }
        if (getCommand("battlepielink") != null) {
            getCommand("battlepielink").setExecutor(this);
        }

        getLogger().info("MineOrangeLinkPlugin v1.2.0 enabled! API URL: " + apiUrl);

        // Keep-alive background task: pings /health every 10 minutes (prevents Render free-tier cold sleep)
        backgroundExecutor.scheduleWithFixedDelay(() -> {
            try {
                String healthUrl = apiUrl.replace("/api/auth/link/ingame", "/health");
                URL u = new URL(healthUrl);
                HttpURLConnection conn = (HttpURLConnection) u.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("User-Agent", "BattlepieLink/1.2.0 (KeepAlive)");
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                int code = conn.getResponseCode();
                if (code == 200) {
                    getLogger().info("Battlepie Web API keep-alive ping successful (HTTP 200).");
                }
            } catch (Exception ignored) {}
        }, 15, 600, TimeUnit.SECONDS);
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

    // Safe thread-independent message dispatcher (compatible with Folia, Paper, Spigot)
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

        // 3. Direct thread-safe send (Paper/Folia native support)
        try {
            player.sendMessage(colored);
        } catch (Throwable t) {
            getLogger().warning("Failed to send message to player: " + t.getMessage());
        }
    }

    // Safe async executor (works on Folia, Paper, Spigot)
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

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        // Admin reload command
        if (args.length >= 1 && args[0].equalsIgnoreCase("reload")) {
            if (sender.isOp() || sender.hasPermission("battlepie.admin")) {
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
                conn.setRequestProperty("User-Agent", "MineOrangeLink/1.2.0 (Minecraft Server)");
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
                    sendMsg(player, "&8[&6&lMine Orange&8] &a&lSUCCESS! &7Your account &f" + playerName + " &7is now linked to Discord!");
                    if (finalSkinName != null) {
                        sendMsg(player, "&8[&6&lMine Orange&8] &bSkinsRestorer: &7Synced custom skin &e" + finalSkinName + "&7.");
                    }
                    sendMsg(player, "&8[&6&lMine Orange&8] &aYour perks, roles, and store sync are now active.");
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
