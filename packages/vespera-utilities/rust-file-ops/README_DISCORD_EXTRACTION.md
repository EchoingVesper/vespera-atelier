# Discord Story Extraction Tool

A privacy-focused tool for extracting story development content from Discord chat logs using local LLM processing.

## Overview

This tool helps extract story development discussions from Discord DM exports while maintaining complete privacy of sensitive content by using local LLM processing. It's designed specifically for creative collaborators who need to mine their chat history for story elements without exposing private conversations to cloud services.

## Features

- **100% Local Processing**: All content analysis happens on your machine
- **Smart Chunking**: Preserves conversation context while staying within LLM token limits
- **Story-Aware Extraction**: Identifies characters, plot points, world-building, and themes
- **Flexible Analysis**: Works with or without local LLM (fallback to keyword-based analysis)
- **Markdown Summaries**: Generates organized summaries of extracted story elements

## Setup

### 1. Build the Rust Library

```bash
# Install Rust if you haven't already
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build the library with Python bindings
maturin develop --release
```

### 2. Install Python Dependencies

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Linux/Mac
# or
.venv\Scripts\activate  # On Windows

# Install required packages
pip install ollama  # For local LLM support
```

### 3. Install Ollama (for Local LLM Processing)

```bash
# On Linux:
curl -fsSL https://ollama.com/install.sh | sh

# On Mac:
brew install ollama

# On Windows:
# Download from https://ollama.com/download

# Start Ollama service
ollama serve

# Pull recommended models
ollama pull llama2:7b      # General purpose, good for story analysis
ollama pull mistral:7b     # Faster alternative
ollama pull phi            # Very lightweight option
```

## Usage

### Basic Usage (with mock data for testing)

```bash
# Test with the provided mock Discord export
.venv/bin/python test_local_llm_chunking.py \
    --file tests/mock_discord_export.html \
    --model llama2:7b
```

### Processing Your Real Discord Exports

```bash
# With local LLM (recommended for sensitive content)
.venv/bin/python test_local_llm_chunking.py \
    --file ~/Projects/discord-chat-logs/your-export.html \
    --model llama2:7b \
    --output story_extraction

# Without LLM (keyword-based fallback)
.venv/bin/python test_local_llm_chunking.py \
    --file ~/Projects/discord-chat-logs/your-export.html \
    --no-llm \
    --output story_extraction
```

### Output

The tool generates:
- `{filename}_analysis.json`: Detailed chunk-by-chunk analysis
- `{filename}_summary.md`: Markdown summary of extracted story elements

## How It Works

1. **Parsing**: Reads Discord HTML exports (from Discord Chat Exporter)
2. **Chunking**: Splits conversations into manageable chunks while preserving context
3. **Analysis**: Each chunk is analyzed for story-related content:
   - Characters and their descriptions
   - Plot points and story events
   - World-building elements
   - Themes and motifs
4. **Aggregation**: Combines findings across all chunks
5. **Summary**: Creates organized documentation of your story development

## Privacy & Security

- **No Cloud Services**: All processing happens locally on your machine
- **No Data Transmission**: Your conversations never leave your computer
- **Sensitive Content Safe**: NSFW or private content stays completely private
- **Open Source**: Full transparency - you can audit the code

## Customization

### Adjusting Chunk Size

Edit the `max_tokens_per_chunk` parameter in the script:
```python
chunks = vfo.py_chunk_discord_html(
    html_content,
    preserve_conversations=True,
    max_tokens_per_chunk=3000  # Increase for larger chunks
)
```

### Adding Custom Keywords

Modify the `story_keywords` set in `LocalLLMProcessor._fallback_analysis()`:
```python
story_keywords = {
    'character', 'protagonist', 'your_custom_keyword',
    # ... add more relevant terms
}
```

### Custom LLM Prompts

Edit the prompt in `LocalLLMProcessor.analyze_chunk_for_story()` to focus on specific aspects:
```python
prompt = f"""Analyze this conversation for [YOUR SPECIFIC FOCUS].
Extract and categorize any discussions about:
- [Your specific interest 1]
- [Your specific interest 2]
...
"""
```

## Troubleshooting

### "Ollama not running"
```bash
# Start Ollama service
ollama serve
```

### "Model not found"
```bash
# Pull the model
ollama pull llama2:7b
```

### "vespera_file_ops not found"
```bash
# Rebuild the library
maturin develop --release
```

### Parsing errors with Discord exports
- Ensure you're using exports from [Discord Chat Exporter](https://github.com/Tyrrrz/DiscordChatExporter)
- The tool expects HTML format exports (not JSON or CSV)

## Performance Tips

- **Model Selection**: 
  - `phi`: Fastest, lowest resource usage, basic analysis
  - `mistral:7b`: Good balance of speed and quality
  - `llama2:7b`: Best quality, slower processing
  
- **Chunk Size**: Larger chunks = fewer LLM calls but may miss details
- **Fallback Mode**: Use `--no-llm` for quick keyword-based scanning

## Example Output

### Summary (markdown)
```markdown
# Story Development Summary

## Characters
- **Kira** (mentioned 15 times)
- **Thane** (mentioned 8 times)

## Plot Development
1. Kira witnesses illegal magic use in the outer ring
2. Test reveals Kira's latent abilities
3. Introduction to resistance movement
...

## World Building
### Magic System
- Emotion-based magic system
- Different schools for different emotions
- Suppression prevents magic access
...

## Themes
- Emotional suppression vs expression
- Systemic oppression
- Inherited trauma
```

## Contributing

This tool is part of the Vespera Atelier project. Contributions welcome!

## License

GNU Affero General Public License v3.0 (AGPL-3.0)