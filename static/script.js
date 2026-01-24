console.log('ServerMaker Script 5.0 Loaded');
let currentPath = '';

/**
 * Shows a custom confirmation modal and returns a Promise.
 * @param {string} title 
 * @param {string} message 
 * @param {string} confirmBtnText 
 * @param {string} confirmBtnColor 
 * @returns {Promise<boolean>}
 */
function showConfirm(title, message, confirmBtnText = 'Confirm', confirmBtnColor = 'danger') {
    return new Promise((resolve) => {
        const modalEl = document.getElementById('confirmationModal');
        const titleEl = document.getElementById('confirmationModalTitle');
        const bodyEl = document.getElementById('confirmationModalBody');
        const confirmBtn = document.getElementById('confirmationModalBtn');

        titleEl.innerText = title;
        bodyEl.innerText = message;
        
        confirmBtn.className = `btn btn-${confirmBtnColor} px-4 fw-bold`;
        confirmBtn.innerText = confirmBtnText;

        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

        let modal = bootstrap.Modal.getInstance(modalEl);
        if(!modal) modal = new bootstrap.Modal(modalEl);

        const onConfirm = () => {
            modal.hide();
            resolve(true);
        };
        
        const onHide = () => {
             modalEl.removeEventListener('hidden.bs.modal', onHide);
             resolve(false);
        };

        newBtn.addEventListener('click', onConfirm);
        modalEl.addEventListener('hidden.bs.modal', onHide);

        modal.show();
    });
}


function copyToClipboard(text, element) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showCopiedFeedback(element);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            fallbackCopy(text, element);
        });
    } else {
        fallbackCopy(text, element);
    }
}

function fallbackCopy(text, element) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand("copy");
        showCopiedFeedback(element);
    } catch (err) {
        console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
}

function showCopiedFeedback(element) {
    const overlay = element.querySelector('.copy-overlay');
    if (overlay) {
        overlay.style.opacity = '1';
        setTimeout(() => {
            overlay.style.opacity = '0';
        }, 1500);
        return;
    }

    if (element.querySelector('.copy-feedback')) return;
    const badge = document.createElement('span');
    badge.className = 'badge bg-success copy-feedback';
    badge.innerText = 'Copied!';
    element.appendChild(badge);
    
    setTimeout(() => {
        badge.style.transition = 'opacity 0.3s, transform 0.3s';
        badge.style.opacity = '0';
        badge.style.transform = 'translate(0, -60%)';
        
        setTimeout(() => badge.remove(), 300);
    }, 1500);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const icon = newTheme === 'dark' ? 'fa-sun' : 'fa-moon';
    const btn = document.getElementById('theme-toggle');
    if(btn) btn.innerHTML = `<i class="fas ${icon}"></i>`;
}

async function startServer(id, refreshPage=false) {
    toggleBtnLoading('btn-start-' + id, true);
    if(document.getElementById('btn-start')) toggleBtnLoading('btn-start', true);

    try {
        const res = await fetch(`/api/start/${id}`, { method: 'POST' });
        const data = await res.json();
        if (!data.success) {
            alert('Error: ' + data.message);
        } else {
            if(refreshPage) window.location.reload();
            else updateButtons(id, 'running');
        }
    } catch (e) {
        console.error(e);
    } finally {
        toggleBtnLoading('btn-start-' + id, false);
        if(document.getElementById('btn-start')) toggleBtnLoading('btn-start', false);
    }
}

async function stopServer(id, refreshPage=false) {
    if(!await showConfirm("Stop Server?", "Are you sure you want to stop this server?", "Stop Server", "danger")) return;
    
    toggleBtnLoading('btn-stop-' + id, true);
    if(document.getElementById('btn-stop')) toggleBtnLoading('btn-stop', true);

    try {
        const res = await fetch(`/api/stop/${id}`, { method: 'POST' });
        if(refreshPage) setTimeout(() => window.location.reload(), 1000);
        else updateButtons(id, 'stopped');
    } catch (e) {
        console.error(e);
    } finally {
        toggleBtnLoading('btn-stop-' + id, false);
        if(document.getElementById('btn-stop')) toggleBtnLoading('btn-stop', false);
    }
}

async function restartServer(id) {
    if(!await showConfirm("Restart Server?", "Are you sure you want to restart the server?")) return;
    try {
        await fetch(`/api/restart/${id}`, { method: 'POST' });
        window.location.reload();
    } catch (e) {
        console.error(e);
    }
}

