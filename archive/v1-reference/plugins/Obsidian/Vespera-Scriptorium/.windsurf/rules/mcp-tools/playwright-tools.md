---
trigger: model_decision
description: "Apply when working with advanced browser automation and testing for web interfaces"
---

# Playwright Tools

## Overview

The Playwright MCP Server provides advanced browser automation and testing capabilities for web interfaces in the Vespera-Scriptorium project.

## Key Tools

### Browser Navigation

- **`playwright_navigate`**: Open URLs in the browser
  - Use for accessing web interfaces and dashboards
  - Example: `playwright_navigate({ url: "http://localhost:8080" })`

- **`playwright_go_back`**: Navigate back in browser history
  - Example: `playwright_go_back()`

- **`playwright_go_forward`**: Navigate forward in browser history
  - Example: `playwright_go_forward()`

### Page Interaction

- **`playwright_click`**: Click elements on a page
  - Example: `playwright_click({ selector: "#submit-button" })`

- **`playwright_fill`**: Fill form fields
  - Example: `playwright_fill({ selector: "#username", value: "test" })`

- **`playwright_press_key`**: Press keyboard keys
  - Example: `playwright_press_key({ key: "Enter" })`

### Data Extraction

- **`playwright_screenshot`**: Capture screenshots
  - Example: `playwright_screenshot({ name: "dashboard" })`

- **`playwright_get_visible_text`**: Get text content
  - Example: `playwright_get_visible_text()`

## Best Practices

1. **Test Automation**: Use for end-to-end testing of web interfaces
2. **Documentation**: Capture screenshots for visual documentation

## Last Updated: 2025-05-25
