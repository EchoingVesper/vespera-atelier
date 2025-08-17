---
trigger: always_on
---

# Vespera-Scriptorium Windsurf Rules

This directory contains the rules and guidelines for the Vespera-Scriptorium Obsidian plugin project. These rules should be followed when working on the project to ensure consistency, maintainability, and high quality.

## Project Overview

Vespera-Scriptorium is an Obsidian plugin that implements an Agent-to-Agent (A2A) communication layer using:

- TypeScript for type safety
- NATS as the message broker
- Event-based architecture for task management and notifications
- Message-passing architecture for agent communication

## Rule Categories

1. [Code Organization](./code-organization.md) - Directory structure, file organization, naming conventions
2. [Documentation Standards](./documentation-standards.md) - JSDoc requirements, markdown formatting, documentation structure
3. [Type Safety](./type-safety.md) - Interface definitions, type guards, error handling
4. [Testing Requirements](./testing-requirements.md) - Unit testing, integration testing, test organization
5. [Performance Considerations](./performance-considerations.md) - Message handling, large data transfers, event listeners
6. [MCP Tools Guide](./mcp-tools-guide.md) - Available MCP tools and best practices for their usage

## Global Rules

In addition to the category-specific rules, the following global rules apply to all work on the project:

1. **Code Quality**:

   - Follow TypeScript best practices
   - Maintain consistent code style
   - Use meaningful variable and function names
   - Keep functions small and focused on a single responsibility

2. **Documentation**:

   - Keep documentation up-to-date with code changes
   - Include examples for complex functionality
   - Document breaking changes prominently

3. **Version Control**:

   - Write clear, descriptive commit messages
   - Reference issue numbers in commits when applicable
   - Keep pull requests focused on a single feature or fix

4. **Security**:
   - Never commit sensitive information (API keys, credentials)
   - Validate all input data
   - Implement proper error handling to avoid information leakage

## Last Updated: 2025-05-25
