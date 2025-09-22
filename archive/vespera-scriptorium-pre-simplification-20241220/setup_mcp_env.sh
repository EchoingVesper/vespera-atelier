#!/bin/bash
# Setup script for Vespera V2 MCP Server environment

set -e  # Exit on any error

echo "🔧 Setting up Vespera V2 MCP Server environment..."

# Change to script directory
cd "$(dirname "$0")"

# Remove existing virtual environment if it exists
if [ -d "mcp_venv" ]; then
    echo "   Removing existing virtual environment..."
    rm -rf mcp_venv
fi

# Create fresh virtual environment
echo "   Creating virtual environment..."
python3 -m venv mcp_venv

# Activate and install dependencies
echo "   Installing dependencies..."
./mcp_venv/bin/pip install --upgrade pip
./mcp_venv/bin/pip install -r requirements.txt

# Make run script executable
chmod +x run_v2_server.sh

echo "✅ Environment setup complete!"
echo ""
echo "To test the server:"
echo "   ./run_v2_server.sh"
echo ""
echo "To add to Claude Code:"
echo "   claude mcp add vespera-scriptorium $(pwd)/run_v2_server.sh"