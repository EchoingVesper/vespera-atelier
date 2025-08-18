# MCP Server Tools Rules

This document outlines the workspace rules for the successful completion of the Vespera Scriptorium plugin's Phase 1.0: Information Extraction & Organization Module. It details the appropriate usage of available MCP (Model Context Protocol) server tools to achieve the phase objectives.

## Description

The MCP server tools provide specialized capabilities that extend the functionality of the Vespera Scriptorium plugin. Each tool serves a specific purpose within the Information Extraction & Organization Module, enabling tasks such as version control, browser automation, complex problem-solving, web searching, documentation access, file system operations, and Windows-specific command execution.

## Functionality

- Facilitate interaction with external services and APIs
- Enable automation of complex tasks
- Provide access to specialized capabilities not available in the core plugin
- Support development, testing, and runtime operations
- Enhance the plugin's ability to process and organize information

## MCP Server Tools

### GitHub (`npx -y @modelcontextprotocol/server-github`)

#### Description
The GitHub MCP server provides a comprehensive suite of tools for interacting with GitHub repositories. This includes capabilities such as creating, reading, updating, and deleting files; searching repositories, code, issues, and users; managing branches, commits, issues, and pull requests; and forking repositories.

#### Application Scenarios

- **Extraction (including LLM Calls) & Classification:**
  - **Scenario:** Storing, versioning, and managing `Extraction Rules Templates` (see [`docs/tracking/phase-1.0-information-extraction-organization-module/features/Extraction (including LLM Calls)/Extraction Rules Templates.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Extraction (including LLM Calls)/Extraction Rules Templates.md:1)) and `Classification Rules Models` (see [`docs/tracking/phase-1.0-information-extraction-organization-module/features/Classification/Classification Rules Models.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Classification/Classification Rules Models.md:1)).
  - **Tooling:** Use `create_or_update_file` to save new or modified rule sets. Use `get_file_contents` to load rules at runtime if they are centrally managed in a repository.
- **Workflow Orchestrator, Processing Stages, Ingestion, Output, File-Based Queues (Code Management):**
  - **Scenario:** Managing the source code for all modules and components developed during Phase 1.0. This includes the core logic for the `Workflow Orchestrator` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Workflow Orchestrator/README.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Workflow Orchestrator/README.md:1)), `Processing Stages` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Processing Stages/README.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Processing Stages/README.md:1)), `Ingestion` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Ingestion/README.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Ingestion/README.md:1)) mechanisms, `Output` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Output/README.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Output/README.md:1)) formatting, and `File-Based Queues` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/File-Based Queues/README.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/File-Based Queues/README.md:1)).
  - **Tooling:** Utilize `create_branch` for feature development, `push_files` for committing multiple changes, `create_pull_request` for code reviews, and `merge_pull_request` for integrating features.
- **Ingestion (Potentially):**
  - **Scenario:** If user notes are stored in Markdown files within a GitHub repository, this tool could be used to fetch them.
  - **Tooling:** `get_file_contents` to retrieve note content.

#### Guidelines

- Maintain a clear branching strategy (e.g., GitFlow or feature branches).
- Write descriptive commit messages following conventional commit guidelines.
- Use pull requests for all code changes to facilitate review.
- Regularly push changes to the remote repository to avoid data loss and enable collaboration.
- Securely manage the `GITHUB_PERSONAL_ACCESS_TOKEN`.

#### Epic Support

- **Direct Support:** Extraction (Rules Templates), Classification (Rules Models).
- **Indirect Support:** All epics through version control and code management: Ingestion, Output, Processing Stages, Workflow Orchestrator, File-Based Queues.

### Puppeteer (`npx -y @modelcontextprotocol/server-puppeteer`)

#### Description
The Puppeteer MCP server enables browser automation. It provides tools to launch a browser, navigate to URLs, interact with web page elements (click, type, select, hover), execute JavaScript, and capture screenshots.

#### Application Scenarios

- **Ingestion:**
  - **Scenario:** Extracting notes or information from web-based sources if users store their notes in platforms like Evernote web, Notion, web articles, or other online services that don't offer a direct API for content extraction. The `Ingestion Processor` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Ingestion/Ingestion Processor.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Ingestion/Ingestion Processor.md:1)) might invoke Puppeteer for such sources.
  - **Tooling:** Use `puppeteer_navigate` to open the note URL, `puppeteer_evaluate` to execute JavaScript for extracting content from specific HTML elements, and potentially `puppeteer_screenshot` for debugging or visual confirmation.
