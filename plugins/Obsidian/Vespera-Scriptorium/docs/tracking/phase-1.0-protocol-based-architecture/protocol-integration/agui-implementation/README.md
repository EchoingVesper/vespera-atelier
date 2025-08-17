# AG-UI Implementation

**Last Updated:** 2025-05-24

This directory contains the implementation details for the Agent User Interaction (AG-UI) protocol, which standardizes real-time interaction between users and agents in the Vespera Scriptorium architecture.

## Architecture Overview

AG-UI is built on a reactive, event-driven architecture with the following components:

1. **Event Bus**: Central hub for all UI events
2. **Component Registry**: Manages UI components and their capabilities
3. **State Manager**: Handles application state and synchronization
4. **Real-time Communication**: WebSockets for bi-directional updates

## Configuration

### 1. `agui-config.json`

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "cors": {
      "origin": ["http://localhost:8080", "https://app.vespera.io"]
    }
  },
  "features": {
    "realtimeUpdates": true,
    "offlineSupport": true,
    "analytics": true
  },
  "themes": ["light", "dark", "high-contrast"],
  "defaultTheme": "dark"
}
```

### 2. Component Configuration

Example component configuration (`document-viewer.config.json`):

```json
{
  "componentId": "document-viewer",
  "version": "1.0.0",
  "dependencies": ["text-editor", "annotation-tool"],
  "capabilities": [
    "render-markdown",
    "render-pdf",
    "annotate",
    "highlight"
  ],
  "events": [
    "document-loaded",
    "selection-changed",
    "annotation-added"
  ],
  "actions": [
    "load-document",
    "save-annotations",
    "export-document"
  ]
}
```

## Implementation

### Core Classes

1. **AGUIServer**
   - Manages WebSocket connections
   - Handles message routing
   - Manages component lifecycle

2. **ComponentManager**
   - Registers and manages UI components
   - Handles component communication
   - Manages component lifecycle

3. **StateManager**
   - Manages application state
   - Handles state synchronization
   - Implements undo/redo functionality

### Example Implementation

```typescript
// Initialize AG-UI server
const aguiServer = new AGUIServer({
  port: config.server.port,
  host: config.server.host,
  cors: config.server.cors
});

// Register a component
aguiServer.registerComponent({
  id: 'document-viewer',
  version: '1.0.0',
  handlers: {
    'load-document': async (params) => {
      // Load document logic
      return { status: 'loaded', metadata: { /* ... */ } };
    },
    'save-annotations': async (annotations) => {
      // Save annotations logic
      return { success: true };
    }
  },
  events: ['document-loaded', 'selection-changed']
});

// Start the server
aguiServer.start();
```

## Event System

### Event Types

1. **State Events**: Reflect changes in application state
2. **UI Events**: User interactions with the interface
3. **System Events**: Internal system notifications
4. **Agent Events**: Communication with backend agents

### Event Format

```typescript
interface AGUIEvent {
  eventId: string;
  timestamp: string;
  type: string;
  source: string;
  payload?: any;
  correlationId?: string;
}
```

## Real-time Updates

1. **WebSocket Connection**: Persistent connection for real-time updates
2. **Delta Updates**: Only send changed data
3. **Optimistic UI**: Immediate UI updates with rollback on failure
4. **Offline Support**: Queue updates when offline, sync when reconnected

## Security

1. **Authentication**: JWT-based authentication
2. **Authorization**: Role-based access control
3. **Data Validation**: Input validation for all events and messages
4. **Rate Limiting**: Prevent abuse of the API

## Performance Considerations

1. **Throttling**: Limit the rate of UI updates
2. **Debouncing**: Batch rapid updates
3. **Virtualization**: Only render visible components
4. **Lazy Loading**: Load components on demand

## Testing

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test component interactions
3. **E2E Tests**: Test complete user flows
4. **Performance Tests**: Ensure smooth user experience

## Best Practices

1. **Separation of Concerns**: Keep UI logic separate from business logic
2. **Component Reusability**: Design components to be reusable
3. **Progressive Enhancement**: Ensure basic functionality without JavaScript
4. **Accessibility**: Follow WCAG guidelines
5. **Error Handling**: Provide meaningful error messages
6. **Loading States**: Show appropriate loading indicators
7. **Feedback**: Provide feedback for user actions
8. **Consistency**: Maintain consistent UI patterns
9. **Documentation**: Document component APIs and usage
10. **Performance Monitoring**: Track and optimize performance metrics
