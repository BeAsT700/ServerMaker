import os
import json
import subprocess
import threading
import time
import requests
import shutil
import glob
from datetime import datetime
import nbtlib


SERVERS_DIR = 'servers'
BACKUPS_DIR = 'backups'
DATA_DIR = 'data'
SERVERS_JSON = os.path.join(DATA_DIR, 'servers.json')

# Global dictionary to store running processes: {server_id: {'process': subprocess.Popen, 'log': []}}
RUNNING_SERVERS = {}


_public_ip_cache = None

def get_public_ip():
    global _public_ip_cache
    if _public_ip_cache:
        return _public_ip_cache
    
    try:
        response = requests.get('https://api.ipify.org', timeout=3)
        if response.status_code == 200:
            _public_ip_cache = response.text
            return _public_ip_cache
    except:
        pass
    
    return '127.0.0.1'


def load_servers():
    if not os.path.exists(SERVERS_JSON):
        return []
    with open(SERVERS_JSON, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def save_servers(servers):
    with open(SERVERS_JSON, 'w', encoding='utf-8') as f:
        json.dump(servers, f, indent=4)

def get_server_by_id(server_id):
    servers = load_servers()
    for s in servers:
        if s['id'] == server_id:
            return s
    return None

def get_server_dir(server_id):
    server = get_server_by_id(server_id)
    if server and server.get('path'):
        return server['path']
    return os.path.join(SERVERS_DIR, str(server_id))

def download_vanilla_core(version, server_dir):
    try:
        manifest_url = "https://piston-meta.mojang.com/mc/game/version_manifest.json"
        manifest = requests.get(manifest_url).json()
        version_url = next((v['url'] for v in manifest['versions'] if v['id'] == version), None)
        
        if version_url:
            version_data = requests.get(version_url).json()
            download_url = version_data['downloads']['server']['url']
            
            print(f"Downloading vanilla server core from {download_url}...")
            r = requests.get(download_url, stream=True)
            jar_path = os.path.join(server_dir, 'server.jar')
            with open(jar_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=1024):
                    if chunk:
                        f.write(chunk)
            return True
    except Exception as e:
        print(f"Error fetching vanilla version info: {e}")
        with open(os.path.join(server_dir, 'install_error.log'), 'a') as f:
            f.write(str(e) + "\n")
        return False

def create_backup(server_id, backup_name):
    server_dir = get_server_dir(server_id)
    if not os.path.exists(server_dir):
        return False, "Server not found"
    
    backup_base_dir = os.path.join(BACKUPS_DIR, str(server_id))
    os.makedirs(backup_base_dir, exist_ok=True)
    
    safe_name = "".join([c for c in backup_name if c.isalpha() or c.isdigit() or c in (' ', '-', '_')]).rstrip()
    if not safe_name:
        safe_name = f"backup_{int(time.time())}"
        
    backup_path = os.path.join(backup_base_dir, safe_name) # shutil.make_archive adds extension

    try:
        shutil.make_archive(backup_path, 'zip', server_dir)
        return True, f"Backup {safe_name}.zip created successfully"
    except Exception as e:
        return False, str(e)

def list_backups(server_id):
    backup_base_dir = os.path.join(BACKUPS_DIR, str(server_id))
    if not os.path.exists(backup_base_dir):
        return []
    
    backups = []
    for f in os.listdir(backup_base_dir):
        if f.endswith('.zip'):
            path = os.path.join(backup_base_dir, f)
            stat = os.stat(path)
            backups.append({
                'name': f,
                'size': stat.st_size,
                'created': stat.st_mtime
            })
    
    backups.sort(key=lambda x: x['created'], reverse=True)
    return backups

def delete_backup(server_id, backup_name):
    backup_path = os.path.join(BACKUPS_DIR, str(server_id), backup_name)
    if os.path.dirname(os.path.abspath(backup_path)) != os.path.abspath(os.path.join(BACKUPS_DIR, str(server_id))):
        return False
    
    if os.path.exists(backup_path):
        os.remove(backup_path)
        return True
    return False

def save_uploaded_backup(server_id, file_storage):
    backup_base_dir = os.path.join(BACKUPS_DIR, str(server_id))
    os.makedirs(backup_base_dir, exist_ok=True)
    
    filename = file_storage.filename
    if not filename.endswith('.zip'):
        return False, "Only .zip files are allowed"
        
    safe_name = "".join([c for c in filename if c.isalpha() or c.isdigit() or c in (' ', '-', '_', '.')]).rstrip()
    
    save_path = os.path.join(backup_base_dir, safe_name)
    try:
        file_storage.save(save_path)
        return True, "Backup uploaded successfully"
    except Exception as e:
        return False, str(e)

def restore_backup(server_id, backup_name):
    server_dir = get_server_dir(server_id)
    backup_path = os.path.join(BACKUPS_DIR, str(server_id), backup_name)
    
    if not os.path.exists(backup_path):
        return False, "Backup file not found"
        
    status = get_server_status(server_id)
    if status != 'stopped':
        return False, "Server must be stopped to restore backup"
    
    try:
        for item in os.listdir(server_dir):
            path = os.path.join(server_dir, item)
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
        
        shutil.unpack_archive(backup_path, server_dir, 'zip')
        return True, "Backup restored successfully"
    except Exception as e:
        return False, f"Restore failed: {str(e)}"

def install_fabric(version, server_dir):
    """
    Installs Fabric for the given MC version.
    1. Downloads Vanilla server.jar (Required by Fabric).
    2. Downloads fabric-installer.
    3. Runs installer to generate fabric-server-launch.jar.
    4. Configures fabric to use vanilla.jar (renamed).
    5. Sets up entry point.
    """
    try:
        # 1. Download Vanilla Core First (Critical for Fabric to find it)
        if not download_vanilla_core(version, server_dir):
             raise Exception("Failed to download vanilla core")
             
        # 2. Get installer version
        meta_url = "https://meta.fabricmc.net/v2/versions/installer"
        installers = requests.get(meta_url).json()
        if not installers:
            raise Exception("No Fabric installers found")
        
        latest_installer = installers[0]['url']
        installer_path = os.path.join(server_dir, 'fabric-installer.jar')
        
        print(f"Downloading Fabric Installer from {latest_installer}...")
        r = requests.get(latest_installer)
        with open(installer_path, 'wb') as f:
            f.write(r.content)
            
        # 3. Runs installer
        # Command: java -jar fabric-installer.jar server -mcversion <ver>
        # Note: We do NOT use -downloadMinecraft because we downloaded it manually above to ensure it exists.
        cmd = ['java', '-jar', 'fabric-installer.jar', 'server', '-mcversion', version]
        print(f"Running Fabric Installer: {' '.join(cmd)}")
        
        subprocess.check_output(cmd, cwd=server_dir, stderr=subprocess.STDOUT)
        
        # Cleanup installer
        if os.path.exists(installer_path):
            os.remove(installer_path)
            
        # 4. Handle files
        fabric_jar = os.path.join(server_dir, 'fabric-server-launch.jar')
        vanilla_jar = os.path.join(server_dir, 'server.jar')
        
        if os.path.exists(fabric_jar):
            # We need to preserve the vanilla jar but rename it so we can name the fabric loader 'server.jar'
            
            if os.path.exists(vanilla_jar):
                new_vanilla_name = 'vanilla.jar'
                new_vanilla_path = os.path.join(server_dir, new_vanilla_name)
                
                if os.path.exists(new_vanilla_path):
                    os.remove(new_vanilla_path)
                
                # Check if installer already renamed or did something (unlikely with just 'server' command)
                os.rename(vanilla_jar, new_vanilla_path)
                
                # Create/Update fabric-server-launcher.properties to point to the new vanilla jar location
                props_path = os.path.join(server_dir, 'fabric-server-launcher.properties')
                with open(props_path, 'w') as f:
                    f.write(f"serverJar={new_vanilla_name}\n")
            else:
                 # If vanilla jar is missing now, something is wrong
                 pass
            
            # Now we can safely rename fabric launch jar to server.jar
            target_jar = os.path.join(server_dir, 'server.jar')
            if os.path.exists(target_jar):
                os.remove(target_jar) 
                
            os.rename(fabric_jar, target_jar)
            return True
        else:
            raise Exception("Fabric installer did not generate fabric-server-launch.jar")
            
    except Exception as e:
        print(f"Fabric Installation Error: {e}")
        with open(os.path.join(server_dir, 'install_error.log'), 'a') as f:
            f.write(str(e))
        return False

def install_forge(version, server_dir):
    """
    Installs Forge for the given MC version.
    """
    try:
        # 1. Get Forge Version
        # This is non-trivial without scraping.
        # We try to use a constructed URL for "Recommended" build or "Latest".
        # URL Format: https://maven.minecraftforge.net/net/minecraftforge/forge/{mc}-{forge}/forge-{mc}-{forge}-installer.jar
        
        # Helper to find forge version.
        promotions_url = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json"
        promos = requests.get(promotions_url).json()
        promos = promos.get('promos', {})
        
        forge_version = promos.get(f"{version}-recommended") or promos.get(f"{version}-latest")
        
        if not forge_version:
             # Fallback: sometimes the key is different or user picked a version not in promos
             raise Exception(f"Could not find a recommended Forge version for Minecraft {version}")

        full_version = f"{version}-{forge_version}"
        installer_url = f"https://maven.minecraftforge.net/net/minecraftforge/forge/{full_version}/forge-{full_version}-installer.jar"
        
        installer_path = os.path.join(server_dir, 'forge-installer.jar')
        
        print(f"Downloading Forge Installer {full_version}...")
        r = requests.get(installer_url)
        if r.status_code != 200:
             raise Exception(f"Failed to download installer from {installer_url} (Status {r.status_code})")
             
        with open(installer_path, 'wb') as f:
            f.write(r.content)
            
        # 2. Run Installer
        # Command: java -jar forge-installer.jar --installServer
        cmd = ['java', '-jar', 'forge-installer.jar', '--installServer']
        print(f"Running Forge Installer: {' '.join(cmd)}")
        
        # This can take a while and produce lots of output.
        subprocess.check_output(cmd, cwd=server_dir, stderr=subprocess.STDOUT)
        
        # 3. Cleanup
        if os.path.exists(installer_path):
            os.remove(installer_path)
        # Remove installer log if wanted, but might be useful
        
        # 4. Handle Jar naming
         # Modern forge (1.17+) creates run.bat/sh and specific jar logic.
         # Older forge creates forge-1.12.2-....universal.jar
         # We need to find the jar that acts as the entry point or standard rename.
         
         # Strategy: Search for .jar files that are NOT libraries.
         # On 1.17+, the "server jar" is basically a wrapper.
         # Let's try to look for forge-{version}.jar or {version}.jar
         
         # Check for run.bat/run.sh indicating new unix args style
        is_modern = os.path.exists(os.path.join(server_dir, 'run.sh')) or os.path.exists(os.path.join(server_dir, 'run.bat')) or os.path.exists(os.path.join(server_dir, 'user_jvm_args.txt'))

        if is_modern:
            # We need to copy/rename the correct forge jar to server.jar?
            # Actually modern forge expects us to run the specific jar with libraries in classpath.
            # But the requirement says "Use java -jar server.jar".
            # For 1.17+ 'java -jar server.jar' generally only works if the manifest is setup right.
            # The installer usually generates a tiny shim jar or expects you to use the arguments file.
            
            # WORKAROUND for MVP:
            # We look for the main forge jar.
            # files = glob.glob(os.path.join(server_dir, f"forge-{version}-*.jar"))
            # If we find it, we rename to server.jar.
            # But we must ensure libraries are found.
            pass

        # Generic find jar logic
        jars = glob.glob(os.path.join(server_dir, "*.jar"))
        server_jar = None
        for j in jars:
            name = os.path.basename(j)
            if "forge" in name and "installer" not in name:
                server_jar = j
                break
        
        if server_jar:
            target = os.path.join(server_dir, 'server.jar')
            if os.path.exists(target):
                os.remove(target)
            os.rename(server_jar, target)
        else:
             raise Exception("Could not identify the Forge server jar after installation.")

    except Exception as e:
        print(f"Forge Installation Error: {e}")
        with open(os.path.join(server_dir, 'install_error.log'), 'w') as f:
            f.write(str(e))
        return False

def create_server(name, core, version, ram, eula=True, custom_path=None):
    servers = load_servers()
    server_id = str(int(time.time()))
    
    if custom_path and custom_path.strip():
        server_dir = custom_path.strip()
    else:
        server_dir = os.path.join(SERVERS_DIR, server_id)
    
    if not os.path.exists(server_dir):
        os.makedirs(server_dir)
    
    new_server = {
        'id': server_id,
        'name': name,
        'core': core,
        'version': version,
        'ram': ram,
        'port': 25565 + len(servers),
        'created_at': str(datetime.now()),
        'path': server_dir
    }
    
    download_url = None
    jar_name = 'server.jar'

    if core == 'Vanilla':
        download_vanilla_core(version, server_dir)

    elif core == 'Fabric':
        install_fabric(version, server_dir)

    elif core == 'Forge':
        install_forge(version, server_dir)

    with open(os.path.join(server_dir, 'eula.txt'), 'w') as f:
        f.write(f"eula={'true' if eula else 'false'}")

    props_content = f"server-port={new_server['port']}\nmotd=A Minecraft Server created with ServerMaker\n"
    with open(os.path.join(server_dir, 'server.properties'), 'w') as f:
        f.write(props_content)

    servers.append(new_server)
    save_servers(servers)
    return server_id

def log_reader(server_id, pipe):
    """Reads output from the process and appends to the log buffer."""
    for line in iter(pipe.readline, b''):
        line_str = line.decode('utf-8', errors='ignore')
        if server_id in RUNNING_SERVERS:
            RUNNING_SERVERS[server_id]['log'].append(line_str)
    pipe.close()

def start_server(server_id):
    if server_id in RUNNING_SERVERS and RUNNING_SERVERS[server_id]['process'].poll() is None:
        return False, "Server is already running"

    server = get_server_by_id(server_id)
    if not server:
        return False, "Server not found"

    server_dir = get_server_dir(server_id)
    jar_path = os.path.join(server_dir, 'server.jar')
    
    if not os.path.exists(jar_path):
        return False, "server.jar not found"

    logs_dir = os.path.join(server_dir, 'logs')
    latest_log = os.path.join(logs_dir, 'latest.log')
    if os.path.exists(latest_log):
        try:
            os.remove(latest_log)
        except:
            pass

    ram = server.get('ram', '1024')
    cmd = ['java', f'-Xmx{ram}M', f'-Xms{ram}M', '-jar', 'server.jar', 'nogui']
    
    try:
        startupinfo = None
        if os.name == 'nt' and os.environ.get('RUN_FROM_BAT') == 'true':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

        process = subprocess.Popen(
            cmd,
            cwd=server_dir,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            shell=False,
            startupinfo=startupinfo
        )
        
        RUNNING_SERVERS[server_id] = {
            'process': process,
            'log': []
        }
        
        t = threading.Thread(target=log_reader, args=(server_id, process.stdout))
        t.daemon = True
        t.start()
        
        return True, "Server started"
    except Exception as e:
        return False, str(e)

def stop_server(server_id):
    if server_id not in RUNNING_SERVERS:
        return False, "Server is not running"
    
    proc_info = RUNNING_SERVERS[server_id]
    process = proc_info['process']
    
    if process.poll() is None:
        try:
            process.stdin.write(b"stop\n")
            process.stdin.flush()
        except Exception:
            process.terminate()
    
    return True, "Stop command sent"

def send_command(server_id, command):
    if server_id not in RUNNING_SERVERS:
        return False, "Server is not running"
        
    proc_info = RUNNING_SERVERS[server_id]
    process = proc_info['process']
    
    if process.poll() is not None:
        return False, "Server process has exited"
        
    try:
        process.stdin.write((command + "\n").encode('utf-8'))
        process.stdin.flush()
        return True, "Command sent"
    except Exception as e:
        return False, str(e)

def get_server_status(server_id):
    if server_id in RUNNING_SERVERS:
        proc = RUNNING_SERVERS[server_id]['process']
        if proc.poll() is None:
            return 'running'
        else:
            return 'stopped'
    return 'stopped'

def get_logs(server_id):
    if server_id in RUNNING_SERVERS:
        return "".join(RUNNING_SERVERS[server_id]['log'])
    
    return ""

def _get_online_players_list(server_id):
    """
    Sends /list and parses logs to find online players.
    Returns a list of player names.
    """
    if server_id not in RUNNING_SERVERS:
        return []
        
    proc_info = RUNNING_SERVERS[server_id]
    log_list = proc_info['log']
    
    start_index = len(log_list)
    
    # Send /list directly
    try:
        proc_info['process'].stdin.write(b"list\n")
        proc_info['process'].stdin.flush()
    except:
        return []
        
    # Wait for response (up to 1 sec)
    for _ in range(10): 
        time.sleep(0.1)
        # Check new logs
        current_logs = log_list[start_index:]
        for line in current_logs:
            if "players online:" in line:
                # Example: "... There are 1 of 20 players online: PlayerName, Player2"
                try:
                    parts = line.split("players online:")
                    if len(parts) > 1:
                        names_str = parts[1].strip()
                        if not names_str:
                            return []
                        names = [n.strip() for n in names_str.split(',')]
                        return [n for n in names if n] # Filter empty
                except:
                    pass
    return []

def load_properties(server_id):
    server_dir = get_server_dir(server_id)
    props_path = os.path.join(server_dir, 'server.properties')
    properties = {}
    if os.path.exists(props_path):
        with open(props_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    # Handle Java Properties escaping (e.g. \u041f)
                    try:
                        # Only unescape if we see potential escape sequences to avoid corrupting existing UTF-8
                        if '\\u' in value:
                            value = value.encode('utf-8').decode('unicode_escape')
                    except Exception:
                        pass
                    properties[key] = value
    return properties

def save_properties_file(server_id, properties):
    server_dir = get_server_dir(server_id)
    props_path = os.path.join(server_dir, 'server.properties')

    lines = []
    # Write with encoding that supports raw unicode chars if we missed any, 
    # but we will try to escape them for Java compatibility.
    with open(props_path, 'w', encoding='utf-8') as f:
        f.write("# Minecraft server properties\n")
        f.write(f"# {str(datetime.now())}\n")
        for k, v in properties.items():
            # Escape non-ASCII for Minecraft/Java compatibility
            # encode('unicode_escape') keeps ASCII as is, changes others to \uXXXX
            val_str = str(v)
            try:
                escaped_val = val_str.encode('unicode_escape').decode('ascii')
            except:
                escaped_val = val_str # Fallback
            
            f.write(f"{k}={escaped_val}\n")
def delete_server(server_id):
    servers = load_servers()
    server = next((s for s in servers if s['id'] == server_id), None)
    
    if not server:
        return False, "Server not found"
        
    # Check if running
    if server_id in RUNNING_SERVERS and RUNNING_SERVERS[server_id]['process'].poll() is None:
        return False, "Cannot delete running server. Stop it first."
        
    # Remove from list
    servers = [s for s in servers if s['id'] != server_id]
    save_servers(servers)
    
    # Delete folder
    # We use server['path'] if available, or fall back to standard location
    server_dir = server.get('path', os.path.join(SERVERS_DIR, server_id))
    
    if os.path.exists(server_dir):
        try:
            shutil.rmtree(server_dir)
        except Exception as e:
            return False, f"Server removed from list but failed to delete files: {e}"
            
    return True, "Server deleted successfully"

def list_server_files(server_id, subpath=''):
    server = get_server_by_id(server_id)
    if not server:
        return []
        
    server_dir = get_server_dir(server_id)
    target_dir = os.path.join(server_dir, subpath)
    
    if not os.path.abspath(target_dir).startswith(os.path.abspath(server_dir)):
        return []

    if not os.path.exists(target_dir):
        return []

    items = []
    for entry in os.scandir(target_dir):
        items.append({
            'name': entry.name,
            'is_dir': entry.is_dir(),
            'size': entry.stat().st_size if not entry.is_dir() else 0
        })

    items.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))
    
    return items

