#!/bin/bash

echo "==================================="
echo "Setting up Ollama for Linux"
echo "==================================="

# Check if Ollama is already installed
if command -v ollama &> /dev/null; then
    echo "✓ Ollama is already installed"
    ollama --version
else
    echo "Installing Ollama..."
    # Official Ollama install script for Linux
    curl -fsSL https://ollama.com/install.sh | sh
    
    if [ $? -eq 0 ]; then
        echo "✓ Ollama installed successfully"
    else
        echo "⚠ Failed to install Ollama. You can manually install from: https://ollama.com/download"
        exit 1
    fi
fi

echo ""
echo "Starting Ollama service..."
# Start Ollama service (may require sudo on some systems)
ollama serve &
OLLAMA_PID=$!
sleep 3

echo ""
echo "==================================="
echo "Pulling recommended models for story extraction"
echo "==================================="

# Pull lightweight models suitable for text analysis
echo "1. Pulling Llama 2 7B (general purpose, good for story analysis)..."
ollama pull llama2:7b

echo ""
echo "2. Pulling Mistral 7B (alternative, faster option)..."
ollama pull mistral:7b

echo ""
echo "3. Pulling Phi-2 (very lightweight, fast option)..."
ollama pull phi

echo ""
echo "==================================="
echo "Installing Python dependencies"
echo "==================================="

# Install Python Ollama client
.venv/bin/pip install ollama

echo ""
echo "==================================="
echo "Setup complete!"
echo "==================================="
echo ""
echo "Available models:"
ollama list

echo ""
echo "To test the setup, run:"
echo "  .venv/bin/python test_local_llm_chunking.py --file tests/mock_discord_export.html --model llama2:7b"
echo ""
echo "For your actual Discord logs (with sensitive content):"
echo "  .venv/bin/python test_local_llm_chunking.py --file ~/Projects/discord-chat-logs/YOUR_FILE.html --model llama2:7b"
echo ""
echo "Note: Ollama is now running in the background (PID: $OLLAMA_PID)"
echo "To stop it later: kill $OLLAMA_PID"