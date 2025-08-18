---
trigger: model_decision
description: "Apply when working with browser automation for testing or documenting A2A interfaces"
---

# Puppeteer MCP Server Tools

## Overview

The Puppeteer MCP Server provides browser automation capabilities that are useful for testing web interfaces, capturing screenshots for documentation, and interacting with web-based monitoring tools for the Vespera-Scriptorium A2A messaging system.

## Available Tools

### Browser Navigation and Interaction

- **`puppeteer_navigate`**: Navigate to a URL
  - Use for opening web interfaces and monitoring dashboards
  - Access NATS monitoring pages
  - Example: `puppeteer_navigate({ url: "http://localhost:8080/nats-monitoring" })`

- **`puppeteer_click`**: Click elements on a page
  - Use for interacting with web interfaces
  - Test UI components of the plugin
  - Example: `puppeteer_click({ selector: "#refresh-button" })`

- **`puppeteer_fill`**: Fill form fields
  - Use for entering data in web interfaces
  - Configure settings through web UI
  - Example: `puppeteer_fill({ selector: "#connection-url", value: "nats://localhost:4222" })`

- **`puppeteer_hover`**: Hover over elements
  - Use for testing hover interactions
  - View tooltips and hover states
  - Example: `puppeteer_hover({ selector: ".message-item" })`

### Data Extraction and Visualization

- **`puppeteer_screenshot`**: Capture screenshots
  - Use for documenting web interfaces
  - Create visual examples for documentation
  - Example: `puppeteer_screenshot({ name: "nats-dashboard" })`

- **`puppeteer_evaluate`**: Execute JavaScript in the browser
  - Use for extracting data from web pages
  - Interact with browser APIs
  - Example: `puppeteer_evaluate({ script: "return document.querySelector('.stats').textContent" })`

## Best Practices

1. **Testing Web Interfaces**:
   - Use Puppeteer for testing web-based components of the plugin
   - Create reproducible test scenarios
   - Verify UI behavior with screenshots

2. **Documentation**:
   - Capture screenshots of key interfaces for documentation
   - Document message flow visualizations
   - Create visual examples of configuration options

3. **Monitoring**:
   - Access NATS monitoring dashboards
   - Extract performance metrics
   - Monitor system health during testing

4. **Integration with A2A Architecture**:
   - Test web-based admin interfaces for the messaging system
   - Visualize message flows through monitoring tools
   - Capture metrics for performance analysis

## Integration with A2A Messaging

The Puppeteer MCP tools support the A2A messaging architecture by:

- Providing visual verification of message flows
- Enabling interaction with web-based monitoring tools
- Supporting documentation of the messaging system
- Facilitating testing of web interfaces related to messaging

## Last Updated: 2025-05-25