def delete_server_file(server_id, filepath):
    server = get_server_by_id(server_id)
    if not server:
        return False
        
    server_dir = get_server_dir(server_id)
    target_path = os.path.join(server_dir, filepath)
    
    if not os.path.abspath(target_path).startswith(os.path.abspath(server_dir)):
        return False
        
    if os.path.exists(target_path):
        if os.path.isdir(target_path):
            shutil.rmtree(target_path)
        else:
            os.remove(target_path)
        return True
    return False

def read_file_content(server_id, filepath):
    server = get_server_by_id(server_id)
    if not server: return None, "Server not found"
    
    server_dir = get_server_dir(server_id)
    target_path = os.path.join(server_dir, filepath)
    
    if not os.path.abspath(target_path).startswith(os.path.abspath(server_dir)):
        return None, "Access denied"
        
    if not os.path.exists(target_path) or not os.path.isfile(target_path):
        return None, "File not found"
        
    try:
        with open(target_path, 'r', encoding='utf-8') as f:
            return f.read(), None
    except UnicodeDecodeError:
        try:
            with open(target_path, 'r', encoding='latin-1') as f:
                return f.read(), None
        except Exception as e:
            return None, str(e)
    except Exception as e:
        return None, str(e)

def write_file_content(server_id, filepath, content):
    server = get_server_by_id(server_id)
    if not server: return False, "Server not found"
    
    server_dir = get_server_dir(server_id)
    target_path = os.path.join(server_dir, filepath)
    
    if not os.path.abspath(target_path).startswith(os.path.abspath(server_dir)):
        return False, "Access denied"
        
    try:
        with open(target_path, 'w', encoding='utf-8') as f:
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            f.write(content)
        return True, "Saved"
    except Exception as e:
        return False, str(e)

