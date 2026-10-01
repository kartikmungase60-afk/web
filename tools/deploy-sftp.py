import os
import sys
import paramiko

def deploy():
    print('[SFTP] Connecting to Node1.mineorange.fun:2022...')
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('Node1.mineorange.fun', port=2022, username='master.006427ba', password='Kartik@1234', timeout=20)
    sftp = ssh.open_sftp()
    print('[SFTP] Connected!')

    local_jar = os.path.join(os.path.dirname(__file__), 'minecraft', 'BattlepieLink.jar')
    remote_jar = 'plugins/BattlepieLink.jar'
    size = os.path.getsize(local_jar)
    print(f'[SFTP] Uploading {local_jar} ({size} bytes) -> {remote_jar}...')
    sftp.put(local_jar, remote_jar)
    print('[SFTP] JAR uploaded successfully!')

    # Update config.yml
    config_content = (
        "# BattlepieLink Plugin Configuration\n"
        'api-url: "https://battlepie-backend.onrender.com/api/auth/link/ingame"\n'
        'server-secret: "battlepie_secret_token_123"\n'
    )
    with sftp.open('plugins/BattlepieLink/config.yml', 'w') as f:
        f.write(config_content)
    print('[SFTP] plugins/BattlepieLink/config.yml updated successfully!')

    # List plugins to verify
    plugins = sftp.listdir('plugins')
    print('[SFTP] Remote plugins list:', plugins)

    sftp.close()
    ssh.close()
    print('[SFTP] Deployment finished cleanly.')

if __name__ == '__main__':
    deploy()
