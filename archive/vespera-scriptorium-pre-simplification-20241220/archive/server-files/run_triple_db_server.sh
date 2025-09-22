#!/bin/bash
"""
Startup script for Vespera V2 Triple Database MCP Server
"""

set -e

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Vespera V2 Triple Database MCP Server..."
echo "Working directory: $SCRIPT_DIR"

# Check if virtual environment exists
if [ ! -d "mcp_venv" ]; then
    echo "Creating MCP virtual environment..."
    python3 -m venv mcp_venv
    source mcp_venv/bin/activate
    
    echo "Installing dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt
    
    # Install optional dependencies for triple database
    echo "Installing optional dependencies for triple database integration..."
    pip install chromadb kuzu sentence-transformers
else
    source mcp_venv/bin/activate
fi

# Check Python version
echo "Python version: $(python --version)"

# Check if required packages are installed
echo "Checking dependencies..."
python -c "import chromadb; print(f'ChromaDB: {chromadb.__version__}')" 2>/dev/null || echo "Warning: ChromaDB not available"
python -c "import kuzu; print(f'KuzuDB: {kuzu.__version__}')" 2>/dev/null || echo "Warning: KuzuDB not available"

# Set environment variables
export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"

# Run the server
echo "Starting triple database MCP server..."
python mcp_server_triple_db.py