- **Extraction (including LLM Calls):**
  - **Scenario:** If the information to be extracted is dynamically rendered or requires JavaScript execution to become visible (e.g., content behind "read more" buttons, or in single-page applications), Puppeteer can render the page fully before text is passed to the `Extraction Processor` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Extraction (including LLM Calls)/Extraction Processor.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Extraction (including LLM Calls)/Extraction Processor.md:1)).
  - **Tooling:** `puppeteer_navigate` to the source, `puppeteer_click` if interactions are needed, then `puppeteer_evaluate` to get the fully rendered content.

#### Guidelines

- Use robust CSS selectors or XPath expressions to identify web elements, minimizing reliance on volatile attributes.
- Implement appropriate waits (e.g., for navigation, element visibility, or network idle) to handle dynamically loading content.
- Include error handling for navigation failures, element not found, or timeouts.
- Close the browser instance (`puppeteer_close` - though this is handled by the `browser_action` tool's `close` action) when done to free up resources.
- Be mindful of website terms of service regarding automated access.

#### Epic Support

- **Direct Support:** Ingestion, Extraction.

### Sequential-Thinking (`npx -y @modelcontextprotocol/server-sequential-thinking`)

#### Description
The Sequential-Thinking MCP server provides a tool (`sequentialthinking`) for dynamic and reflective problem-solving. It facilitates breaking down complex problems, planning, and analysis through an iterative thought process that can adapt and evolve.

#### Application Scenarios

- **Workflow Orchestrator:**
  - **Scenario:** Designing and refining the logic of complex information processing workflows. Planning the sequence of operations for the `Workflow Execution Engine` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Workflow Orchestrator/Workflow Execution Engine.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Workflow Orchestrator/Workflow Execution Engine.md:1)), especially when dealing with conditional paths or dynamic step generation.
- **Extraction (including LLM Calls):**
  - **Scenario:** Developing sophisticated strategies for information extraction, such as determining optimal `Content Chunking` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Extraction (including LLM Calls)/Content Chunking.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Extraction (including LLM Calls)/Content Chunking.md:1)) methods, formulating effective prompts for the `Prompt Builder` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Extraction (including LLM Calls)/Prompt Builder.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Extraction (including LLM Calls)/Prompt Builder.md:1)), or deciding how to handle ambiguous LLM responses.
- **Classification:**
  - **Scenario:** Devising and iterating on the rules and logic for the `Classifier Engine` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Classification/Classifier Engine.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Classification/Classifier Engine.md:1)), especially for nuanced classification tasks.
- **Processing Stages:**
  - **Scenario:** Defining the intricate logic, connections, and data transformations between different types of `Processing Node` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Processing Stages/Processing Node.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Processing Stages/Processing Node.md:1)), such as `Decision Node` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Processing Stages/Decision Node.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Processing Stages/Decision Node.md:1)) or `Merge Node` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Processing Stages/Merge Node.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Processing Stages/Merge Node.md:1)).

#### Guidelines

- Use for tasks requiring complex reasoning, planning, or iterative refinement within the plugin's internal decision-making processes.
- Clearly articulate each thought step, its purpose, and its relation to previous thoughts.
- Leverage the tool's ability to revise and branch thoughts to explore different solution paths.
- Document the final thought process or derived plan for future reference and maintainability.

#### Epic Support

- **Direct Support:** Workflow Orchestrator, Extraction, Classification, Processing Stages.

### Brave-Search (`npx -y @modelcontextprotocol/server-brave-search`)

#### Description
The Brave-Search MCP server offers web and local search capabilities through the Brave Search API. It provides tools like `brave_web_search` for general queries and `brave_local_search` for location-based searches.

#### Application Scenarios

- **Extraction (including LLM Calls):**
  - **Scenario:** Augmenting information extracted from user notes with external context. For instance, if a note mentions a specific term, person, or organization, `brave_web_search` can be used to fetch definitions, recent news, or related information. This enriched context can then be used by the `LLM Client Interface` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Extraction (including LLM Calls)/LLM Client Interface.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Extraction (including LLM Calls)/LLM Client Interface.md:1)) for more accurate extraction or summarization.
