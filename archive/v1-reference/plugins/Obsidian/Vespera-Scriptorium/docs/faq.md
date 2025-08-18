# Frequently Asked Questions (FAQ)

This document answers common questions about Vespera Scriptorium.

## General Questions

### What is Vespera Scriptorium?

Vespera Scriptorium is an Obsidian plugin designed to enhance document processing and summarization. It uses advanced language models to analyze your documents and generate concise summaries, helping you quickly understand key information.

### Is Vespera Scriptorium free to use?

Yes, Vespera Scriptorium is free and open-source. However, if you choose to use remote LLM providers, they may have their own pricing models for API usage.

### Does Vespera Scriptorium work offline?

Yes, Vespera Scriptorium can work completely offline when configured to use local LLM providers like Ollama or LM Studio.

### What languages does Vespera Scriptorium support?

Vespera Scriptorium's language support depends on the LLM provider you're using. Most modern LLMs support multiple languages, but performance may vary across languages.

## Installation and Setup

### How do I install Vespera Scriptorium?

Please refer to our [Installation Guide](user-guide/installation.md) for detailed instructions.

### What are the system requirements?

Vespera Scriptorium requires:
- Obsidian version 0.15.0 or higher
- If using local LLM providers: sufficient RAM and disk space to run the LLM
- If using remote LLM providers: a stable internet connection

### How do I configure Vespera Scriptorium?

Please refer to our [Configuration Guide](user-guide/configuration.md) for detailed instructions.

### Which LLM providers are supported?

Vespera Scriptorium supports various LLM providers, including:
- Local providers: Ollama, LM Studio
- Remote providers: OpenAI, Anthropic, and others

## Usage Questions

### How do I summarize a document?

Please refer to our [Summarization Guide](user-guide/summarization.md) for detailed instructions.

### How long can the documents be?

The maximum document length depends on your LLM provider and configuration. Vespera Scriptorium includes chunking functionality to process longer documents by breaking them into smaller pieces.

### Can I customize the summaries?

Yes, you can customize summaries by:
- Adjusting the summary length (brief, standard, detailed)
- Choosing different summary styles (informative, descriptive, analytical)
- Selecting different output formats (paragraph, bullet points, structured)
- Creating custom templates for specific types of content

### Can I summarize multiple documents at once?

Yes, Vespera Scriptorium supports multi-document summarization, allowing you to create summaries that synthesize information from multiple sources.

## Troubleshooting

### The plugin isn't generating summaries

This could be due to several reasons:
1. Check that your LLM provider is properly configured
2. Ensure you have a stable internet connection if using remote providers
3. Verify that the document isn't too large (try summarizing a smaller section)
4. Check the console for error messages (Ctrl+Shift+I in Obsidian)

### The summaries are low quality

To improve summary quality:
1. Try a different LLM model
2. Adjust the generation parameters (temperature, top_p, etc.)
3. Use a custom template with more specific instructions
4. Break down very complex documents into smaller sections

### The plugin is running slowly

Performance depends on several factors:
1. If using local LLMs, ensure your computer meets the recommended specifications
2. For remote LLMs, check your internet connection
3. Try processing smaller chunks of text
4. Adjust the processing parameters in the settings

### I'm getting error messages

Common error messages and solutions:
1. "API Key Invalid": Check your API key in the settings
2. "Connection Failed": Verify your internet connection or local LLM setup
3. "Context Length Exceeded": Reduce the chunk size or summarize a smaller section
4. "Rate Limit Exceeded": Wait and try again later (applies to remote APIs)

## Feature Requests and Bug Reports

### How do I request a new feature?

You can request new features by opening an issue on our [GitHub repository](https://github.com/yourusername/vespera-scriptorium) with the label "feature request."

### How do I report a bug?

You can report bugs by opening an issue on our [GitHub repository](https://github.com/yourusername/vespera-scriptorium) with the label "bug." Please include:
1. A description of the bug
2. Steps to reproduce the issue
3. Expected behavior
4. Actual behavior
5. Screenshots if applicable
6. Your system information

### How can I contribute to the project?

We welcome contributions! Please visit our [GitHub repository](https://github.com/yourusername/vespera-scriptorium) to learn how to contribute.