async function deleteServer(id) {
    if(!await showConfirm("Delete Server", "Are you sure you want to DELETE this server? This action cannot be undone!", "Delete", "danger")) return;
    
    try {
        const res = await fetch(`/api/delete_server/${id}`, { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            window.location.reload();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (e) {
        console.error(e);
        alert('Failed to delete server request.');
    }
}

function updateButtons(id, status) {
    const startBtnList = document.getElementById(`btn-start-${id}`);
    const stopBtnList = document.getElementById(`btn-stop-${id}`);
    const badgeList = document.getElementById(`status-badge-${id}`);
    
    if (startBtnList && stopBtnList && badgeList) {
        if (status === 'running') {
            startBtnList.style.display = 'none';
            stopBtnList.style.display = 'inline-block';
            badgeList.className = 'badge bg-success';
            badgeList.innerText = 'Running';
        } else {
            startBtnList.style.display = 'inline-block';
            stopBtnList.style.display = 'none';
            badgeList.className = 'badge bg-secondary';
            badgeList.innerText = 'Stopped';
        }
    }

    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const btnRestart = document.getElementById('btn-restart');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    if (btnStart && btnStop && btnRestart && statusDot && statusText) {
        if (status === 'running') {
             btnStart.disabled = true;
             btnStop.disabled = false;
             btnRestart.disabled = false;
             
             statusDot.className = 'status-dot running';
             statusText.innerText = 'Running';
             statusText.style.color = '#2ecc71';
        } else {
             btnStart.disabled = false;
             btnStop.disabled = true;
             btnRestart.disabled = true;
             
             statusDot.className = 'status-dot stopped';
             statusText.innerText = 'Stopped';
             statusText.style.color = '#e74c3c';
        }
    }
}

async function checkStatus(id) {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const listBadge = document.getElementById(`status-badge-${id}`);

    if (!statusDot && !listBadge) return;

    try {
        const res = await fetch(`/api/status/${id}`);
        const data = await res.json();
        
        const startBtn = document.getElementById('btn-start');
        const stopBtn = document.getElementById('btn-stop');
        const restartBtn = document.getElementById('btn-restart');

        if (statusDot && statusText) {
            if (data.status === 'running') {
                statusDot.className = 'status-dot running';
                statusText.innerText = 'Running';
                
                if(startBtn) startBtn.disabled = true;
                if(stopBtn) stopBtn.disabled = false;
                if(restartBtn) restartBtn.disabled = false;
            } else {
                statusDot.className = 'status-dot stopped';
                statusText.innerText = 'Stopped';
                
                if(stopBtn) stopBtn.disabled = true;
                if(restartBtn) restartBtn.disabled = true;
            }
        }
        
        // Update list page if exists
        updateButtons(id, data.status);
    } catch (e) {
    }
}

function toggleBtnLoading(id, isLoading) {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;
    } else {
        btn.innerHTML = btn.dataset.originalText || 'Action';
        btn.disabled = false;
    }
}

// --- Console ---

async function updateConsole(id) {
    const consoleOutput = document.getElementById('console-output');
    if (!consoleOutput) return; // Not on console tab

    try {
        const res = await fetch(`/api/console/${id}`);
        const data = await res.json();
        
        const wasAtBottom = consoleOutput.scrollHeight - consoleOutput.scrollTop <= consoleOutput.clientHeight + 50;
        
        consoleOutput.innerText = data.logs || 'Server ready. Waiting for output...';
        
        if (wasAtBottom) {
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
        }
    } catch (e) {
        console.error(e);
        consoleOutput.innerText = 'Error loading logs. Server might be offline or unreachable.';
    }
}

// Console History
let commandHistory = [];
let historyIndex = -1;

function handleConsoleInput(event, id) {
    const input = document.getElementById('console-input');
    
    if (event.key === 'Enter') {
        sendCommand(id);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (historyIndex > 0) {
            historyIndex--;
            input.value = commandHistory[historyIndex];
        } else if (historyIndex === -1 && commandHistory.length > 0) {
             historyIndex = commandHistory.length - 1;
             input.value = commandHistory[historyIndex];
        }
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            input.value = commandHistory[historyIndex];
        } else {
            historyIndex = commandHistory.length;
            input.value = '';
        }
    }
}

async function sendCommand(id) {
    const input = document.getElementById('console-input');
    const cmd = input.value;
    if (!cmd) return;
    
    if (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== cmd) {
        commandHistory.push(cmd);
    }
    historyIndex = commandHistory.length;
    
    input.value = '';
    await executeConsoleCommand(id, cmd);
    
    setTimeout(() => updateConsole(id), 200);
}

async function executeConsoleCommand(id, cmd) {
    try {
        await fetch(`/api/console/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
        });
    } catch (e) {
        console.error("Failed to execute command", e);
    }
}


// --- Files ---

async function loadFiles(id, path = '') {
    currentPath = path;
    const tbody = document.getElementById('file-list');
    const breadcrumb = document.getElementById('file-breadcrumb');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
    
    try {
        const res = await fetch(`/api/files/${id}?path=${encodeURIComponent(path)}`);
        const data = await res.json();
        
        tbody.innerHTML = '';
        
        if (path !== '') {
            const parentPath = path.split('/').slice(0, -1).join('/');
            const row = `
                <tr class="file-row">
                    <td><a href="#" onclick="loadFiles('${id}', '${parentPath}')" class="file-link fw-bold text-decoration-none"><i class="fas fa-level-up-alt text-primary me-2"></i> ..</a></td>
                    <td class="text-muted text-center">-</td>
                    <td class="text-end"></td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        }
        
        data.files.forEach(f => {
            const fullPath = path ? `${path}/${f.name}` : f.name;
            let iconClass = 'fa-file text-secondary';
            let rowClass = 'file-row';
            
            if (f.is_dir) {
                iconClass = 'fa-folder text-warning';
                rowClass += ' file-row-dir';
            } else {
                const ext = f.name.split('.').pop().toLowerCase();
                if (['json', 'properties', 'txt', 'log'].includes(ext)) iconClass = 'fa-file-alt text-info';
                if (['jar'].includes(ext)) iconClass = 'fa-cube text-danger';
            }
            
            const icon = `<i class="fas ${iconClass} me-2 file-icon"></i>`;
            
            let linkHtml = '';

            if (f.is_dir) {
                linkHtml = `<a href="#" onclick="loadFiles('${id}', '${fullPath}')" class="file-link fw-bold text-decoration-none">${f.name}</a>`;
            } else {
                linkHtml = `<a href="#" onclick="openFile('${id}', '${fullPath}')" class="file-link text-decoration-none">${f.name}</a>`;
            }

            const row = `
                <tr class="${rowClass}">
                    <td class="align-middle border-0 ps-3 py-2">${icon} ${linkHtml}</td>
                    <td class="align-middle border-0 text-center text-muted" style="font-family: monospace;">${f.is_dir ? '-' : (f.size / 1024).toFixed(1) + ' KB'}</td>
                    <td class="align-middle border-0 text-end pe-3">
                        <button class="btn btn-sm btn-link text-danger text-opacity-75 btn-file-action" onclick="deleteFile('${id}', '${fullPath}')" title="Delete"><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });
        
        breadcrumb.innerHTML = `<li class="breadcrumb-item"><a href="#" onclick="loadFiles('${id}', '')">root</a></li>`;
        if(path) {
            const parts = path.split('/');
            let buildPath = '';
            parts.forEach((p, index) => {
                buildPath += (buildPath ? '/' : '') + p;
                if (index === parts.length - 1) {
                    breadcrumb.innerHTML += `<li class="breadcrumb-item active">${p}</li>`;
                } else {
                     breadcrumb.innerHTML += `<li class="breadcrumb-item"><a href="#" onclick="loadFiles('${id}', '${buildPath}')">${p}</a></li>`;
                }
            });
        }
        
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-danger">Failed to load files</td></tr>';
    }
}

async function deleteFile(id, path) {
    if(!await showConfirm("Delete File", `Are you sure you want to delete "${path}"?`)) return;
    
    await fetch(`/api/delete_file/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path })
    });
    loadFiles(id, currentPath);
}

async function uploadFiles(id, files) {
    if (files.length === 0) return;
    
    const tbody = document.getElementById('file-list');
    const originalContent = tbody.innerHTML;
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-primary"><i class="fas fa-spinner fa-spin"></i> Uploading ' + files.length + ' item(s)...</td></tr>';
    
    const formData = new FormData();
    formData.append('path', currentPath);
    
    if (files[0] instanceof File) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const relativePath = file.webkitRelativePath || file.name;
            formData.append('files', file, relativePath);
        }
    } else {
        for (let i = 0; i < files.length; i++) {
             formData.append('files', files[i].file, files[i].path);
        }
    }
    
    try {
        await fetch(`/api/upload_file/${id}`, {
            method: 'POST',
            body: formData
        });
        
        if(document.getElementById('file-upload')) document.getElementById('file-upload').value = '';
        if(document.getElementById('folder-upload')) document.getElementById('folder-upload').value = '';
        
    } catch (e) {
        alert('Upload failed: ' + e);
        tbody.innerHTML = originalContent;
    }
    
    loadFiles(id, currentPath);
}

let currentEditingPath = '';
let currentEditingServerId = '';
let fileEditorModalInstance = null;