def get_known_players(server_id):
    server_dir = get_server_dir(server_id)
    cache_path = os.path.join(server_dir, 'usercache.json')
    ops_path = os.path.join(server_dir, 'ops.json')
    
    players = []
    
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                players = json.load(f)
        except Exception:
            players = []
    
    props = load_properties(server_id)
    level_name = props.get('level-name', 'world')
    if not os.path.exists(os.path.join(server_dir, level_name)) and os.path.exists(os.path.join(server_dir, 'world')):
        level_name = 'world'
        
    playerdata_dir = os.path.join(server_dir, level_name, 'playerdata')
    known_uuids = {p['uuid'] for p in players}
    
    if os.path.exists(playerdata_dir):
        for entry in os.scandir(playerdata_dir):
            if entry.name.endswith('.dat'):
                uuid = entry.name[:-4] # remove .dat
                if uuid not in known_uuids:
                    # We found a player who visited but isn't in cache (maybe old, or cracked server)
                    # We don't know the name easily without cache or NBT parsing
                    # Let's try to get name from NBT if possible using nbtlib
                    p_name = f"Unknown ({uuid[:4]}...)"
                    try:
                        # Try to read 'bukkit' -> 'lastKnownName' if available (modded/bukkit)
                        # Vanilla NBT doesn't store name. 
                        pass
                    except:
                        pass
                        
                    players.append({
                        'name': p_name,
                        'uuid': uuid,
                        'expiresOn': 'never'
                    })
                    known_uuids.add(uuid)

    ops = []
    if os.path.exists(ops_path):
        try:
            with open(ops_path, 'r', encoding='utf-8') as f:
                ops_data = json.load(f)
                ops = [o['uuid'] for o in ops_data]
        except:
            pass
            
    online_names = _get_online_players_list(server_id)
    
    for p in players:
        p['op'] = p['uuid'] in ops
        p['online'] = p['name'] in online_names
    
    known_names = {p['name'] for p in players}
    for name in online_names:
        if name not in known_names:
            players.append({
                'name': name,
                'uuid': 'online-no-cache',
                'op': False, # Can't check easily without UUID match
                'online': True
            })
        
    return players

