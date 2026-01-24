from flask import Flask, render_template, request, redirect, url_for, jsonify, send_file
import server_manager
import os
import sys
import logging

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

def get_resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath('.'), relative_path)

template_folder = get_resource_path('templates')
static_folder = get_resource_path('static')

app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)

# --- Routes ---

@app.route('/')
def index():
    servers = server_manager.load_servers()
    for s in servers:
        s['status'] = server_manager.get_server_status(s['id'])
    return render_template('index.html', servers=servers)

@app.route('/create', methods=['GET', 'POST'])
def create():
    if request.method == 'POST':
        name = request.form.get('name')
        core = request.form.get('core')
        version = request.form.get('version')
        ram_gb = float(request.form.get('ram', 2))
        ram_mb = int(ram_gb * 1024)
        
        eula_accepted = request.form.get('eula') == 'on'
        custom_path = request.form.get('path')

        server_manager.create_server(name, core, version, ram_mb, eula=eula_accepted, custom_path=custom_path)
        return redirect(url_for('index'))
    return render_template('create.html')

@app.route('/server/<server_id>')
def server_dashboard(server_id):
    server = server_manager.get_server_by_id(server_id)
    if not server:
        return redirect(url_for('index'))
    
    status = server_manager.get_server_status(server_id)
    public_ip = server_manager.get_public_ip()
    return render_template('server.html', server=server, status=status, public_ip=public_ip)

# --- API Endpoints ---

@app.route('/api/status/<server_id>')
def api_status(server_id):
    status = server_manager.get_server_status(server_id)
    return jsonify({'status': status})

@app.route('/api/start/<server_id>', methods=['POST'])
def api_start(server_id):
    success, msg = server_manager.start_server(server_id)
    return jsonify({'success': success, 'message': msg})

@app.route('/api/stop/<server_id>', methods=['POST'])
def api_stop(server_id):
    success, msg = server_manager.stop_server(server_id)
    return jsonify({'success': success, 'message': msg})

@app.route('/api/restart/<server_id>', methods=['POST'])
def api_restart(server_id):
    server_manager.stop_server(server_id)
    import time
    time.sleep(2) 
    success, msg = server_manager.start_server(server_id)
    return jsonify({'success': success, 'message': msg})

@app.route('/api/console/<server_id>', methods=['GET', 'POST'])
def api_console(server_id):
    if request.method == 'POST':
        cmd = request.json.get('command')
        success, msg = server_manager.send_command(server_id, cmd)
        return jsonify({'success': success, 'message': msg})
    else:
        logs = server_manager.get_logs(server_id)
        return jsonify({'logs': logs})

@app.route('/api/files/<server_id>')
def api_files(server_id):
    subpath = request.args.get('path', '')
    files = server_manager.list_server_files(server_id, subpath)
    return jsonify({'files': files, 'path': subpath})

@app.route('/api/delete_file/<server_id>', methods=['POST'])
def api_delete_file(server_id):
    filepath = request.json.get('path')
    success = server_manager.delete_server_file(server_id, filepath)
    return jsonify({'success': success})

@app.route('/api/backup/<server_id>', methods=['POST'])
def api_create_backup(server_id):
    backup_name = request.json.get('name')
    if not backup_name:
        return jsonify({'success': False, 'message': 'Backup name is required'})
    
    success, msg = server_manager.create_backup(server_id, backup_name)
    return jsonify({'success': success, 'message': msg})

@app.route('/api/backups/<server_id>')
def api_list_backups(server_id):
    backups = server_manager.list_backups(server_id)
    return jsonify({'backups': backups})

@app.route('/api/delete_backup/<server_id>', methods=['POST'])
def api_delete_backup(server_id):
    backup_name = request.json.get('name')
    if not backup_name:
        return jsonify({'success': False})
    
    success = server_manager.delete_backup(server_id, backup_name)
    return jsonify({'success': success})

@app.route('/api/upload_backup/<server_id>', methods=['POST'])
def api_upload_backup(server_id):
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part'})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'})
        
    success, msg = server_manager.save_uploaded_backup(server_id, file)
    return jsonify({'success': success, 'message': msg})

@app.route('/api/restore_backup/<server_id>', methods=['POST'])
def api_restore_backup(server_id):
    backup_name = request.json.get('name')
    if not backup_name:
        return jsonify({'success': False, 'message': 'Backup name required'})
    
    success, msg = server_manager.restore_backup(server_id, backup_name)
    return jsonify({'success': success, 'message': msg})

@app.route('/api/download_backup/<server_id>/<backup_name>')
def api_download_backup(server_id, backup_name):
    path = os.path.join(server_manager.BACKUPS_DIR, str(server_id), backup_name)
    if os.path.exists(path):
        return send_file(path, as_attachment=True)
    return "File not found", 404

