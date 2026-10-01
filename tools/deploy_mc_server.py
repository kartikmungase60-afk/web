import os
import sys
import getpass
import argparse
import paramiko

# Default SFTP configuration from panel
DEFAULT_HOST = "Node1.mineorange.fun"
DEFAULT_PORT = 2022
DEFAULT_USER = "master.006427ba"

def deploy(password, host=DEFAULT_HOST, port=DEFAULT_PORT, username=DEFAULT_USER, backend_url="http://localhost:3000", upload_all=False):
    print("=" * 60)
    print(f"Connecting to SFTP server: {host}:{port}")
    print(f"Username: {username}")
    print("=" * 60)

    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=username, password=password)
        sftp = paramiko.SFTPClient.from_transport(transport)
        print("[+] SFTP Authentication SUCCESSFUL!\n")
    except Exception as e:
        print(f"[-] Authentication failed: {e}")
        return False

    try:
        # 1. List remote root files
        root_items = sftp.listdir(".")
        print(f"[*] Remote Root Directory contains {len(root_items)} items:")
        print("    " + ", ".join(root_items[:15]) + ("..." if len(root_items) > 15 else ""))

        # Check server type
        has_plugins = "plugins" in root_items
        if not has_plugins:
            print("[*] Creating 'plugins' directory...")
            sftp.mkdir("plugins")

        # 2. Check server.properties if exists
        if "server.properties" in root_items:
            try:
                with sftp.open("server.properties", "r") as f:
                    props = f.read().decode("utf-8", errors="ignore")
                    print("\n[*] Detected server.properties summary:")
                    for line in props.splitlines():
                        if any(k in line for k in ["online-mode", "server-port", "motd", "difficulty"]):
                            print(f"    {line}")
            except Exception as e:
                print(f"[!] Could not read server.properties: {e}")

        # Paths to local plugins
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        minecraft_tools = os.path.join(base_dir, "tools", "minecraft")
        local_plugins_dir = os.path.join(base_dir, "tools", "local-mc-server", "plugins")

        # 3. Upload BattlepieLink.jar
        battlepie_jar = os.path.join(minecraft_tools, "BattlepieLink.jar")
        if os.path.exists(battlepie_jar):
            print(f"\n[*] Uploading BattlepieLink.jar ({os.path.getsize(battlepie_jar)} bytes)...")
            sftp.put(battlepie_jar, "plugins/BattlepieLink.jar")
            print("[+] BattlepieLink.jar uploaded successfully!")
        else:
            print(f"[-] Error: {battlepie_jar} not found!")

        # 4. Upload & Configure plugins/BattlepieLink/config.yml
        try:
            sftp.mkdir("plugins/BattlepieLink")
        except IOError:
            pass  # Directory already exists

        link_api_endpoint = backend_url.rstrip("/") + "/api/auth/link/ingame"
        config_content = f"""# BattlepieLink Plugin Configuration
# Set api-url to your web server (e.g. Render backend or localtunnel)
api-url: "{link_api_endpoint}"

# Server secret token to authenticate requests from your Minecraft server to the website backend
server-secret: "battlepie_secret_token_123"
"""
        with sftp.open("plugins/BattlepieLink/config.yml", "w") as f:
            f.write(config_content)
        print(f"[+] plugins/BattlepieLink/config.yml written with endpoint: {link_api_endpoint}")

        # 5. Upload essential QoL plugins: SkinsRestorer, ViaVersion
        plugins_to_upload = [
            ("SkinsRestorer.jar", "Skins for cracked and premium players"),
            ("ViaVersion-5.2.1.jar", "Allows newer client versions to join"),
            ("ViaBackwards-5.2.1.jar", "Allows older client versions to join"),
            ("ViaRewind-3.0.7.jar", "1.7/1.8 compatibility support"),
        ]

        if upload_all:
            plugins_to_upload.extend([
                ("Geyser-Spigot.jar", "Bedrock / Mobile crossplay support"),
                ("Floodgate-Spigot.jar", "Bedrock authentication support"),
            ])

        print("\n[*] Checking QoL plugins to install:")
        for plugin_name, desc in plugins_to_upload:
            local_path = os.path.join(local_plugins_dir, plugin_name)
            remote_path = f"plugins/{plugin_name}"
            if os.path.exists(local_path):
                print(f"    - Uploading {plugin_name} ({desc})...")
                sftp.put(local_path, remote_path)
                print(f"      -> {plugin_name} uploaded!")
            else:
                print(f"    - Notice: {plugin_name} not found locally at {local_path}")

        print("\n" + "=" * 60)
        print("[SUCCESS] All files and configurations deployed to your Minecraft Server!")
        print("=" * 60)
        print("NEXT STEPS:")
        print("1. Go to your MineOrange panel dashboard.")
        print("2. Click 'Restart' or run '/reload confirm' on your Minecraft server.")
        print("3. In-game, join 'Node1.mineorange.fun:25569' and type: /link <your-code>")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"[-] Error during SFTP operations: {e}")
        return False
    finally:
        sftp.close()
        transport.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy BattlepieLink and plugins to Minecraft server via SFTP")
    parser.add_argument("--password", "-p", help="SFTP / Panel password", default=None)
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--user", "-u", default=DEFAULT_USER)
    parser.add_argument("--backend-url", default="http://localhost:3000", help="Web backend URL for linking API")
    parser.add_argument("--all", action="store_true", help="Upload Geyser/Bedrock plugins too")
    args = parser.parse_args()

    pwd = args.password or os.environ.get("SFTP_PASSWORD")
    if not pwd:
        print(f"Server: {args.host}:{args.port}")
        print(f"Username: {args.user}")
        pwd = getpass.getpass("Enter your MineOrange Panel / SFTP Password: ")

    if not pwd:
        print("Error: Password is required.")
        sys.exit(1)

    success = deploy(pwd, host=args.host, port=args.port, username=args.user, backend_url=args.backend_url, upload_all=args.all)
    sys.exit(0 if success else 1)