async function openFile(id, path) {
    const ext = path.split('.').pop().toLowerCase();
    const binaryExts = ['jar', 'exe', 'bin', 'dat', 'zip', 'gz', 'png', 'jpg', 'jpeg', 'ico', 'world'];
    if (binaryExts.includes(ext) || path.includes('world/')) {
        alert("Cannot edit binary files.");
        return;
    }

    const modalEl = document.getElementById('fileEditorModal');
    const modalTitle = document.getElementById('fileEditorTitle');
    const textarea = document.getElementById('fileEditorContent');
    const status = document.getElementById('fileSaveStatus');
    
    currentEditingServerId = id;
    currentEditingPath = path;
    
    modalTitle.innerText = path;
    textarea.value = 'Loading...';
    status.innerText = '';
    
    if (!fileEditorModalInstance && typeof bootstrap !== 'undefined') {
        fileEditorModalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    }
    
    if (fileEditorModalInstance) {
        fileEditorModalInstance.show();
    }
    
    try {
        const res = await fetch(`/api/file_content/${id}?path=${encodeURIComponent(path)}`);
        const data = await res.json();
        
        if (data.error) {
            textarea.value = "Error loading file: " + data.error;
        } else {
            textarea.value = data.content;
        }
    } catch (e) {
        textarea.value = "Failed to fetch file.";
        console.error(e);
    }
}

async function saveCurrentFile() {
    const content = document.getElementById('fileEditorContent').value;
    const status = document.getElementById('fileSaveStatus');
    const btn = document.getElementById('btnSaveFile');
    
    status.innerText = 'Saving...';
    btn.disabled = true;
    
    try {
        const res = await fetch(`/api/save_file/${currentEditingServerId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                path: currentEditingPath,
                content: content
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            status.innerText = 'Saved ' + new Date().toLocaleTimeString();
            status.className = 'me-auto text-success small';
        } else {
            status.innerText = 'Error: ' + data.message;
            status.className = 'me-auto text-danger small';
        }
    } catch (e) {
        status.innerText = 'Network Error';
        status.className = 'me-auto text-danger small';
    } finally {
        btn.disabled = false;
    }
}

// --- Players ---

let playerDetailInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    const pModal = document.getElementById('playerModal');
    if(pModal) {
        pModal.addEventListener('hidden.bs.modal', () => {
            if(playerDetailInterval) {
                clearInterval(playerDetailInterval);
                playerDetailInterval = null;
            }
        });
    }
});

async function loadPlayers(id) {
    const list = document.getElementById('player-list');
    if(!list) return;
    
    try {
        const res = await fetch(`/api/players/${id}`);
        const players = await res.json();
        
        list.innerHTML = '';
        if(!players || players.length === 0) {
             list.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No known players found.</td></tr>';
             return;
        }
        
        players.forEach(p => {
            const isUnknown = p.name.toLowerCase().includes('unknown');
            const avatarUrl = isUnknown ? null : `https://minotar.net/helm/${p.name}/40.png`;
            
            const avatarImg = avatarUrl 
                ? `<img src="${avatarUrl}" class="player-avatar me-2" onerror="this.src='https://minotar.net/helm/MHF_Steve/40.png'">`
                : `<div class="player-avatar-placeholder me-2"><i class="fas fa-user-secret"></i></div>`;

            const statusContent = p.online 
                ? `<span class="status-indicator online"><i class="fas fa-circle"></i> Online</span>` 
                : `<span class="status-indicator offline"><i class="fas fa-circle"></i> Offline</span>`;
                
            const opIcon = p.op 
                ? `<span class="op-badge" title="Operator"><i class="fas fa-chess-king"></i></span>` 
                : '';
            
            const uidStr = p.uuid || '???';
            
            const row = `
                <tr class="player-row">
                    <td class="align-middle border-0 ps-3 py-2">
                        <div class="d-flex align-items-center">
                            ${avatarImg}
                            <div>
                                <div class="fw-bold">${p.name} ${opIcon}</div>
                                <div class="small opacity-50 d-md-none font-monospace">${uidStr.substring(0,8)}...</div>
                            </div>
                        </div>
                    </td>
                    <td class="align-middle border-0 d-none d-md-table-cell">
                        <div class="uuid-pill" onclick="copyToClipboard('${uidStr}', this)" title="Click to Copy UUID">
                            <span class="font-monospace">${uidStr}</span>
                            <i class="far fa-copy ms-2 opacity-50"></i>
                        </div>
                    </td>
                    <td class="align-middle border-0">${statusContent}</td>
                    <td class="align-middle border-0 text-end pe-3">
                        <button class="btn btn-sm btn-action-player" onclick="showPlayerDetails('${id}', '${uidStr}', '${p.name}')" title="View Full Stats">
                            <i class="fas fa-id-card"></i> DETAILS
                        </button>
                    </td>
                </tr>
            `;
            list.insertAdjacentHTML('beforeend', row);
        });
    } catch(e) {
        console.error(e);
        if(list) list.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load players.</td></tr>';
    }
}

async function opPlayer(id) {
    const input = document.getElementById('op-player-input');
    const name = input.value.trim();
    if(!name) return;
    
    const btn = document.querySelector('button[onclick^="opPlayer"]');
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    
    try {
        const res = await fetch(`/api/op/${id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({nickname: name})
        });
        const data = await res.json();
        
        if(data.success) {
            alert(data.message);
            input.value = '';
            loadPlayers(id);
        } else {
             alert('Error: ' + data.message);
        }
    } catch(e) {
        console.error(e);
        alert('Failed to send OP command.');
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
}

async function addToWhitelist(id) {
    const input = document.getElementById('op-player-input');
    const name = input.value.trim();
    if(!name) return;

    try {
        const res = await fetch(`/api/whitelist_add/${id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({nickname: name})
        });
        const data = await res.json();
         if(data.success) {
            alert(data.message);
            input.value = '';
            loadPlayers(id);
        } else {
             alert('Error: ' + data.message);
        }
    } catch(e) { alert(e); }
}

async function kickPlayer(id, name) {
    if(!await showConfirm("Kick Player", `Are you sure you want to kick ${name}?`, "Kick", "warning")) return;
    try {
        await fetch(`/api/kick/${id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({nickname: name})
        });
    } catch(e) { alert(e); }
}

async function banPlayer(id, name) {
    if(!await showConfirm("Ban Player", `Are you sure you want to ban ${name}?`, "Ban Player", "danger")) return;
    try {
        await fetch(`/api/ban/${id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({nickname: name})
        });
    } catch(e) { alert(e); }
}

async function unbanPlayer(id, name) {
    if(!await showConfirm("Unban Player", `Are you sure you want to unban ${name}?`, "Unban", "success")) return;
    try {
        await fetch(`/api/unban/${id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({nickname: name})
        });
    } catch(e) { alert(e); }
}

async function removeWhitelist(id, name) {
    if(!await showConfirm("Remove from Whitelist", `Remove ${name} from whitelist?`)) return;
    try {
        await fetch(`/api/whitelist_remove/${id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({nickname: name})
        });
    } catch(e) { alert(e); }
}