- **Classification:**
  - **Scenario:** Assisting the `Classifier Engine` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Classification/Classifier Engine.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Classification/Classifier Engine.md:1)) by providing external data needed for classification. For example, classifying a note about a company might involve fetching recent news about that company to determine sentiment or relevance to a specific project.

#### Guidelines

- Formulate search queries to be as specific as possible to retrieve relevant results.
- Implement logic to handle cases where search results are irrelevant or no results are found.
- Cache search results where appropriate to avoid redundant API calls and manage costs, especially for non-time-sensitive information.
- Be mindful of the `BRAVE_API_KEY` usage and potential rate limits.
- Filter and process search results to extract only the necessary information.

#### Epic Support

- **Direct Support:** Extraction, Classification.

### Context7 (`npx -y @upstash/context7-mcp@latest`)

#### Description
The Context7 MCP server provides tools to resolve package/product names to Context7-compatible library IDs (`resolve-library-id`) and fetch up-to-date documentation for these libraries (`get-library-docs`).

#### Application Scenarios

- **General Development Support (All Epics):**
  - **Scenario:** While not directly involved in the runtime information extraction process of Phase 1.0, this tool is highly valuable during the development of all epics. If developers need to integrate or understand a new third-party library (e.g., for advanced file operations in `File-Based Queues` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/File-Based Queues/README.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/File-Based Queues/README.md:1)), or a specific parsing library for `Ingestion` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Ingestion/README.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Ingestion/README.md:1))), `context7` can quickly provide relevant documentation and code snippets.
  - **Tooling:** Use `resolve-library-id` to find the correct ID for a library, then `get-library-docs` to fetch its documentation.

#### Guidelines

- Utilize during the design and implementation phases to accelerate development and ensure correct usage of external libraries.
- Focus queries in `get-library-docs` on specific topics or modules within a library to get targeted information.

#### Epic Support

- **Indirect Support:** All epics by facilitating more efficient and informed development: Ingestion, Output, Processing Stages, Workflow Orchestrator, Extraction, Classification, File-Based Queues.

### Desktop-Commander (`npx -y @wonderwhy-er/desktop-commander`)

#### Description
The Desktop-Commander MCP server offers a comprehensive set of tools for interacting with the local desktop environment. This includes file system operations (reading, writing, creating directories, listing, moving, searching files by name or content), executing shell commands, and managing system processes.

#### Application Scenarios

- **Ingestion:**
  - **Scenario:** Reading user notes from local files. The `File Watcher` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Ingestion/File Watcher.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Ingestion/File Watcher.md:1)) component can use `list_directory` or `search_files` to discover note files, and `read_file` (or `read_multiple_files`) to load their content for the `Ingestion Processor` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Ingestion/Ingestion Processor.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Ingestion/Ingestion Processor.md:1)). The `Metadata Extractor` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Ingestion/Metadata Extractor.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Ingestion/Metadata Extractor.md:1)) might use `get_file_info`.
  - **Tooling:** `read_file`, `list_directory`, `search_files`, `get_file_info`.
- **Output:**
  - **Scenario:** Writing the structured and organized information back to local files. The `Output Writer` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Output/Output Writer.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Output/Output Writer.md:1)) will use `write_file` to save processed data, potentially creating new directories with `create_directory`.
  - **Tooling:** `write_file`, `create_directory`.
- **File-Based Queues:**
  - **Scenario:** Implementing the persistence layer for `File-Based Queues` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/File-Based Queues/README.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/File-Based Queues/README.md:1)). This involves creating, reading, writing, and managing files that represent queue items or the queue itself. The `Queue Persistence` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/File-Based Queues/Queue Persistence.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/File-Based Queues/Queue Persistence.md:1)), `Queue Writer` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/File-Based Queues/Queue Writer.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/File-Based Queues/Queue Writer.md:1)), and `Queue Reader` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/File-Based Queues/Queue Reader.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/File-Based Queues/Queue Reader.md:1)) components will heavily utilize these tools.
  - **Tooling:** `write_file` (to add items), `read_file` (to consume items), `move_file` (e.g., to move processed items to an archive or error queue), `create_directory` (for queue storage). `search_code` could be used if queue items are text-based and need specific content searching.
- **Workflow Orchestrator:**
  - **Scenario:** The `Workflow Orchestrator` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Workflow Orchestrator/README.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Workflow Orchestrator/README.md:1)) might need to execute external scripts or command-line tools as part of a defined workflow step, especially for specialized processing tasks not built into the plugin.
  - **Tooling:** `execute_command`.

