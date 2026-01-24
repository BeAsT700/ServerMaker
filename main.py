import shutil
import sys
import threading
import webbrowser
from app import app

def check_java():
    if shutil.which('java') is None:
        return False
    return True

def open_browser():
    webbrowser.open('http://localhost:1010')

if __name__ == '__main__':
    if not check_java():
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, "Java не установлена или не найдена в PATH.\nУстановите Java JDK 17+", "ServerMaker - Ошибка", 0x10)
        sys.exit(1)
    
    threading.Timer(1.5, open_browser).start()
    app.run(host='0.0.0.0', port=1010, debug=False, use_reloader=False)
