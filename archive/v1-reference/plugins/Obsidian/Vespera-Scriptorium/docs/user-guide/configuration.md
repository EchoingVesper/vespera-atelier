# Configuring Vespera Scriptorium

This guide explains how to configure Vespera Scriptorium to suit your specific needs and preferences.

## Accessing Configuration Settings

To access Vespera Scriptorium's configuration settings:

1. Open Obsidian
2. Go to Settings (gear icon in the bottom left)
3. Select "Community plugins" from the left sidebar
4. Find "Vespera Scriptorium" in the list of installed plugins
5. Click the gear icon next to it to open plugin settings

## General Settings

### Plugin Activation

- **Enable Ribbon Icon**: Toggle to show/hide the Vespera Scriptorium icon in the Obsidian ribbon
- **Enable Command Palette Commands**: Toggle to show/hide Vespera Scriptorium commands in the command palette

### User Interface

- **Theme**: Choose between Light, Dark, or System Default
- **Show Progress Indicators**: Toggle to show/hide progress indicators during processing
- **Display Mode**: Choose how results are displayed (inline, new note, split view)

## LLM Configuration

Vespera Scriptorium can connect to various Large Language Model (LLM) providers for text processing:

### Local LLM Options

- **Provider**: Select your local LLM provider (Ollama, LM Studio, etc.)
- **Model**: Choose the specific model to use
- **API Endpoint**: Configure the endpoint URL for your local LLM
- **Parameters**: Adjust temperature, top_p, and other generation parameters

### Remote LLM Options

- **Provider**: Select your remote LLM provider
- **API Key**: Enter your API key for the selected provider
- **Model**: Choose the specific model to use
- **Parameters**: Adjust temperature, top_p, and other generation parameters

## Processing Pipeline Configuration

Vespera Scriptorium now uses a flexible, n8n-inspired processing pipeline. Configuration options for the pipeline allow you to customize how documents are processed through different stages and nodes.

### Pipeline Stages and Queues

- **Ingestion Queue**: Configure settings related to the initial ingestion of documents into the pipeline.
- **Classification Queue**: Configure settings for the classification stage, where document types or content are identified.
- **Extraction Queue**: Configure settings for the extraction stage, where key information is pulled from documents.
- **Output Queue**: Configure settings for the final output stage.
- **Queue Persistence**: Options for how processing queues are stored (e.g., file-based).

### LLM Node Configuration

LLM calls are now handled by dedicated nodes within the pipeline. Configuration for these nodes includes:

- **LLM Provider**: Select the LLM provider for specific nodes.
- **Model**: Choose the model to be used by an LLM node.
- **Parameters**: Adjust generation parameters (temperature, top_p, etc.) for LLM nodes.
- **Retry Mechanisms**: Configure retry logic for failed LLM calls within a node.

### Orchestration Settings

- **Concurrency Limits**: Set limits on how many processing tasks can run simultaneously.
- **Error Handling**: Configure how the pipeline handles errors at different stages or within nodes.
- **Workflow Definition**: (Advanced) Options for defining or selecting specific processing workflows.

## Output Settings

- **Output Format**: Choose between Markdown, HTML, or plain text
- **Include Metadata**: Toggle to include/exclude metadata in the output
- **Auto-Save**: Toggle to automatically save generated content
- **Save Location**: Specify where to save generated content

## Advanced Settings
## Data Storage Location

The default data storage location is `.vespera-scriptorium/processing`. Upon plugin update, an automatic migration process will move existing data to the new location.

- **Debug Mode**: Toggle to enable/disable debug logging
- **Cache Results**: Toggle to cache processing results for faster repeat operations
- **Custom Templates**: Configure custom prompt templates for different operations

## Saving Your Configuration

Changes to the configuration are automatically saved when you close the settings panel. You can also:

- **Reset to Defaults**: Reset all settings to their default values
- **Export Settings**: Export your configuration to a JSON file
- **Import Settings**: Import a previously exported configuration

## Next Steps

After configuring Vespera Scriptorium, you may want to:

- Learn how to use the [summarization feature](summarization.md), which now runs as a pipeline workflow.
- Check out the [tutorials](../tutorials/README.md) for step-by-step guides.