def op_player(server_id, nickname):
    if server_id in RUNNING_SERVERS:
        res, msg = send_command(server_id, f"op {nickname}")
        
        props = load_properties(server_id)
        if props.get('white-list', 'false') == 'true':
            send_command(server_id, f"whitelist add {nickname}")
            msg += " (Added to whitelist)"
            
        return res, msg
    else:
        return False, "Server must be running to OP player (command requires online server)"

def kick_player(server_id, nickname, reason="Kicked by admin"):
    if server_id in RUNNING_SERVERS:
        return send_command(server_id, f"kick {nickname} {reason}")
    return False, "Server must be running"

def ban_player(server_id, nickname, reason="Banned by admin"):
    if server_id in RUNNING_SERVERS:
        return send_command(server_id, f"ban {nickname} {reason}")
    return False, "Server must be running"

def unban_player(server_id, nickname):
    if server_id in RUNNING_SERVERS:
        return send_command(server_id, f"pardon {nickname}")
    return False, "Server must be running"

def whitelist_remove(server_id, nickname):
    if server_id in RUNNING_SERVERS:
        return send_command(server_id, f"whitelist remove {nickname}")
    return False, "Server must be running"

def whitelist_add(server_id, nickname):
    if server_id in RUNNING_SERVERS:
        return send_command(server_id, f"whitelist add {nickname}")
    return False, "Server must be running"

