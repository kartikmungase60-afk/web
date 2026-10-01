package net.battlepie.link;

import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;

/**
 * Battlepie Network In-Game Discord Account Linker Plugin
 * Compatible with Spigot, Paper, Purpur 1.8 through 1.21+
 * Auto-detects: Java Premium, Java Cracked, Bedrock / Pocket Edition (Geyser/Floodgate),
 * and custom skins from SkinsRestorer!
 */
public class BattlepieLinkPlugin extends JavaPlugin implements CommandExecutor {

    private String apiUrl;
    private String serverSecret;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        this.apiUrl = getConfig().getString("api-url", "http://localhost:3000/api/auth/link/ingame");
        this.serverSecret = getConfig().getString("server-secret", "battlepie_secret_token_123");

        if (getCommand("link") != null) {
            getCommand("link").setExecutor(this);
        }
        getLogger().info("BattlepieLinkPlugin enabled! API URL: " + apiUrl);
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player)) {
            sender.sendMessage(ChatColor.RED + "Only in-game players can use /link <code>.");
            return true;
        }

        Player player = (Player) sender;
        if (args.length < 1) {
            player.sendMessage(ChatColor.translateAlternateColorCodes('&', 
                "&8[&c&lBattlepie&8] &cUsage: &e/link <8-digit code>\n&7Get your link code at: &fhttps://battlepie.net/me"));
            return true;
        }

        String code = args[0].trim();
        String playerName = player.getName();
        String playerUuid = player.getUniqueId().toString();

        // 1. Check if player is Bedrock / Pocket Edition
        boolean isBedrock = playerName.startsWith(".") || playerName.startsWith("*");
        try {
            Class<?> floodgateClass = Class.forName("org.geysermc.floodgate.api.FloodgateApi");
            Object instance = floodgateClass.getMethod("getInstance").invoke(null);
            Object result = floodgateClass.getMethod("isFloodgatePlayer", java.util.UUID.class).invoke(instance, player.getUniqueId());
            if (result instanceof Boolean && (Boolean) result) {
                isBedrock = true;
            }
        } catch (Throwable ignored) {
            // Floodgate API not present
        }

        // 2. Check if player is using a custom skin via SkinsRestorer (v14 or v15)
        String skinName = null;
        try {
            // SkinsRestorer v15 API
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
                // SkinsRestorer v14 / legacy API fallback
                Class<?> srApiClass = Class.forName("net.skinsrestorer.api.SkinsRestorerAPI");
                Object srApi = srApiClass.getMethod("getApi").invoke(null);
                Object skin = srApi.getClass().getMethod("getSkinName", String.class).invoke(srApi, player.getName());
                if (skin != null) {
                    skinName = skin.toString();
                }
            } catch (Throwable t2) {
                // SkinsRestorer not loaded
            }
        }

        player.sendMessage(ChatColor.translateAlternateColorCodes('&', 
            "&8[&c&lBattlepie&8] &7Contacting Battlepie network to verify code &e" + code + "&7..."));

        final boolean finalIsBedrock = isBedrock;
        final String finalSkinName = skinName;

        // Execute asynchronous HTTP request
        Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
            try {
                URL url = new URL(apiUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; utf-8");
                conn.setRequestProperty("Accept", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);

                String escapedSkin = finalSkinName != null ? "\"" + finalSkinName.replace("\"", "\\\"") + "\"" : "null";
                String jsonInput = String.format(
                    "{\"code\":\"%s\",\"player\":\"%s\",\"uuid\":\"%s\",\"isBedrock\":%b,\"skinName\":%s,\"serverSecret\":\"%s\"}",
                    code, playerName, playerUuid, finalIsBedrock, escapedSkin, serverSecret
                );

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonInput.getBytes(StandardCharsets.UTF_8);
                    os.write(input, 0, input.length);
                }

                int statusCode = conn.getResponseCode();
                Scanner scanner = new Scanner(statusCode >= 400 ? conn.getErrorStream() : conn.getInputStream(), "UTF-8");
                String responseBody = scanner.useDelimiter("\\A").hasNext() ? scanner.next() : "";
                scanner.close();

                Bukkit.getScheduler().runTask(this, () -> {
                    if (statusCode == 200) {
                        player.sendMessage(ChatColor.translateAlternateColorCodes('&', 
                            "&8[&c&lBattlepie&8] &a&lSUCCESS! &7Your account &f" + playerName + " &7is now linked to Discord!"));
                        if (finalSkinName != null) {
                            player.sendMessage(ChatColor.translateAlternateColorCodes('&', 
                                "&8[&c&lBattlepie&8] &bSkinsRestorer: &7Synced custom skin &e" + finalSkinName + " &7with web profile."));
                        }
                        player.sendMessage(ChatColor.translateAlternateColorCodes('&', 
                            "&8[&c&lBattlepie&8] &aYour in-game perks, community roles, and store sync are now live."));
                    } else {
                        player.sendMessage(ChatColor.translateAlternateColorCodes('&', 
                            "&8[&c&lBattlepie&8] &c&lFAILED: &7Invalid or expired code. Please visit &fhttps://battlepie.net/me"));
                    }
                });
            } catch (Exception ex) {
                Bukkit.getScheduler().runTask(this, () -> {
                    player.sendMessage(ChatColor.translateAlternateColorCodes('&', 
                        "&8[&c&lBattlepie&8] &cError connecting to Battlepie Web API: &7" + ex.getMessage()));
                });
            }
        });

        return true;
    }
}
