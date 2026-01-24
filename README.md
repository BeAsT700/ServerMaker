# 🎮 ServerMaker

<div align="center">

![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-2.0+-000000?style=for-the-badge&logo=flask&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white)
![License](https://img.shields.io/badge/License-CC%20BY--NC%204.0-blue?style=for-the-badge)

**A Modern Web Panel for Managing Minecraft Servers**

[Features](#-features) • [Installation](#-installation) • [Quick Start](#-quick-start) • [Usage](#-usage) • [API](#-api)

🇷🇺 [Русская версия](README_RU.md)

</div>

---

## 📋 Overview

**ServerMaker** is a lightweight and user-friendly web panel for creating and managing Minecraft servers. Built with Python and Flask, it provides a modern interface with dark/light theme support.

### Key Highlights:
- 🚀 **Quick Setup** — create a server in just a few clicks
- 🎨 **Modern UI** — beautiful interface with dark/light theme support
- 📊 **Real-time Monitoring** — console, status, online players
- 👥 **Player Management** — OP, ban, kick, whitelist, teleport, effects
- 📁 **File Manager** — browse, edit, upload files
- 💾 **Backup System** — create, restore, download backups

---

## ✨ Features

### 🖥️ Server Management
| Feature | Description |
|---------|-------------|
| Creation | Automatic core download (Vanilla, Fabric, Forge) |
| Start/Stop | Control server state |
| Console | Web console with command history and auto-scroll |
| Settings | Edit `server.properties` via GUI |

### 👤 Player Management
| Feature | Description |
|---------|-------------|
| Overview | List all players (online/offline) with avatars |
| Statistics | Health, hunger, XP, coordinates, effects |
| Administration | OP/De-OP, Kick, Ban/Unban, Whitelist |
| Actions | Teleport, effects, heal, feed, gamemode, XP |

### 📂 File Manager
- Navigate server directories
- View and edit text files
- Upload files (including drag & drop folders)
- Delete files and directories

### 💾 Backup System
- Create backups (ZIP archives)
- Restore from backup
- Upload/download backups
- Delete old backups

---

## 📦 Requirements

### System Requirements

| Component | Requirement |
|-----------|-------------|
| **OS** | Windows 10/11, Linux, macOS |
| **Python** | 3.8 or newer |
| **Java** | JDK 17+ (for Minecraft 1.18+) |
| **RAM** | At least 2 GB free memory |
| **Ports** | 1010 (panel), 25565+ (servers) |

### Python Dependencies

```
flask>=2.0
requests>=2.25
nbtlib>=2.0
```

---

## 🚀 Installation

### Windows

```powershell
# 1. Clone the repository (or download ZIP)
git clone https://github.com/skerkus/ServerMaker.git
cd ServerMaker

# 2. Create virtual environment
python -m venv .venv

# 3. Activate environment
.\.venv\Scripts\Activate.ps1

# 4. Install dependencies
pip install flask requests nbtlib
```

### Linux / macOS

```bash
# 1. Clone the repository
git clone https://github.com/skerkus/ServerMaker.git
cd ServerMaker

# 2. Create virtual environment
python3 -m venv .venv

# 3. Activate environment
source .venv/bin/activate

# 4. Install dependencies
pip install flask requests nbtlib
```

### Java Check

Make sure Java is installed and available:

```bash
java -version
```

If Java is not installed:
- **Windows**: Download [Adoptium JDK](https://adoptium.net/) or [Oracle JDK](https://www.oracle.com/java/technologies/downloads/)
- **Linux**: `sudo apt install openjdk-17-jdk` (Ubuntu/Debian)
- **macOS**: `brew install openjdk@17`

---

## ▶️ Quick Start

### Standard Launch

```bash
# Activate virtual environment (if not activated)
# Windows:
.\.venv\Scripts\Activate.ps1
# Linux/macOS:
source .venv/bin/activate

# Run the application
python main.py
```

### Successful Launch Output

```
Checking system requirements...
Starting ServerMaker on http://localhost:1010
```

### Access the Panel

Open your browser and navigate to:

🌐 **http://localhost:1010**

For local network access, use your computer's IP:

🌐 **http://YOUR_IP:1010**

---

## 📖 Usage

### Creating a Server

1. Click **"Create Server"** on the main page
2. Fill in the form:
   - **Name** — your server name
   - **Core** — Vanilla, Fabric, or Forge
   - **Version** — Minecraft version (e.g., 1.20.4)
   - **RAM** — allocated memory (in GB)
   - **EULA** — accept Mojang license agreement
3. Click **"Create"**

### Server Management

The server page has the following tabs:

| Tab | Description |
|-----|-------------|
| **Console** | Server console with command input |
| **Files** | File manager |
| **Players** | Player list and management |
| **Properties** | server.properties settings |
| **Backups** | Backup management |

### Working with Console

- Enter commands without `/` (e.g., `say Hello`, `op Player`)
- Use **↑/↓** to navigate command history
- Pause button stops auto-scrolling

### Player Management

1. Go to the **Players** tab
2. Click on a player card for detailed info
3. Available actions:
   - **KICK** — kick player from server
   - **BAN/UNBAN** — ban/unban player
   - **WHITELIST** — add/remove from whitelist
   - **OP/DE-OP** — grant/revoke operator rights
   - **TELEPORT** — teleport to coordinates/player
   - **EFFECT** — apply potion effect
   - **HEAL/FEED** — heal/feed player
   - **GAMEMODE** — change game mode
   - **+XP** — give experience

---

## 🔌 API

ServerMaker provides a REST API for integration:

### Main Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status/<id>` | Server status |
| POST | `/api/start/<id>` | Start server |
| POST | `/api/stop/<id>` | Stop server |
| POST | `/api/restart/<id>` | Restart server |
| GET/POST | `/api/console/<id>` | Logs / send command |
| GET | `/api/players/<id>` | Player list |
| GET | `/api/player_details/<id>/<uuid>` | Player data (NBT) |
| GET | `/api/files/<id>?path=` | File list |
| GET/POST | `/api/properties/<id>` | Server settings |
| GET | `/api/backups/<id>` | Backup list |
| POST | `/api/backup/<id>` | Create backup |

### Usage Example

```python
import requests

# Start server
response = requests.post('http://localhost:1010/api/start/1234567890')
print(response.json())

# Send command
response = requests.post(
    'http://localhost:1010/api/console/1234567890',
    json={'command': 'say Hello from API!'}
)
```

---

## 📁 Project Structure

```
ServerMaker/
├── main.py              # Entry point
├── app.py               # Flask application and routes
├── server_manager.py    # Server management logic
├── README.md            # Documentation (English)
├── README_RU.md         # Documentation (Russian)
│
├── static/              # Frontend resources
│   ├── script.js        # JavaScript logic
│   ├── style.css        # Main styles
│   ├── style_modals.css # Modal styles
│   ├── style_player.css # Player page styles
│   └── style_3d.css     # 3D effects for items
│
├── templates/           # HTML templates (Jinja2)
│   ├── layout.html      # Base template
│   ├── index.html       # Main page
│   ├── create.html      # Server creation
│   └── server.html      # Server control panel
│
├── data/                # Panel data
│   └── servers.json     # Server configuration
│
├── servers/             # Server directories
│   └── <server_id>/     # Specific server files
│
└── backups/             # Backup storage
    └── <server_id>/     # Specific server backups
```

---

## ⚙️ Configuration

### Changing Panel Port

In `main.py`:

```python
app.run(host='0.0.0.0', port=1010, debug=False)
#                       ^^^^ change port here
```

### Memory Recommendations

RAM is specified in GB when creating a server. Recommendations:
- **Vanilla (1-5 players)**: 2-4 GB
- **Vanilla (5-20 players)**: 4-8 GB
- **Modded (Forge/Fabric)**: 6-12 GB

---

## 🔧 Troubleshooting

### Java Not Found

```
CRITICAL ERROR: Java is not installed or not found in PATH.
```

**Solution**: Install Java and add it to PATH, or restart terminal after installation.

### Port In Use

```
Address already in use
```

**Solution**: Change port in `main.py` or terminate the process using the port.

### Server Won't Start

1. Check for `server.jar` in server folder
2. Check `eula.txt` — should be `eula=true`
3. Check logs in panel console

### Player Data Not Loading

Make sure that:
1. Player has joined the server at least once
2. World is saved (`save-all` in console)
3. `world/playerdata/` folder exists

---

## 📄 License

This project is licensed under **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.

### You are free to:
- ✅ **Use** — run and use for personal/educational purposes
- ✅ **Modify** — adapt and build upon the project
- ✅ **Share** — copy and redistribute in any format

### Under the following terms:
- 📛 **NonCommercial** — you may NOT use this project for commercial purposes without explicit permission from the author
- 📝 **Attribution** — you must give appropriate credit

For commercial use inquiries, please contact the author.

---

## 🤝 Contributing

Pull requests and issues are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

<div align="center">

**Made with ❤️ for the Minecraft Community**

</div>
