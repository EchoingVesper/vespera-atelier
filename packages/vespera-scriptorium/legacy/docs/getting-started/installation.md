# Installation Guide

**Get Vespera V2 running in minutes with this comprehensive installation guide.**

## 🎯 Quick Installation

For most users, this is the fastest way to get started:

```bash
# 1. Clone the repository
git clone https://github.com/your-org/vespera-atelier.git
cd vespera-atelier/packages/vespera-scriptorium

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Initialize the system
python setup_v2.py

# 4. Start the MCP server
./run_v2_server.sh

# 5. Start the REST API (optional, for plugins)
python run_api_server.py
```

That's it! Vespera V2 is now running with both MCP and REST API interfaces.

## 📋 Prerequisites

### System Requirements

- **Python**: 3.8 or higher (3.10+ recommended)
- **Operating System**: Linux, macOS, or Windows
- **Memory**: Minimum 512MB RAM, 2GB+ recommended
- **Storage**: 100MB for system, additional space for projects

### Required Python Packages

Vespera V2 automatically installs these dependencies:

```
# Core dependencies
fastmcp>=0.2.0           # Official MCP Python SDK
pydantic>=2.0.0          # Data validation and serialization
fastapi>=0.104.0         # REST API framework
uvicorn[standard]>=0.24.0 # ASGI server
websockets>=11.0         # Real-time communication
sqlite3                  # Embedded database (built-in)

# AI and Search
chromadb>=0.4.0          # Vector database for semantic search
sentence-transformers    # Text embedding models
kuzu>=0.1.0             # Graph database for dependency analysis

# Background Services
watchfiles>=0.20.0       # File system monitoring
asyncio                 # Async task management
schedule>=1.2.0         # Task scheduling

# Development and Testing
pytest>=7.0.0           # Testing framework
black>=23.0.0           # Code formatting
isort>=5.0.0            # Import sorting
```

### Optional Dependencies

For enhanced functionality:

```bash
# For Docker deployment
docker>=20.0.0
docker-compose>=2.0.0

# For VS Code plugin development
node>=16.0.0
npm>=8.0.0

# For advanced monitoring
prometheus-client>=0.17.0
grafana>=9.0.0
```

## 🚀 Installation Methods

### Method 1: Standard Installation (Recommended)

This method sets up Vespera V2 with all features enabled:

```bash
# 1. Clone and navigate
git clone https://github.com/your-org/vespera-atelier.git
cd vespera-atelier/packages/vespera-scriptorium

# 2. Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Initialize Vespera V2
python setup_v2.py

# 5. Verify installation
python -c "from tasks import TaskManager; print('✓ Task system ready')"
python -c "from roles import RoleManager; print('✓ Role system ready')"
python -c "from mcp.server.fastmcp import FastMCP; print('✓ MCP integration ready')"
```

### Method 2: Development Installation

For contributors and advanced users:

```bash
# 1. Clone with development tools
git clone https://github.com/your-org/vespera-atelier.git
cd vespera-atelier/packages/vespera-scriptorium

# 2. Install with development dependencies
pip install -r requirements.txt
pip install -e .  # Editable installation

# 3. Install development tools
pip install black isort pytest pytest-cov

# 4. Setup pre-commit hooks
pre-commit install

# 5. Run full test suite
python run_tests.py
```

### Method 3: Docker Installation

For containerized deployments:

```bash
# 1. Clone repository
git clone https://github.com/your-org/vespera-atelier.git
cd vespera-atelier/packages/vespera-scriptorium

# 2. Build Docker image
docker build -t vespera-v2 .

# 3. Run container
docker run -d \
  --name vespera-v2 \
  -p 8000:8000 \
  -v $(pwd)/.vespera_v2:/app/.vespera_v2 \
  vespera-v2

# 4. Verify container
docker logs vespera-v2
```

### Method 4: MCP-Only Installation

For Claude Code integration only:

```bash
# 1. Minimal installation
pip install fastmcp pydantic sqlite3

# 2. Clone MCP server only
wget https://raw.githubusercontent.com/your-org/vespera-atelier/main/packages/vespera-scriptorium/mcp_server_v2.py

# 3. Setup MCP environment
mkdir .vespera_v2
python mcp_server_v2.py --setup

# 4. Configure Claude Code
# Add to ~/.claude/config.json:
{
  "mcpServers": {
    "vespera-scriptorium": {
      "command": "python",
      "args": ["path/to/mcp_server_v2.py"]
    }
  }
}
```

## ⚙️ Configuration

### Initial Setup

After installation, run the setup script:

```bash
python setup_v2.py
```