async function showPlayerDetails(id, uuid, name) {
    const modalEl = document.getElementById('playerModal');
    let modal = bootstrap.Modal.getInstance(modalEl);
    if (!modal) modal = new bootstrap.Modal(modalEl);

    const title = document.getElementById('playerModalTitle');
    const body = document.getElementById('playerModalBody');
    
    title.innerText = 'Player: ' + name;
    body.innerHTML = `
        <div id="player-loading-spinner" class="text-center p-5">
             <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status"></div>
             <p class="mt-3 text-muted fw-bold">Reading Player Data...</p>
        </div>
        
        <div id="player-data-content" class="d-none px-2 py-1">
            
            <!-- ADMIN ACTIONS -->
             <div class="mb-4">
                 <div class="d-flex align-items-center mb-2 px-1">
                     <i class="fas fa-user-shield me-2 text-danger"></i>
                     <span class="fw-bold text-danger text-uppercase small" style="letter-spacing: 1px;">Administration</span>
                </div>
                
                <div class="row g-2">
                    <!-- Row 1 -->
                    <div class="col-6">
                         <button class="btn btn-control btn-control-warning w-100 py-2 border-0 shadow-sm fw-bold text-uppercase h-100" onclick="kickPlayer('${id}', '${name}')" style="min-height: 50px;">
                            KICK
                        </button>
                    </div>
                    <div class="col-6">
                        <button class="btn btn-control btn-control-primary w-100 py-2 border-0 shadow-sm fw-bold text-uppercase d-none h-100" id="btn-wl-add" onclick="addToWhitelistDirect('${id}', '${name}')" style="min-height: 50px;">
                            <i class="fas fa-user-plus me-2"></i> WHITELIST
                        </button>
                        <button class="btn btn-control btn-control-primary w-100 py-2 border-0 shadow-sm fw-bold text-uppercase h-100" id="btn-wl-remove" onclick="removeWhitelist('${id}', '${name}')" style="min-height: 50px; opacity: 0.8;">
                            <i class="fas fa-user-check me-2"></i> WHITELIST
                        </button>
                    </div>

                    <!-- Row 2 -->
                    <div class="col-6">
                         <button class="btn btn-control btn-control-danger w-100 py-2 border-0 shadow-sm fw-bold text-uppercase h-100" id="btn-ban" onclick="banPlayer('${id}', '${name}')" style="min-height: 50px;">
                            <i class="fas fa-gavel me-2"></i> BAN
                        </button>
                         <button class="btn btn-control btn-control-success w-100 py-2 border-0 shadow-sm fw-bold text-uppercase d-none h-100" id="btn-unban" onclick="unbanPlayer('${id}', '${name}')" style="min-height: 50px;">
                            <i class="fas fa-undo me-2"></i> UNBAN
                        </button>
                    </div>
                    <div class="col-6">
                         <button class="btn btn-control btn-control-dark w-100 py-2 border-0 shadow-sm fw-bold text-uppercase d-none h-100" id="btn-op-remove" onclick="deopPlayer('${id}', '${name}')" style="min-height: 50px;">
                            <i class="fas fa-user-slash me-2"></i> DE-OP
                        </button>
                        <button class="btn btn-control btn-control-secondary w-100 py-2 border-0 shadow-sm fw-bold text-uppercase h-100" id="btn-op-add" onclick="opPlayerDirect('${id}', '${name}')" style="min-height: 50px;">
                            <i class="fas fa-crown me-2"></i> MAKE OP
                        </button>
                    </div>

                    <!-- Row 3 -->
                     <div class="col-6">
                         <button class="btn btn-control btn-control-info text-white w-100 py-2 border-0 shadow-sm fw-bold text-uppercase h-100" onclick="promptTeleport('${id}', '${uuid}', '${name}')" style="min-height: 50px;">
                            <i class="fas fa-compass me-2"></i> TELEPORT
                        </button>
                     </div>
                     <div class="col-6">
                         <button class="btn btn-control btn-control-purple text-white w-100 py-2 border-0 shadow-sm fw-bold text-uppercase h-100" style="min-height: 50px;" onclick="promptEffect('${id}', '${uuid}', '${name}')">
                            <i class="fas fa-flask me-2"></i> EFFECT
                        </button>
                     </div>
                </div>
            </div>

            <!-- Vitals Row -->
            <div class="row g-3 mb-4">
                <div class="col-md-3 col-sm-6">
                    <div class="player-stat-card">
                        <i class="fas fa-heart text-danger player-stat-icon"></i>
                        <h4 id="p-health" class="player-stat-value">-</h4>
                        <div class="player-stat-label">Health</div>
                        <div class="player-sub-info text-warning" id="p-absorption" style="min-height: 1.2em;"></div>
                        <button class="btn btn-sm btn-control btn-control-danger w-100 mt-2 border-0 fw-bold shadow-sm" onclick="healPlayer('${id}', '${name}')">HEAL</button>
                    </div>
                </div>
                <div class="col-md-3 col-sm-6">
                    <div class="player-stat-card">
                        <i class="fas fa-drumstick-bite text-warning player-stat-icon"></i>
                        <h4 id="p-food" class="player-stat-value">-</h4>
                        <div class="player-stat-label">Food Level</div>
                        <button class="btn btn-sm btn-control btn-control-warning w-100 mt-2 border-0 fw-bold shadow-sm" onclick="feedPlayer('${id}', '${name}')">FEED</button>
                    </div>
                </div>
                <div class="col-md-3 col-sm-6">
                     <div class="player-stat-card">
                         <i class="fas fa-bolt text-success player-stat-icon"></i>
                         <h4 id="p-xp" class="player-stat-value">-</h4>
                         <div class="player-stat-label">XP Level</div>
                         <div class="progress mt-2 w-75" style="height: 4px; background-color: rgba(128,128,128,0.2);">
                            <div class="progress-bar bg-success" id="p-xp-bar" role="progressbar" style="width: 0%"></div>
                         </div>
                         <button class="btn btn-sm btn-control btn-control-success w-100 mt-2 border-0 fw-bold shadow-sm" onclick="promptXp('${id}', '${uuid}', '${name}')">+ XP</button>
                    </div>
                </div>
                 <div class="col-md-3 col-sm-6">
                    <div class="player-stat-card">
                        <i class="fas fa-gamepad text-info player-stat-icon"></i>
                        <h4 id="p-gamemode" class="player-stat-value text-capitalize">-</h4>
                        <div class="player-stat-label">Game Mode</div>
                        <button class="btn btn-sm btn-control btn-control-info w-100 mt-2 border-0 fw-bold shadow-sm text-white" onclick="promptGamemode('${id}', '${uuid}', '${name}')">SWITCH</button>
                    </div>
                </div>
            </div>

            <div class="row g-4 mb-2">
                <!-- Location -->
                <div class="col-md-6">
                    <div class="player-details-section h-100">
                        <div class="player-section-header">
                            <i class="fas fa-map-marker-alt text-danger"></i> 
                            <span>Location Data</span>
                        </div>
                        <ul class="list-group list-group-flush player-info-list h-100 justify-content-center">
                            <li class="list-group-item d-flex justify-content-between align-items-center border-0 pb-0">
                                <span class="text-muted fw-bold" style="font-size: 0.85em; text-transform: uppercase;">Dimension</span>
                                <strong id="p-dimension" class="text-capitalize fs-5">-</strong>
                            </li>
                            <li class="list-group-item border-0">
                                <small class="text-muted fw-bold d-block mb-1" style="font-size: 0.75em; text-transform: uppercase;">Coordinates</small>
                                <div class="p-3 rounded text-center font-monospace user-select-all" id="p-position" style="font-size: 1.1em; letter-spacing: 1px; background: var(--input-bg); border: 1px solid var(--card-border);">
                                    -
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                <!-- Abilities & Status -->
                <div class="col-md-6">
                     <div class="player-details-section h-100">
                        <div class="player-section-header">
                            <i class="fas fa-flask text-primary"></i> 
                            <span>State & Effects</span>
                        </div>
                         <div class="p-3">
                            <small class="text-muted fw-bold mb-2 d-block" style="font-size: 0.75em; text-transform: uppercase;">Active Effects</small>
                            <div id="p-effects-list" class="d-flex flex-wrap gap-2">
                                    <span class="text-muted small fst-italic">None</span>
                            </div>
                         </div>
                    </div>
                </div>
            </div>
            
            <div class="mt-4 pt-3 border-top d-flex justify-content-between align-items-center text-muted">
                 <small><i class="fas fa-fingerprint me-1"></i> <span id="p-uuid" class="user-select-all font-monospace" style="font-size: 0.85em;">${uuid}</span></small>
                 <span class="badge bg-secondary opacity-50 fw-normal" id="p-updated-time">-</span>
            </div>
            
        </div>
    `;
    modal.show();

     if (!modalEl.dataset.escLogicApplied) {
        modalEl.addEventListener('hide.bs.modal', function(e) {
             const openModals = document.querySelectorAll('.modal.show');
             if(openModals.length > 1) {
                 // Check if playerModal is the one being closed, but we have other modals on top
                 // If so, we prevent playerModal from closing, and force close the top one
                 e.preventDefault();
                 e.stopPropagation();
                 
                 let topModal = null;
                 // Find the one that is NOT playerModal
                 openModals.forEach(m => {
                     if(m.id !== 'playerModal') topModal = m;
                 });
                 
                 if(topModal) {
                     const inst = bootstrap.Modal.getInstance(topModal);
                     if(inst) inst.hide();
                 }
             }
        });
        modalEl.dataset.escLogicApplied = 'true';
    }

    if(playerDetailInterval) clearInterval(playerDetailInterval);
    await updatePlayerUI(id, uuid);
    playerDetailInterval = setInterval(() => updatePlayerUI(id, uuid), 250);
}

