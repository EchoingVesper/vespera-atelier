---
trigger: glob
globs: *.md
---

# Documentation Structure Rules

## Directory Organization

1. Store all A2A messaging documentation in `docs/developers/messaging/`
2. Organize component-specific documentation in subdirectories:
   - `nats-client/` - NATS connection management
   - `service-manager/` - Service discovery and health monitoring
   - `task-manager/` - Task creation, delegation, and tracking
   - `storage-manager/` - Distributed key-value storage
   - `message-types/` - Message structure and validation

## System-Level Documentation

1. Maintain high-level architecture documentation:
   - `A2A-MESSAGING.md` - Overview of the messaging system
   - `INTEGRATION-GUIDE.md` - Guide for integrating with the system
   - `SERVICE_DISCOVERY.md` - Details on service discovery mechanisms

2. Include diagrams for complex workflows:
   - Message flow sequences
   - Component interaction diagrams
   - State transition diagrams for tasks

## File Structure

1. Each documentation file should follow this structure:
   - Title and brief description
   - Table of contents for longer documents
   - Conceptual overview
   - API reference (when applicable)
   - Usage examples
   - Troubleshooting section

2. Include a "Last Updated" date at the end of each file

## Cross-Referencing

1. Use relative links to reference related documentation
2. Link to source code when appropriate
3. Maintain a consistent navigation structure
4. Ensure all links are valid and up-to-date

## Last Updated: 2025-05-25