This script:
- Creates the `.vespera_v2` data directory
- Initializes SQLite databases
- Sets up ChromaDB for semantic search
- Configures default roles and capabilities
- Creates example project templates

### Directory Structure

After installation, your directory will look like this:

```
vespera-scriptorium/
├── .vespera_v2/           # Data directory
│   ├── tasks.db          # Main task database
│   ├── chroma/           # Semantic search database
│   ├── kuzu/             # Graph analysis database
│   └── config/           # Configuration files
├── mcp_server_v2.py      # MCP server
├── run_api_server.py     # REST API server
├── api/                  # REST API implementation
├── tasks/                # Task management system
├── roles/                # Role and capability system
├── templates/            # Project templates
├── tests/                # Test suite
└── docs/                 # Documentation
```

### Environment Configuration

Create a `.env` file for custom configuration:

```bash
# Core settings
VESPERA_DATA_DIR=.vespera_v2
VESPERA_LOG_LEVEL=INFO

# API settings (if using REST API)
VESPERA_API_HOST=0.0.0.0
VESPERA_API_PORT=8000
VESPERA_API_SECRET=your-secret-key-here

# Database settings
SQLITE_DATABASE_PATH=.vespera_v2/tasks.db
CHROMA_PERSIST_DIRECTORY=.vespera_v2/chroma
KUZU_DATABASE_PATH=.vespera_v2/kuzu

# Background services
ENABLE_AUTO_EMBEDDING=true
ENABLE_CYCLE_DETECTION=true
ENABLE_SYNC_SERVICES=true

# Performance tuning
MAX_CONCURRENT_TASKS=10
EMBEDDING_BATCH_SIZE=100
SYNC_INTERVAL_SECONDS=30
```

## 🔧 Starting Vespera V2

### MCP Server (Primary Interface)

For Claude Code integration:

```bash
# Method 1: Using the startup script
./run_v2_server.sh

# Method 2: Direct Python execution
python mcp_server_v2.py

# Method 3: With custom data directory
VESPERA_DATA_DIR=/custom/path python mcp_server_v2.py
```

### REST API Server (Plugin Interface)

For VS Code, Obsidian, and custom integrations:

```bash
# Method 1: Using the startup script
python run_api_server.py

# Method 2: Using uvicorn directly
uvicorn api.server:app --host 0.0.0.0 --port 8000 --reload

# Method 3: Production deployment
uvicorn api.server:app --host 0.0.0.0 --port 8000 --workers 4
```

### Background Services

Background services start automatically with the MCP server. To manage them separately:

```bash
# Start background services
python -c "from databases import BackgroundServiceManager; BackgroundServiceManager().start_all_services()"

# Check service status
python -c "from databases import BackgroundServiceManager; print(BackgroundServiceManager().get_service_status())"

# Stop background services
python -c "from databases import BackgroundServiceManager; BackgroundServiceManager().stop_all_services()"
```

## ✅ Verification

### Health Checks

Verify your installation with these commands:

```bash
# 1. Test MCP server
python -c "
from mcp_server_v2 import get_managers
task_manager, role_manager = get_managers()
print('✓ MCP server initialized successfully')
print(f'✓ Available roles: {len(role_manager.list_roles())}')
"

# 2. Test task creation
python -c "
from tasks import TaskManager
from roles import RoleManager
role_manager = RoleManager('.')
task_manager = TaskManager('.', role_manager)
task = task_manager.create_task('Test installation', 'Verification task')
print(f'✓ Task created: {task.task_id}')
"

# 3. Test semantic search
python -c "
from databases import ChromaService
chroma = ChromaService()
chroma.initialize()
print('✓ Semantic search database ready')
"

# 4. Test REST API (if running)
curl -f http://localhost:8000/health && echo "✓ REST API responding"
```

### Functional Tests

Run the test suite to verify all components:

```bash
# Quick test (essential functionality)
python -m pytest tests/system/test_task_system.py -v

# Role system test
python -m pytest tests/system/test_role_system.py -v

# MCP integration test
python -m pytest tests/integration/test_mcp_fastmcp.py -v

# Full test suite (all functionality)
python run_tests.py
```

### Performance Verification

Check that performance meets expectations:

```bash
# Run performance tests
python performance_test.py

# Expected results:
# ✓ Task creation: <100ms
# ✓ Semantic search: <500ms
# ✓ Dependency analysis: <200ms
# ✓ Background sync: <1s
```

## 🐛 Troubleshooting

### Common Installation Issues

#### Python Version Conflicts

```bash
# Error: "Python 3.x is required"
# Solution: Install correct Python version
sudo apt update && sudo apt install python3.10 python3.10-venv
python3.10 -m venv venv
source venv/bin/activate
```