async function updatePlayerUI(id, uuid) {
    const loading = document.getElementById('player-loading-spinner');
    const content = document.getElementById('player-data-content');
    
    if(!content) return; // Modal closed or DOM changed
    
    try {
        // Force server save to get latest NBT data from disk
        await executeConsoleCommand(id, 'save-all');
        await new Promise(r => setTimeout(r, 200));

        const res = await fetch(`/api/player_details/${id}/${uuid}?_t=${Date.now()}`);
        const data = await res.json();
        
        if(data.error) {
             content.innerHTML = `<div class="alert alert-warning">${data.error} <br> <small class="text-muted">Player might be offline or never visited (no .dat file).</small></div>`;
             loading.classList.add('d-none');
             content.classList.remove('d-none');
             if(playerDetailInterval) clearInterval(playerDetailInterval);
             return;
        }

        const btnBan = document.getElementById('btn-ban');
        const btnUnban = document.getElementById('btn-unban');
        
        const btnWlAdd = document.getElementById('btn-wl-add');
        const btnWlRemove = document.getElementById('btn-wl-remove');

        const btnOpAdd = document.getElementById('btn-op-add');
        const btnOpRemove = document.getElementById('btn-op-remove');

        if (data.banned) {
            if(btnBan) btnBan.classList.add('d-none');
            if(btnUnban) btnUnban.classList.remove('d-none');
        } else {
            if(btnBan) btnBan.classList.remove('d-none');
            if(btnUnban) btnUnban.classList.add('d-none');
        }

        if (data.whitelisted) {
             if(btnWlRemove) btnWlRemove.classList.remove('d-none');
             if(btnWlAdd) btnWlAdd.classList.add('d-none');
        } else {
             if(btnWlRemove) btnWlRemove.classList.add('d-none');
             if(btnWlAdd) btnWlAdd.classList.remove('d-none');
        }

        if (data.op) {
             if(btnOpRemove) btnOpRemove.classList.remove('d-none');
             if(btnOpAdd) btnOpAdd.classList.add('d-none');
        } else {
             if(btnOpRemove) btnOpRemove.classList.add('d-none');
             if(btnOpAdd) btnOpAdd.classList.remove('d-none');
        }

        loading.classList.add('d-none');
        content.classList.remove('d-none');
        
        const pos = data.Pos ? `X: ${data.Pos[0].toFixed(1)}  Y: ${data.Pos[1].toFixed(1)}  Z: ${data.Pos[2].toFixed(1)}` : 'Unknown';
        const hp = data.Health !== undefined ? Math.round(data.Health) + ' / 20' : '?';
        const food = data.foodLevel !== undefined ? data.foodLevel + ' / 20' : '?';
        const dim = data.Dimension ? String(data.Dimension).replace('minecraft:', '') : 'Unknown';
        const gamemode = data.GameMode || 'Survival';
        
        if(document.getElementById('p-health')) document.getElementById('p-health').innerText = hp;
        if(data.AbsorptionAmount > 0) {
             document.getElementById('p-absorption').innerText = `(+${Math.round(data.AbsorptionAmount)})`;
        } else {
             document.getElementById('p-absorption').innerText = '';
        }
        
        if(document.getElementById('p-food')) document.getElementById('p-food').innerText = food;
        if(document.getElementById('p-saturation')) document.getElementById('p-saturation').innerText = 'Sat: ' + (data.foodSaturationLevel || 0).toFixed(1);
        
        if(document.getElementById('p-xp')) document.getElementById('p-xp').innerText = data.XpLevel || 0;
        if(document.getElementById('p-xp-total')) document.getElementById('p-xp-total').innerText = data.XpTotal || 0;
        if(document.getElementById('p-xp-bar')) document.getElementById('p-xp-bar').style.width = ((data.XpP || 0) * 100) + '%';
        
        if(document.getElementById('p-gamemode')) document.getElementById('p-gamemode').innerText = gamemode;
        if(document.getElementById('p-score')) document.getElementById('p-score').innerText = 'Score: ' + (data.Score || 0);

        if(document.getElementById('p-dimension')) document.getElementById('p-dimension').innerText = dim;
        if(document.getElementById('p-position')) document.getElementById('p-position').innerText = pos;
        
        // Active Effects
        const effectsContainer = document.getElementById('p-effects-list');
        if(effectsContainer) {
            if(data.ActiveEffects && data.ActiveEffects.length > 0) {
                 const toRoman = (num) => {
                     if(num === 1) return 'I';
                     if(num === 2) return 'II';
                     if(num === 3) return 'III';
                     if(num === 4) return 'IV';
                     if(num === 5) return 'V';
                     return num.toString();
                 };

                 const effectsHtml = data.ActiveEffects.map(eff => {
                     let badgeClass = 'bg-info text-dark';
                     const n = eff.name.toLowerCase();
                     if(n.includes('wither') || n.includes('poison') || n.includes('harm') || n.includes('slow') || n.includes('weakness') || n.includes('bad')) {
                         badgeClass = 'bg-danger text-white';
                     } else if (n.includes('strength') || n.includes('regen') || n.includes('resistance') || n.includes('absorption') || n.includes('health') || n.includes('hero')) {
                         badgeClass = 'bg-success text-white';
                     } else if(n.includes('speed') || n.includes('jump') || n.includes('falling') || n.includes('dolphins') || n.includes('conduit')) {
                         badgeClass = 'bg-primary text-white';
                     }
                     
                     const displayAmp = (eff.amplifier !== undefined ? eff.amplifier : 0) + 1;
                     const levelStr = displayAmp > 1 ? ' ' + toRoman(displayAmp) : '';

                     return `
                        <span class="badge ${badgeClass} effect-badge" title="ID: ${eff.id}">
                            <span class="effect-name">${eff.name}${levelStr}</span>
                            <span class="effect-separator"></span>
                            <span class="effect-duration">${eff.duration}</span>
                        </span>
                     `;
                 }).join('');
                 effectsContainer.innerHTML = effectsHtml;
            } else {
                 effectsContainer.innerHTML = '<span class="text-muted small fst-italic">No active effects</span>';
            }
        }


        const now = new Date();
        const timeStr = now.toLocaleTimeString(); // Default usually HH:MM:SS
        if(document.getElementById('p-updated-time')) document.getElementById('p-updated-time').innerText = timeStr;

    } catch(e) {
        console.error(e);
        // Don't wipe UI on transient errors
    }
}

