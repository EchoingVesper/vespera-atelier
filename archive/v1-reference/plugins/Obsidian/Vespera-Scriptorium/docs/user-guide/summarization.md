# Using the Summarization Feature

This guide explains how to use Vespera Scriptorium's summarization feature to create concise summaries of your documents.

## Overview

The summarization feature now leverages the flexible n8n-inspired processing pipeline to analyze your documents and generate concise summaries that capture the key points. This new architecture allows for more robust and customizable summarization workflows. This can help you:

- Quickly understand the main ideas of long documents
- Create executive summaries of research papers or reports
- Generate abstracts for your own writing
- Extract key information from meeting notes or lectures

## Using Summarization Workflows

Summarization is now handled through predefined or custom pipeline workflows.

### Running a Summarization Workflow on a Document

1. Open the document you want to summarize in Obsidian.
2. Access the command palette (Ctrl/Cmd + P) and search for "Vespera Scriptorium: Run Workflow".
3. Select the desired summarization workflow from the list (e.g., "Standard Summarization", "Detailed Summary").
4. The workflow will process the document through its defined stages (ingestion, chunking, LLM calls, etc.).
5. The generated summary will be displayed or saved according to the workflow's configuration and your plugin settings.

### Summarizing a Selection

1. Select the text you want to summarize in your document.
2. Right-click and select "Vespera Scriptorium: Run Workflow on Selection" or use the command palette and search for "Vespera Scriptorium: Run Workflow on Selection".
3. Select the desired summarization workflow.
4. The workflow will process the selected text.
5. The generated summary will be displayed or saved.

## Customizing Summarization Workflows

### Custom Summarization Templates

Summarization workflows are defined by a series of connected nodes within the processing pipeline. Advanced users can potentially create or modify these workflows (details on workflow creation/editing will be provided in developer documentation).

However, you can still influence summarization output through:

### Customizing LLM Node Parameters

Within the plugin settings, you can configure the behavior of the LLM nodes used in summarization workflows. This includes adjusting parameters like:

- **Temperature**: Controls the randomness of the output.
- **Top P**: Controls the diversity of the output.
- **Model**: Select a different LLM model for the summarization node.

Refer to the [Configuration Guide](configuration.md) for details on adjusting LLM node settings.

### Using Different Summarization Workflows

As more workflows are added, you will be able to select different summarization workflows tailored for various purposes (e.g., summarizing meeting notes, research papers, creative writing).

### Multi-Document Summarization

1. When summarizing a document, select your custom template from the dropdown menu
2. Adjust any additional parameters as needed
3. Generate your summary

To summarize multiple documents together using a workflow:

1. Access the command palette (Ctrl/Cmd + P) and search for "Vespera Scriptorium: Run Workflow on Multiple Documents".
2. In the file selector, choose the documents you want to summarize.
3. Select the desired summarization workflow.
4. The workflow will process the selected documents.
5. A combined summary will be generated that synthesizes information from all selected documents, according to the workflow's design.

## Working with Summaries

### Editing Summaries

Generated summaries are regular Markdown text that you can edit like any other content in Obsidian.

### Saving Summaries

Depending on your [configuration settings](configuration.md), summaries may be:

- Inserted directly into your current document
- Created as new notes in your vault
- Displayed in a temporary view

To manually save a summary that's displayed in a temporary view:

1. Click the "Save" button in the summary view
2. Choose a location and filename for the summary
3. Click "Save" to create a new note with the summary content

## Troubleshooting

If you encounter issues with the summarization feature:

- Ensure your LLM provider is properly configured in the settings
- Check that your document isn't too large for processing (consider chunking large documents)
- Verify that you have a stable internet connection if using remote LLM providers
- Try adjusting the processing parameters in the settings

## Next Steps

After mastering the summarization feature, you may want to explore:

- [Tutorials](../tutorials/README.md) for advanced usage scenarios.
- [FAQ](../faq.md) for answers to common questions.