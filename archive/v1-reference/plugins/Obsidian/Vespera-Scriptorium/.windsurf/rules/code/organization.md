---
trigger: glob
globs: *.{ts,js}
---

# Code Organization Rules

## Directory Structure

- **Messaging Components**: Place in `src/core/messaging/`
- **Component-Specific Types**: Define in `types.ts` or component file
- **Documentation**: Store in `docs/developers/messaging/`

## File Size Limits

- Keep files under ~500 lines
- Refactor into modules when approaching limit
- Extract reusable utilities to appropriate directories

## Component Patterns

- Use consistent naming:
  - PascalCase for classes, interfaces, types
  - camelCase for variables, functions, methods
  - Descriptive names reflecting component purpose

- Implement standard patterns:
  - Event-based notifications with EventEmitter
  - Clear separation of concerns
  - Consistent error handling
  - Type-safe interfaces

## Import Organization

- Node.js built-ins first
- External dependencies next
- Internal project imports last
- Group related imports together

## Last Updated: 2025-05-25
