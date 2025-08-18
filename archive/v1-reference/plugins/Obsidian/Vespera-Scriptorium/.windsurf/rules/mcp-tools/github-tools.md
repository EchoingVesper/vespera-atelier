---
trigger: model_decision
description: "Apply when working with GitHub repositories or researching code examples"
---

# GitHub MCP Server Tools

## Overview

The GitHub MCP Server provides integration with GitHub repositories, which is valuable for accessing code examples, managing issues, and researching messaging patterns for the Vespera-Scriptorium A2A communication layer.

## Available Tools

### Repository Content Access

- **`get_file_contents`**: Access files in GitHub repositories
  - Use for examining messaging implementations in other projects
  - Access TypeScript interfaces and types for messaging systems
  - Example: `get_file_contents({ owner: "nats-io", repo: "nats.js", path: "src/types.ts" })`

- **`get_commit`**: View specific commit details
  - Use for understanding changes to messaging implementations
  - Examine the evolution of messaging patterns
  - Example: `get_commit({ owner: "nats-io", repo: "nats.js", sha: "main" })`

### Code Search and Research

- **`search_code`**: Find code examples across GitHub
  - Essential for researching messaging patterns and implementations
  - Find TypeScript interfaces for message types
  - Example: `search_code({ q: "language:typescript nats message interface" })`

- **`list_commits`**: View commit history
  - Track the evolution of messaging implementations
  - Understand architectural decisions in similar projects
  - Example: `list_commits({ owner: "nats-io", repo: "nats.js", sha: "main" })`

### Issue Management

- **`create_issue`**: Create issues for discovered bugs or features
  - Document messaging-related bugs or enhancement requests
  - Track implementation tasks for the A2A architecture
  - Example: `create_issue({ owner: "EchoingVesper", repo: "Vespera-Scriptorium", title: "Add support for message acknowledgments", body: "..." })`

- **`get_issue`**: View issue details
  - Research known issues in messaging implementations
  - Understand the context of existing bugs or features
  - Example: `get_issue({ owner: "EchoingVesper", repo: "Vespera-Scriptorium", issue_number: 42 })`

- **`list_issues`**: Browse repository issues
  - Review all messaging-related issues
  - Identify patterns in reported problems
  - Example: `list_issues({ owner: "EchoingVesper", repo: "Vespera-Scriptorium", state: "open" })`

### Repository Management

- **`create_branch`**: Create new branches for features
  - Set up feature branches for messaging enhancements
  - Isolate experimental messaging implementations
  - Example: `create_branch({ owner: "EchoingVesper", repo: "Vespera-Scriptorium", branch: "feature/jetstream-integration" })`

- **`list_branches`**: List repository branches
  - View all branches related to messaging features
  - Find specific implementation branches
  - Example: `list_branches({ owner: "EchoingVesper", repo: "Vespera-Scriptorium" })`

## Best Practices

1. **Code Research**:
   - Search for TypeScript messaging interfaces and patterns
   - Examine NATS client implementations for best practices
   - Look for error handling patterns in messaging systems

2. **Issue Management**:
   - Create detailed issues with clear reproduction steps
   - Link related issues to establish context
   - Use labels to categorize messaging-related issues

3. **Repository Organization**:
   - Create feature branches for each messaging component
   - Use descriptive branch names that reflect the purpose
   - Keep branches focused on specific messaging features

4. **Security Considerations**:
   - Never commit sensitive information (API keys, credentials)
   - Use environment variables for secrets
   - Review code for potential security issues before committing

## Integration with A2A Architecture

The GitHub MCP tools support the A2A messaging architecture by:

- Providing access to reference implementations and patterns
- Enabling research on best practices for message-based systems
- Supporting the development workflow with issue tracking
- Facilitating code organization through branch management

## Last Updated: 2025-05-25