def get_player_lists_status(server_id, uuid, name):
    server_dir = get_server_dir(server_id)
    
    is_whitelisted = False
    is_banned = False
    is_op = False
    
    wl_path = os.path.join(server_dir, 'whitelist.json')
    if os.path.exists(wl_path):
        try:
            with open(wl_path, 'r') as f:
                wl = json.load(f)
                for entry in wl:
                    if (uuid and entry.get('uuid') == uuid) or (name and entry.get('name', '').lower() == name.lower()):
                        is_whitelisted = True
                        break
        except: pass

    ban_path = os.path.join(server_dir, 'banned-players.json')
    if os.path.exists(ban_path):
        try:
            with open(ban_path, 'r') as f:
                bans = json.load(f)
                for entry in bans:
                    if (uuid and entry.get('uuid') == uuid) or (name and entry.get('name', '').lower() == name.lower()):
                        is_banned = True
                        break
        except: pass

    ops_path = os.path.join(server_dir, 'ops.json')
    if os.path.exists(ops_path):
        try:
            with open(ops_path, 'r') as f:
                ops = json.load(f)
                for entry in ops:
                    if (uuid and entry.get('uuid') == uuid) or (name and entry.get('name', '').lower() == name.lower()):
                        is_op = True
                        break
        except: pass
        
    return {'whitelisted': is_whitelisted, 'banned': is_banned, 'op': is_op}