const dropZone = document.getElementById('drop-zone');
const fileTableContainer = document.getElementById('files'); 

window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (document.getElementById('files').classList.contains('active')) {
        dropZone.classList.remove('d-none');
    }
});

window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (e.clientX === 0 && e.clientY === 0) {
        dropZone.classList.add('d-none');
    }
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.add('d-none');
    
    if (!document.getElementById('files').classList.contains('active')) return;
    
    const items = e.dataTransfer.items;
    handleDroppedItems(items);
});

async function handleDroppedItems(items) {
    const queue = [];
    const serverId = SERVER_ID; // From global scope defined in template
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry();
            if (entry) {
                await scanFiles(entry, queue, '');
            }
        }
    }
    
    if (queue.length > 0) {
        uploadFiles(serverId, queue);
    }
}

async function scanFiles(entry, queue, pathStr) {
    if (entry.isFile) {
        return new Promise((resolve) => {
            entry.file(file => {
                // If pathStr is empty, it's root file drop.
                // If pathStr has value, it's inside a folder.
                // We want the filename to include the pathStr.
                const fullPath = pathStr ? pathStr + file.name : file.name;
                queue.push({ file: file, path: fullPath });
                resolve();
            });
        });
    } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const newPath = pathStr + entry.name + '/';
        
        return new Promise((resolve) => {
            const readEntries = async () => {
                dirReader.readEntries(async (entries) => {
                    if (entries.length === 0) {
                        resolve();
                    } else {
                        const promises = entries.map(childEntry => scanFiles(childEntry, queue, newPath));
                        await Promise.all(promises);
                        resolve();
                    }
                });
            };
            readEntries();
        });
    }
}

// --- Properties ---

