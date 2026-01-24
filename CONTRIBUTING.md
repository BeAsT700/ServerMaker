# Contributing to ServerMaker

Thank you for your interest in contributing to ServerMaker! 🎮

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](../../issues)
2. If not, create a new issue with:
   - Clear title describing the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, Python version, Java version)

### Suggesting Features

1. Open a new issue with the `enhancement` label
2. Describe the feature and why it would be useful
3. Include mockups or examples if possible

### Pull Requests

1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test your changes thoroughly
5. Commit with clear messages: `git commit -m "Add: description"`
6. Push to your fork: `git push origin feature/your-feature`
7. Open a Pull Request

### Code Style

- **Python**: Follow PEP 8 guidelines
- **JavaScript**: Use consistent formatting (2 spaces)
- **CSS**: Group related properties together
- **HTML**: Use proper indentation (2 spaces)

### Commit Messages

Use clear, descriptive commit messages:
- `Add: new feature description`
- `Fix: bug description`
- `Update: what was updated`
- `Remove: what was removed`
- `Refactor: what was refactored`

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/ServerMaker.git
cd ServerMaker

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# or
.\.venv\Scripts\Activate.ps1  # Windows

# Install dependencies
pip install -r requirements.txt

# Run in development mode
python main.py
```

## Project Structure

```
ServerMaker/
├── main.py              # Entry point
├── app.py               # Flask routes
├── server_manager.py    # Core logic
├── static/              # CSS, JS
├── templates/           # HTML templates
└── data/                # Runtime data
```

## Questions?

Feel free to open an issue for any questions!

---

Thank you for contributing! ❤️