def get_player_data(server_id, uuid):
    server = get_server_by_id(server_id)
    if not server: return None
    
    server_dir = get_server_dir(server_id)
    
    # Need to find the world folder. Usually "world" but defined in properties.
    props = load_properties(server_id)
    level_name = props.get('level-name', 'world')
    
    if not os.path.exists(os.path.join(server_dir, level_name)):
         if os.path.exists(os.path.join(server_dir, 'world')):
             level_name = 'world'

    player_file = os.path.join(server_dir, level_name, 'playerdata', f"{uuid}.dat")
    
    if not os.path.exists(player_file):
        return {'error': 'Player data file not found (Player has not saved data yet)'}
        
    try:
        nbt_file = nbtlib.load(player_file)
        root = nbt_file
        
        data = {}
        
        data['Health'] = float(root.get('Health', 0))
        data['foodLevel'] = int(root.get('foodLevel', 0))
        data['foodSaturationLevel'] = float(root.get('foodSaturationLevel', 0))
        data['foodExhaustionLevel'] = float(root.get('foodExhaustionLevel', 0))

        data['XpLevel'] = int(root.get('XpLevel', 0))
        data['XpTotal'] = int(root.get('XpTotal', 0))
        data['XpP'] = float(root.get('XpP', 0))
        data['Score'] = int(root.get('Score', 0))

        data['Air'] = int(root.get('Air', 300))
        data['AbsorptionAmount'] = float(root.get('AbsorptionAmount', 0))
        data['SleepTimer'] = int(root.get('SleepTimer', 0))
        
        pos_list = root.get('Pos', [])
        if pos_list and len(pos_list) >= 3:
            data['Pos'] = [float(x) for x in pos_list] # X, Y, Z
        else:
            data['Pos'] = [0, 0, 0]

        motion_list = root.get('Motion', [])
        if motion_list and len(motion_list) >= 3:
            data['Motion'] = [float(x) for x in motion_list]
        else:
            data['Motion'] = [0, 0, 0]
            
        rot_list = root.get('Rotation', [])
        if rot_list and len(rot_list) >= 2:
            data['Rotation'] = [float(x) for x in rot_list]
        else:
            data['Rotation'] = [0, 0]
            
        data['Dimension'] = str(root.get('Dimension', 'Unknown'))
        
        gm_map = {0: 'Survival', 1: 'Creative', 2: 'Adventure', 3: 'Spectator'}
        gm_id = int(root.get('playerGameType', 0))
        data['GameMode'] = gm_map.get(gm_id, f'Unknown ({gm_id})')
        
        abilities = root.get('abilities', {})
        data['Abilities'] = {
            'walkSpeed': float(abilities.get('walkSpeed', 0.1)),
            'flySpeed': float(abilities.get('flySpeed', 0.05)),
            'mayfly': bool(abilities.get('mayfly', False)),
            'flying': bool(abilities.get('flying', False)),
            'invulnerable': bool(abilities.get('invulnerable', False)),
            'instabuild': bool(abilities.get('instabuild', False))
        }
        
        active_effects = []
        raw_effects = root.get('ActiveEffects', [])
        
        effect_map = {
            1: 'Speed', 2: 'Slowness', 3: 'Haste', 4: 'Mining Fatigue', 5: 'Strength',
            6: 'Instant Health', 7: 'Instant Damage', 8: 'Jump Boost', 9: 'Nausea', 10: 'Regeneration',
            11: 'Resistance', 12: 'Fire Resistance', 13: 'Water Breathing', 14: 'Invisibility', 15: 'Blindness',
            16: 'Night Vision', 17: 'Hunger', 18: 'Weakness', 19: 'Poison', 20: 'Wither',
            21: 'Health Boost', 22: 'Absorption', 23: 'Saturation', 24: 'Glowing', 25: 'Levitation',
            26: 'Luck', 27: 'Bad Luck', 28: 'Slow Falling', 29: 'Conduit Power', 30: 'Dolphins Grace',
            31: 'Bad Omen', 32: 'Hero of the Village', 33: 'Darkness'
        }

        for eff in raw_effects:
            eid = int(eff.get('Id', 0))
            ampl = int(eff.get('Amplifier', 0))
            dur = int(eff.get('Duration', 0))
            
            total_seconds = dur // 20
            mins = total_seconds // 60
            secs = total_seconds % 60
            time_str = f"{mins:02}:{secs:02}"
            if dur == -1 or dur > 160000:
                time_str = "∞"

            active_effects.append({
                'id': eid,
                'name': effect_map.get(eid, f'Effect {eid}'),
                'amplifier': ampl + 1,
                'duration': time_str,
                'is_ambient': bool(eff.get('Ambient', 0))
            })
            
        data['ActiveEffects'] = active_effects
        
        def parse_inv(inv_list):
            items = []
            for item in inv_list:
                item_id = str(item.get('id', 'minecraft:air'))
                count = int(item.get('Count', 0))
                if item_id.startswith('minecraft:'):
                    item_id = item_id.split(':', 1)[1]
                items.append({
                    'id': item_id,
                    'Count': count,
                    'Slot': int(item.get('Slot', 0))
                })
            return items

        data['Inventory'] = parse_inv(root.get('Inventory', []))
        data['EnderItems'] = parse_inv(root.get('EnderItems', []))
        
        status = get_player_lists_status(server_id, uuid, None)
        data.update(status)

        return data
        
    except Exception as e:
        print(f"Error reading NBT: {e}")
        return {'error': f"Failed to read NBT: {str(e)}"}


def update_server_config(server_id, port, ram):
    servers = load_servers()
    updated = False
    for s in servers:
        if s['id'] == server_id:
            s['port'] = int(port)
            s['ram'] = int(ram)
            updated = True
            break
    
    if updated:
        save_servers(servers)
        
        try:
            props = load_properties(server_id)
            props['server-port'] = str(port)
            save_properties_file(server_id, props)
        except Exception as e:
            print(f"Error updating properties: {e}")
            return False
            
        return True
    return False

def teleport_player(server_id, player, target):
    cmd = f"tp {player} {target}"
    return send_command(server_id, cmd)

def give_effect(server_id, player, effect, duration, amplifier):
    if effect == 'minecraft:clear' or effect == 'clear':
        cmd = f"effect clear {player}"
    else:
        cmd = f"effect give {player} {effect} {duration} {amplifier}"
    return send_command(server_id, cmd)