async function loadProperties(id) {
    const container = document.getElementById('properties-container');
    if (!container) return;
    
    try {
        const res = await fetch(`/api/properties/${id}`);
        const data = await res.json();
        
        let html = '<div class="row g-4">';
        
        const categories = {
            'Game': ['gamemode', 'difficulty', 'hardcore', 'pvp', 'level-name', 'level-seed', 'level-type', 'max-players', 'simulation-distance', 'view-distance'],
            'World': ['allow-nether', 'allow-flight', 'generate-structures', 'spawn-protection', 'white-list', 'enforce-whitelist', 'force-gamemode', 'motd'],
            'Network': ['server-port', 'server-ip', 'online-mode', 'enable-rcon', 'rcon.password', 'rcon.port', 'enable-status', 'enable-query'],
            'Advanced': ['max-tick-time', 'rate-limit', 'network-compression-threshold', 'op-permission-level', 'function-permission-level', 'enable-command-block']
        };
        
        const sortedKeys = Object.keys(data).sort();
        const groupedData = {};
        
        sortedKeys.forEach(key => {
            let found = false;
            for(const [cat, keywords] of Object.entries(categories)) {
                if (keywords.includes(key) || keywords.some(k => key.includes(k) && k.length > 4)) {
                    if(!groupedData[cat]) groupedData[cat] = [];
                    groupedData[cat].push(key);
                    found = true;
                    break;
                }
            }
            if(!found) {
                if(!groupedData['Other']) groupedData['Other'] = [];
                groupedData['Other'].push(key);
            }
        });

        const renderOrder = ['Game', 'World', 'Network', 'Advanced', 'Other'];
        
        for (const category of renderOrder) {
            const keys = groupedData[category];
            if (!keys || keys.length === 0) continue;
            
            // Category Header
            let icon = 'fa-cogs';
            let color = 'primary';

            if(category === 'Game') { 
                icon = 'fa-gamepad'; 
                color = 'success'; 
            }
            if(category === 'World') { 
                icon = 'fa-globe-americas'; 
                color = 'danger'; 
            }
            if(category === 'Network') { 
                icon = 'fa-network-wired'; 
                color = 'info'; 
            }
            if(category === 'Advanced') { 
                icon = 'fa-microchip'; 
                color = 'warning'; 
            }
            
            html += `
                <div class="col-12 mt-4 mb-2">
                    <h6 class="border-bottom border-${color} pb-2 text-${color} opacity-75 text-uppercase fw-bold tracking-wide">
                        <i class="fas ${icon} me-2"></i>${category} Settings
                    </h6>
                </div>
            `;
            
            keys.forEach(key => {
                const value = data[key];
                const isBool = value === 'true' || value === 'false';
                
                const niceLabel = key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                html += `
                <div class="col-md-6 col-lg-4">
                    <div class="setting-card h-100 p-3 rounded position-relative">
                        <label class="form-label fw-bold small text-muted text-uppercase mb-2">${niceLabel}</label>
                `;
                
                if (isBool) {
                    const checked = value === 'true' ? 'checked' : '';
                    html += `
                        <div class="form-check form-switch mt-1">
                            <input class="form-check-input" type="checkbox" name="${key}" value="true" ${checked}>
                            <label class="form-check-label ${value === 'true' ? 'text-success' : 'text-secondary'} small fw-bold">${value === 'true' ? 'Enabled' : 'Disabled'}</label>
                        </div>
                    `;
                } else {
                    html += `<input type="text" class="form-control form-control-sm modern-input" name="${key}" value="${value}">`;
                }
                html += '</div></div>';
            });
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        // Add listeners to switches for instant visual feedback (Text update)
        container.querySelectorAll('.form-check-input').forEach(sw => {
            sw.addEventListener('change', (e) => {
                const label = e.target.nextElementSibling;
                if(e.target.checked) {
                    label.innerText = 'Enabled';
                    label.classList.replace('text-secondary', 'text-success');
                } else {
                    label.innerText = 'Disabled';
                    label.classList.replace('text-success', 'text-secondary');
                }
            });
        });
        
    } catch (e) {
        console.error(e);
        container.innerHTML = 'Error loading properties.';
    }
}

async function saveProperties(id) {
    const form = document.getElementById('properties-form');
    const inputs = form.querySelectorAll('input, select');
    const props = {};
    
    inputs.forEach(input => {
        if(!input.name) return;
        
        if (input.type === 'checkbox') {
            props[input.name] = input.checked ? 'true' : 'false';
        } else {
            props[input.name] = input.value;
        }
    });
    
    try {
        const btn = document.querySelector('button[onclick^="saveProperties"]');
        const oldText = btn.innerText;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;

        await fetch(`/api/properties/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ properties: props })
        });
        
        btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
        btn.classList.replace('btn-primary', 'btn-success');
        
        setTimeout(() => {
            btn.innerText = oldText;
            btn.classList.replace('btn-success', 'btn-primary');
            btn.disabled = false;
        }, 2000);
        
    } catch (e) {
        alert('Failed to save settings.');
    }
}

async function promptTeleport(id, uuid, name) {
    document.getElementById('tp-player-server-id').value = id;
    document.getElementById('tp-player-name').value = name;
    document.getElementById('tp-display-name').innerText = name;
    
    // Reset fields
    document.getElementById('tp-x').value = '';
    document.getElementById('tp-y').value = '';
    document.getElementById('tp-z').value = '';
    document.getElementById('tp-target-player').value = '';
    
    const modalEl = document.getElementById('teleportModal');
    let modal = bootstrap.Modal.getInstance(modalEl);
    if (!modal) modal = new bootstrap.Modal(modalEl);
    
    modal.show();
}

async function submitTeleport() {
    const id = document.getElementById('tp-player-server-id').value;
    const name = document.getElementById('tp-player-name').value;
    
    const x = document.getElementById('tp-x').value;
    const y = document.getElementById('tp-y').value;
    const z = document.getElementById('tp-z').value;
    const targetPlayer = document.getElementById('tp-target-player').value;
    
    let target = '';
    if (targetPlayer.trim()) {
        target = targetPlayer.trim();
    } else if (x && y && z) {
        target = `${x} ${y} ${z}`;
    } else {
        alert("Please enter coordinates or a target player name.");
        return;
    }
    
    try {
        const res = await fetch(`/api/teleport/${id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({player: name, target: target})
        });
        const data = await res.json();
        alert(data.message);
        
        const el = document.getElementById('teleportModal');
        const modal = bootstrap.Modal.getInstance(el);
        modal.hide();
    } catch(e) { alert(e); }
}

function promptEffect(id, uuid, name) {
    document.getElementById('eff-player-server-id').value = id;
    document.getElementById('eff-player-name').value = name;
    
    // Reset defaults
    document.getElementById('eff-duration').value = '30';
    document.getElementById('eff-amp').value = '0';
    document.getElementById('eff-type').selectedIndex = 0;
    
    const modalEl = document.getElementById('effectModal');
    let modal = bootstrap.Modal.getInstance(modalEl);
    if(!modal) modal = new bootstrap.Modal(modalEl);
    
    modal.show();
}

async function submitEffect() {
    const id = document.getElementById('eff-player-server-id').value;
    const name = document.getElementById('eff-player-name').value;
    
    const effect = document.getElementById('eff-type').value;
    let duration = document.getElementById('eff-duration').value;
    let amplifier = document.getElementById('eff-amp').value;
    
    try {
        const res = await fetch(`/api/effect/${id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({player: name, effect: effect, duration: duration, amplifier: amplifier})
        });
        const data = await res.json();
        alert(data.message);
        
        const el = document.getElementById('effectModal');
        const modal = bootstrap.Modal.getInstance(el);
        modal.hide();
    } catch(e) { alert(e); }
}

async function healPlayer(id, name) {
    if(!await showConfirm("Heal Player", `Heal ${name} fully?`, "Heal", "success")) return;
    try {
        const res = await fetch(`/api/effect/${id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({player: name, effect: 'minecraft:instant_health', duration: 1, amplifier: 255})
        });
    } catch(e) { alert(e); }
}

async function feedPlayer(id, name) {
    if(!await showConfirm("Feed Player", `Feed ${name} fully?`, "Feed", "warning")) return;
    try {
        const res = await fetch(`/api/effect/${id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({player: name, effect: 'minecraft:saturation', duration: 1, amplifier: 255})
        });
    } catch(e) { alert(e); }
}

function promptXp(id, uuid, name) {
    document.getElementById('xp-player-server-id').value = id;
    document.getElementById('xp-player-name').value = name;
    document.getElementById('xp-amount').value = '10';
    document.getElementById('xp-type-levels').checked = true;
    
    const el = document.getElementById('xpModal');
    let modal = bootstrap.Modal.getInstance(el);
    if (!modal) modal = new bootstrap.Modal(el);
    
    modal.show();
}

async function submitXp() {
    const id = document.getElementById('xp-player-server-id').value;
    const name = document.getElementById('xp-player-name').value;
    const amount = document.getElementById('xp-amount').value;
    
    const isLevels = document.getElementById('xp-type-levels').checked;
    const cmdSuffix = isLevels ? 'levels' : 'points';
    
    let cmd = `experience add ${name} ${amount} ${cmdSuffix}`;
    
    await executeConsoleCommand(id, cmd);
    
    const el = document.getElementById('xpModal');
    const modal = bootstrap.Modal.getInstance(el);
    modal.hide();
}

function promptGamemode(id, uuid, name) {
    document.getElementById('gm-player-server-id').value = id;
    document.getElementById('gm-player-name').value = name;
    
    const el = document.getElementById('gamemodeModal');
    let modal = bootstrap.Modal.getInstance(el);
    if (!modal) modal = new bootstrap.Modal(el);
    
    modal.show();
}

async function submitGamemode(mode) {
    const id = document.getElementById('gm-player-server-id').value;
    const name = document.getElementById('gm-player-name').value;
    
    await executeConsoleCommand(id, `gamemode ${mode} ${name}`);
    
    const el = document.getElementById('gamemodeModal');
    const modal = bootstrap.Modal.getInstance(el);
    modal.hide();
}


function stepInput(id, amount) {
    const el = document.getElementById(id);
    if(!el) return;
    let val = parseFloat(el.value) || 0;
    val += amount;
    if(val < 0) val = 0;
    el.value = val;
}


async function opPlayerDirect(id, name) {
    if(!await showConfirm("Make Operator", `Make ${name} an operator?`, "Make OP", "primary")) return;
    try {
        const res = await fetch('/api/op/' + id, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({nickname: name})
        });
        const data = await res.json();
        alert(data.message);
    } catch(e) { alert(e); }
}

async function deopPlayer(id, name) {
    if(!await showConfirm("Remove Operator", `Remove operator status from ${name}?`, "De-Op", "warning")) return;
    try {
        await executeConsoleCommand(id, 'deop ' + name);
        alert('De-Op command sent.');
    } catch(e) { alert(e); }
}

async function addToWhitelistDirect(id, name) {
    try {
        const res = await fetch('/api/whitelist_add/' + id, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({nickname: name})
        });
        const data = await res.json();
        if(data.success) {
            alert(data.message);
        } else {
             alert('Error: ' + data.message);
        }
    } catch(e) { alert(e); }
}

async function createBackup(id) {
    const input = document.getElementById('backup-name-input');
    const name = input.value.trim();
    if (!name) {
        alert("Please enter a backup name.");
        return;
    }
    
    const btn = input.nextElementSibling;
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
        const res = await fetch(`/api/backup/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        const data = await res.json();
        
        if (data.success) {
            alert("Success: " + data.message);
            input.value = '';
            loadBackups(id);
        } else {
            alert("Error: " + data.message);
        }
    } catch (e) {
        console.error(e);
        alert("Failed to create backup.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
    }
}

async function loadBackups(id) {
    const backupList = document.getElementById('backup-list');
    if (!backupList) return;
    
    backupList.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted"><i class="fas fa-circle-notch fa-spin me-2"></i>Loading backups...</td></tr>';
    
    try {
        const res = await fetch(`/api/backups/${id}`);
        const data = await res.json();
        const backups = data.backups;
        
        backupList.innerHTML = '';
        if (backups.length === 0) {
            backupList.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No backups found.</td></tr>';
            return;
        }
        
        backups.forEach(backup => {
            const size = (backup.size / 1024 / 1024).toFixed(2) + ' MB';
            const date = new Date(backup.created * 1000).toLocaleString();
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="ps-4 fw-bold align-middle">
                    <div class="d-flex align-items-center">
                        <div class="backup-icon-wrapper me-3">
                            <i class="fas fa-file-archive"></i>
                        </div>
                        <span class="text-truncate" style="max-width: 250px;" title="${backup.name}">${backup.name}</span>
                    </div>
                </td>
                <td class="align-middle text-muted small"><i class="far fa-clock me-1"></i> ${date}</td>
                <td class="align-middle text-muted small fw-bold">${size}</td>
                <td class="text-end pe-4 backup-actions">
                    <button class="btn btn-sm btn-outline-primary border-opacity-25" onclick="restoreBackup('${id}', '${backup.name}')" title="Restore this backup" data-bs-toggle="tooltip">
                        <i class="fas fa-history"></i>
                    </button>
                    <a href="/api/download_backup/${id}/${backup.name}" class="btn btn-sm btn-outline-info border-opacity-25" title="Download File">
                        <i class="fas fa-download"></i>
                    </a>
                    <button class="btn btn-sm btn-outline-danger border-opacity-25" onclick="deleteBackup('${id}', '${backup.name}')" title="Delete Permanently">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            backupList.appendChild(tr);
        });
        
    } catch (e) {
        console.error(e);
        backupList.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-3">Failed to load backups.</td></tr>';
    }
}

async function restoreBackup(id, name) {
    if(!await showConfirm("Restore Backup", `Are you sure you want to restore backup "${name}"? \nWARNING: Current server files will be overwritten!`, "Restore", "danger")) return;
    
    const btn = event.currentTarget;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const res = await fetch(`/api/restore_backup/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        const data = await res.json();
        
        if (data.success) {
            alert("Success: " + data.message);
            window.location.reload();
        } else {
            alert("Error: " + data.message);
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    } catch (e) {
        console.error(e);
        alert("Failed to restore backup request.");
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

async function deleteBackup(id, name) {
    if(!await showConfirm("Delete Backup", `Are you sure you want to delete backup "${name}"?`, "Delete", "danger")) return;

    try {
        const res = await fetch(`/api/delete_backup/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        const data = await res.json();
        
        if (data.success) {
            loadBackups(id);
        } else {
            alert("Failed to delete backup.");
        }
    } catch (e) {
        console.error(e);
        alert("Error deleting backup.");
    }
}

async function uploadBackup(id, files) {
    if (files.length === 0) return;
    const file = files[0];
    
    const MAX_SIZE = 5 * 1024 * 1024 * 1024; 
    if (file.size > MAX_SIZE) {
        alert("File is too large. Max size is 5GB.");
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const btnLabel = document.querySelector('label[for="backup-upload"]');
    const oldHtml = btnLabel.innerHTML;
    btnLabel.style.pointerEvents = 'none';
    btnLabel.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';

    try {
        const res = await fetch(`/api/upload_backup/${id}`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            loadBackups(id);
        } else {
            alert('Upload failed: ' + data.message);
        }
    } catch (e) {
        console.error(e);
        alert('Upload error.');
    } finally {
        btnLabel.style.pointerEvents = 'auto';
        btnLabel.innerHTML = oldHtml;
        document.getElementById('backup-upload').value = '';
    }
}

function adjustConsoleHeight() { const sidebarContent = document.querySelector('.col-md-3 > div'); const consoleOutput = document.getElementById('console-output'); if (!sidebarContent || !consoleOutput) return; const sidebarHeight = document.querySelector('.col-md-3').offsetHeight; const tabNav = document.getElementById('serverTabs'); const consoleInput = document.getElementById('console-input'); const consoleInputRow = consoleInput ? consoleInput.parentElement : null; const consoleHeader = document.querySelector('.console-header'); let overhead = 0; if(tabNav) overhead += tabNav.offsetHeight + 16; if(consoleInputRow) overhead += consoleInputRow.offsetHeight + 16; if(consoleHeader) overhead += consoleHeader.offsetHeight; overhead += 50; const targetHeight = sidebarHeight - overhead; if(targetHeight > 200) { consoleOutput.style.height = targetHeight + 'px'; } } window.addEventListener('load', adjustConsoleHeight); window.addEventListener('resize', adjustConsoleHeight);
