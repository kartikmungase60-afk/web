import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('Node1.mineorange.fun', port=2022, username='master.006427ba', password='Kartik@1234')
sftp = client.open_sftp()

# Remove old/duplicate scripts to avoid /link command conflicts
for old in ['BattlepieLink.sk', 'BattlepieLink_reflect.sk', '-BattlepieLink.sk', '-BattlepieLink_reflect.sk']:
    try:
        sftp.remove('plugins/Skript/scripts/' + old)
    except Exception:
        pass

# Disable Java plugin to prevent Bukkit command conflict with Skript /link
try:
    sftp.rename('plugins/BattlepieLink.jar', 'plugins/BattlepieLink.jar.disabled')
    print('Disabled BattlepieLink.jar (renamed to .disabled) so Skript owns /link cleanly')
except Exception as e:
    pass

# Upload single clean link.sk
sftp.put('tools/minecraft/BattlepieLink_reflect.sk', 'plugins/Skript/scripts/link.sk')

print('=== Active Skript scripts in plugins/Skript/scripts/ ===')
for f in sftp.listdir('plugins/Skript/scripts'):
    print(' -', f)

print('=== Server plugins ===')
for f in sftp.listdir('plugins'):
    if f.endswith('.jar') or f.endswith('.disabled'):
        print(' -', f)

sftp.close()
client.close()
print('Clean Skript deployment complete!')