@app.route('/api/upload_file/<server_id>', methods=['POST'])
def api_upload_file(server_id):
    server = server_manager.get_server_by_id(server_id)
    if not server:
        return jsonify({'success': False, 'message': 'Server not found'})

    server_dir = os.path.join(server_manager.SERVERS_DIR, server['id'])
    current_path = request.form.get('path', '')
    
    files = request.files.getlist('files')
    
    if not files:
        return jsonify({'success': False, 'message': 'No files received'})

    success_count = 0
    for file in files:
        if file.filename == '':
            continue
            
        safe_filename = file.filename.replace('../', '').lstrip('/')
        
        target_path = os.path.join(server_dir, current_path, safe_filename)
        
        if not os.path.abspath(target_path).startswith(os.path.abspath(server_dir)):
            continue
            
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        
        try:
            file.save(target_path)
            success_count += 1
        except Exception as e:
            print(f"Failed to save {safe_filename}: {e}")

    return jsonify({'success': True, 'count': success_count})

@app.route('/api/file_content/<server_id>')
def api_get_file_content(server_id):
    path = request.args.get('path')
    if not path: return jsonify({'error': 'Path required'}), 400
    
    content, error = server_manager.read_file_content(server_id, path)
    if error:
        return jsonify({'error': error})
    return jsonify({'content': content})

@app.route('/api/save_file/<server_id>', methods=['POST'])
def api_save_file_content(server_id):
    path = request.json.get('path')
    content = request.json.get('content')
    
    if not path:
        return jsonify({'success': False, 'message': 'Path required'})
        
    success, msg = server_manager.write_file_content(server_id, path, content)
    return jsonify({'success': success, 'message': msg})

@app.route('/api/properties/<server_id>', methods=['GET', 'POST'])
def api_properties(server_id):
    if request.method == 'GET':
        props = server_manager.load_properties(server_id)
        return jsonify(props)
    else:
        props = request.json.get('properties')
        server_manager.save_properties_file(server_id, props)
        return jsonify({'success': True})

@app.route('/api/update_config/<server_id>', methods=['POST'])
def api_update_config(server_id):
    data = request.json
    port = data.get('port')
    ram = data.get('ram')
    
    if server_manager.update_server_config(server_id, port, ram):
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'Failed to update'})

@app.route('/api/delete_server/<server_id>', methods=['POST'])
def api_delete_server(server_id):
    success, msg = server_manager.delete_server(server_id)
    return jsonify({'success': success, 'message': msg})

@app.route('/api/players/<server_id>')
def api_players(server_id):
    players = server_manager.get_known_players(server_id)
    return jsonify(players)

@app.route('/api/op/<server_id>', methods=['POST'])
def api_op_player(server_id):
    nickname = request.json.get('nickname')
    if not nickname:
        return jsonify({'success': False, 'message': 'Nickname required'})
    
    success, msg = server_manager.op_player(server_id, nickname)
    return jsonify({'success': success, 'message': msg})

@app.route('/api/kick/<server_id>', methods=['POST'])
def api_kick_player(server_id):
    nickname = request.json.get('nickname')
    if not nickname: return jsonify({'success': False, 'message': 'Nickname required'})
    success, msg = server_manager.kick_player(server_id, nickname)
    return jsonify({'success': success, 'message': msg})

@app.route('/api/ban/<server_id>', methods=['POST'])
def api_ban_player(server_id):
    nickname = request.json.get('nickname')
    if not nickname: return jsonify({'success': False, 'message': 'Nickname required'})
    success, msg = server_manager.ban_player(server_id, nickname)
    return jsonify({'success': success, 'message': msg})

@app.route('/api/unban/<server_id>', methods=['POST'])
def api_unban_player(server_id):
    nickname = request.json.get('nickname')
    if not nickname: return jsonify({'success': False, 'message': 'Nickname required'})
    success, msg = server_manager.unban_player(server_id, nickname)
    return jsonify({'success': success, 'message': msg})

@app.route('/api/whitelist_remove/<server_id>', methods=['POST'])
def api_whitelist_remove(server_id):
    nickname = request.json.get('nickname')
    if not nickname: return jsonify({'success': False, 'message': 'Nickname required'})
    success, msg = server_manager.whitelist_remove(server_id, nickname)
    return jsonify({'success': success, 'message': msg})

@app.route('/api/whitelist_add/<server_id>', methods=['POST'])
def api_whitelist_add(server_id):
    nickname = request.json.get('nickname')
    if not nickname: return jsonify({'success': False, 'message': 'Nickname required'})
    success, msg = server_manager.whitelist_add(server_id, nickname)
    return jsonify({'success': success, 'message': msg})

@app.route('/api/player_details/<server_id>/<uuid>')
def api_player_details(server_id, uuid):
    data = server_manager.get_player_data(server_id, uuid)
    return jsonify(data if data else {'error': 'Not found'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=1010, debug=True)




@app.route('/api/teleport/<server_id>', methods=['POST'])
def api_teleport(server_id):
    data = request.json
    player = data.get('player')
    target = data.get('target')
    if not player or not target: return jsonify({'success': False, 'message': 'Missing args'})
    success, msg = server_manager.teleport_player(server_id, player, target)
    return jsonify({'success': success, 'message': msg})

@app.route('/api/effect/<server_id>', methods=['POST'])
def api_effect(server_id):
    data = request.json
    player = data.get('player')
    effect = data.get('effect')
    duration = data.get('duration', 30)
    amplifier = data.get('amplifier', 0)
    if not player or not effect: return jsonify({'success': False, 'message': 'Missing args'})
    success, msg = server_manager.give_effect(server_id, player, effect, duration, amplifier)
    return jsonify({'success': success, 'message': msg})
