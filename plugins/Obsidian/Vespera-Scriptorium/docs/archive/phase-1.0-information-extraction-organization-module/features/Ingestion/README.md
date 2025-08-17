# Ingestion

**Last Updated:** 2025-05-20

This section tracks the progress of the Ingestion epic and its subcomponents.

## Subcomponents

*   [File Watcher](./File%20Watcher.md) - **Status:** Implemented
*   [Manual Ingestion Trigger](./Manual%20Ingestion%20Trigger.md) - **Status:** Implemented
*   [Ingestion Processor](./Ingestion%20Processor.md) - **Status:** Implemented
*   [Metadata Extractor](./Metadata%20Extractor.md) - **Status:** Implemented

## Overview

The Ingestion epic is responsible for bringing content into the system for processing. It includes components for automatically watching files for changes, manually triggering ingestion, extracting metadata from files, and coordinating the overall ingestion process.

All components have been fully implemented with robust error handling and support for both Obsidian and standalone environments. The implementation includes:

1. **File Watcher**: Monitors specified directories for file changes and triggers ingestion when files are created or modified.
2. **Manual Ingestion Trigger**: Provides a user-initiated mechanism to start the ingestion process for specific files.
3. **Metadata Extractor**: Extracts relevant metadata from files, including file system properties and content-based metadata.
4. **Ingestion Processor**: Coordinates the ingestion process, including reading files, extracting metadata, and initiating workflows.

## Integration Points

- The ingestion components integrate with the file-based queue system for asynchronous processing.
- They also integrate with the workflow orchestrator to initiate processing workflows.
- The components are designed to work within the Obsidian environment using the Obsidian API, but can also function in a standalone Node.js environment.