#### Missing Dependencies

```bash
# Error: "ModuleNotFoundError: No module named 'fastmcp'"
# Solution: Install missing dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Force reinstall if needed
pip install --force-reinstall fastmcp
```

#### Permission Errors

```bash
# Error: "Permission denied when creating .vespera_v2"
# Solution: Fix directory permissions
sudo chown -R $USER:$USER .
chmod 755 .vespera_v2
```

#### Database Initialization Failures

```bash
# Error: "Failed to initialize SQLite database"
# Solution: Check write permissions and disk space
ls -la .vespera_v2/
df -h .  # Check disk space
rm .vespera_v2/tasks.db  # Remove corrupted database
python setup_v2.py  # Reinitialize
```

### System-Specific Issues

#### Windows

```powershell
# Install Visual C++ Build Tools if needed
# Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/

# Use PowerShell instead of Command Prompt
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Create virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1
```

#### macOS

```bash
# Install Xcode Command Line Tools if needed
xcode-select --install

# Use Homebrew for Python
brew install python@3.10
brew install git

# Fix SSL certificates if needed
/Applications/Python\ 3.10/Install\ Certificates.command
```

#### Linux (Ubuntu/Debian)

```bash
# Install required system packages
sudo apt update
sudo apt install python3-pip python3-venv python3-dev
sudo apt install build-essential libssl-dev libffi-dev

# For CentOS/RHEL
sudo yum install python3-pip python3-devel gcc openssl-devel libffi-devel
```

### Performance Issues

#### Slow Startup

```bash
# Optimize embedding model loading
export TRANSFORMERS_CACHE=/tmp/transformers_cache
export HF_HOME=/tmp/huggingface_cache

# Use smaller embedding model
export VESPERA_EMBEDDING_MODEL=all-MiniLM-L6-v2
```

#### High Memory Usage

```bash
# Reduce batch sizes
export EMBEDDING_BATCH_SIZE=50
export MAX_CONCURRENT_TASKS=5

# Disable background services temporarily
export ENABLE_AUTO_EMBEDDING=false
export ENABLE_SYNC_SERVICES=false
```

### Getting Help

If you encounter issues not covered here:

1. **Check logs**: `tail -f .vespera_v2/logs/vespera.log`
2. **Run diagnostics**: `python -m vespera.diagnostics`
3. **Consult troubleshooting guide**: [Troubleshooting](troubleshooting.md)
4. **Report issues**: [GitHub Issues](https://github.com/your-org/vespera-atelier/issues)

## 🎯 Next Steps

After successful installation:

1. **[Quick Start Tutorial](quick-start.md)** - Create your first project in 5 minutes
2. **[First Project Guide](first-project.md)** - Detailed walkthrough of project setup
3. **[Task Management Guide](../users/task-management.md)** - Master hierarchical workflows
4. **[API Reference](../developers/api-reference.md)** - Integrate with plugins

## 📚 Advanced Configuration

### Production Deployment

For production environments:

```bash
# Create systemd service (Linux)
sudo tee /etc/systemd/system/vespera-v2.service > /dev/null <<EOF
[Unit]
Description=Vespera V2 Task Orchestrator
After=network.target

[Service]
Type=simple
User=vespera
WorkingDirectory=/opt/vespera-v2
ExecStart=/opt/vespera-v2/venv/bin/python mcp_server_v2.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable vespera-v2
sudo systemctl start vespera-v2
```

### Multiple Environments

For development, staging, and production:

```bash
# Environment-specific configuration
mkdir -p config/{development,staging,production}

# Development config
cat > config/development/.env <<EOF
VESPERA_LOG_LEVEL=DEBUG
VESPERA_API_PORT=8000
ENABLE_AUTO_EMBEDDING=true
EOF

# Production config
cat > config/production/.env <<EOF
VESPERA_LOG_LEVEL=INFO
VESPERA_API_PORT=80
ENABLE_AUTO_EMBEDDING=true
MAX_CONCURRENT_TASKS=20
EOF

# Load environment-specific config
export VESPERA_ENV=development
python mcp_server_v2.py
```

### Monitoring and Metrics

Enable monitoring for production deployments:

```bash
# Install monitoring dependencies
pip install prometheus-client grafana-api

# Enable metrics collection
export ENABLE_METRICS=true
export METRICS_PORT=9090

# Start with metrics
python mcp_server_v2.py --enable-metrics
```

---

**Installation complete!** You're now ready to start using Vespera V2's powerful project orchestration capabilities.

*Need help? Check out the [Troubleshooting Guide](troubleshooting.md) or join our [Community Discussions](https://github.com/your-org/vespera-atelier/discussions).*