#### Guidelines

- Prefer specialized file operation tools (e.g., `read_file`, `write_file`) over `execute_command` with shell equivalents (e.g., `cat`, `echo >`) for better control and error handling.
- Always use absolute paths for file operations to ensure reliability, unless a relative path is explicitly needed and its base directory is well-defined.
- Implement robust error handling for all file system operations (e.g., file not found, permission denied, disk full).
- Ensure operations are confined to user-specified or appropriately sandboxed directories to maintain security and data integrity.
- Use `search_code` for content-based searching within files and `search_files` for name-based searching.

#### Epic Support

- **Direct Support:** Ingestion, Output, File-Based Queues, Workflow Orchestrator.

### Windows-CLI (`npx -y @simonb97/server-win-cli`)

#### Description
The Windows-CLI MCP server is designed for executing commands on Windows systems using PowerShell, CMD, or Git Bash. It also includes functionalities for managing SSH connections (`ssh_execute`, `ssh_disconnect`, etc.), though these are less central to Phase 1.0's local processing goals.

#### Application Scenarios

- **File-Based Queues:**
  - **Scenario:** If the `File-Based Queues` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/File-Based Queues/README.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/File-Based Queues/README.md:1)) implementation requires Windows-specific file or directory manipulations not easily achievable with `desktop-commander` (e.g., advanced ACL management, specific batch file executions for queue maintenance).
  - **Tooling:** `execute_command` with `powershell` or `cmd`.
- **Ingestion / Output:**
  - **Scenario:** If user notes are generated by or need to be consumed by Windows-specific applications that can be controlled via their command-line interfaces, or if output needs to trigger specific Windows scripts.
  - **Tooling:** `execute_command`.
- **Workflow Orchestrator:**
  - **Scenario:** Similar to `desktop-commander`, the `Workflow Orchestrator` ([`docs/tracking/phase-1.0-information-extraction-organization-module/features/Workflow Orchestrator/README.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Workflow Orchestrator/README.md:1)) might use this tool to execute Windows-specific scripts or commands as part of a processing pipeline.
  - **Tooling:** `execute_command`.

#### Guidelines

- This tool should be used when Windows-specific command-line operations are essential and cannot be performed by the more general `desktop-commander` or internal plugin logic.
- Clearly specify the `shell` (`powershell`, `cmd`, `gitbash`) for `execute_command`.
- Ensure commands are thoroughly tested and their impact is understood, especially those modifying the file system or system state.
- Validate and sanitize any user-provided input that might be used in constructing commands to prevent command injection vulnerabilities.
- Prefer `desktop-commander` for cross-platform compatible file operations where possible.

#### Epic Support

- **Potential Support:** File-Based Queues, Ingestion, Output, Workflow Orchestrator (primarily through `execute_command` for Windows-specific tasks).

## When to Use

- Use GitHub tools when managing version-controlled assets, collaborating on code, or storing centralized rule templates.
- Use Puppeteer when extracting information from web-based sources or working with dynamically rendered content.
- Use Sequential-Thinking when tackling complex planning, design, or decision-making tasks that benefit from iterative refinement.
- Use Brave-Search when augmenting extracted information with external context or gathering data for classification.
- Use Context7 during development to quickly access documentation for third-party libraries.
- Use Desktop-Commander for file system operations, process management, and general command execution.
- Use Windows-CLI only when Windows-specific command-line operations are required that cannot be handled by Desktop-Commander.

## File Interaction

- **Documentation Files:** `.md` files for storing rules, templates, and documentation
- **Configuration Files:** `.json` and `.yaml` files for workflow definitions and settings
- **Source Code:** Various file types (`.ts`, `.js`, etc.) for implementing the plugin's functionality
- **Queue Files:** Text-based files for storing queue items and state information

## Guidelines

- Always select the most appropriate MCP server tool for the task at hand, considering the specific requirements and constraints.
- Follow the best practices outlined for each tool to ensure efficient, secure, and reliable operation.
- Document the use of MCP server tools in code comments and project documentation to facilitate maintenance and knowledge sharing.
- Consider the impact on system resources and external API usage when utilizing these tools, especially in production environments.
- Implement proper error handling and fallback mechanisms when working with external services or APIs.
