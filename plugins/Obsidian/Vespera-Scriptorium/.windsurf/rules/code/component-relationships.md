---
trigger: always_on
---

# A2A Messaging Component Relationships

## Core Components Map

```ascii
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  NatsClient     │◄────┤ ServiceManager  │◄────┤  TaskManager    │
│                 │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       │                       │
         │                       │                       │
         │               ┌──────────────────┐           │
         └──────────────►│                  │◄──────────┘
                         │  StorageManager  │
                         │                  │
                         └─────────┬────────┘
                                   │
                                   │
                         ┌─────────▼────────┐
                         │                  │
                         │  DataExchange    │
                         │                  │
                         └──────────────────┘
```

## Component Dependencies

1. **NatsClient**
   - Core dependency for all other components
   - Provides message transport layer
   - No dependencies on other components

2. **ServiceManager**
   - Depends on: NatsClient
   - Provides: Service discovery, health monitoring
   - Used by: TaskManager, StorageManager, DataExchange

3. **TaskManager**
   - Depends on: NatsClient, ServiceManager
   - Provides: Task creation, delegation, tracking
   - Used by: Application code

4. **StorageManager**
   - Depends on: NatsClient, ServiceManager
   - Provides: Distributed key-value operations
   - Used by: TaskManager, DataExchange

5. **DataExchange**
   - Depends on: NatsClient, ServiceManager, StorageManager
   - Provides: Data sharing, streaming
   - Used by: Application code

## Message Flow Patterns

1. **Service Discovery Flow**

   ```ascii
   Agent A → system.register → NATS → ServiceManager (Agent B)
   ServiceManager (Agent B) → system.register.reply → NATS → Agent A
   ```

2. **Task Delegation Flow**

   ```ascii
   Agent A → task.create → NATS → TaskManager (Agent B)
   TaskManager (Agent B) → task.update → NATS → Agent A
   TaskManager (Agent B) → task.complete/task.fail → NATS → Agent A
   ```

3. **Storage Operation Flow**

   ```ascii
   Agent A → storage.set → NATS → StorageManager (Agent B)
   StorageManager (Agent B) → storage.set.reply → NATS → Agent A
   ```

4. **Data Exchange Flow**

   ```ascii
   Agent A → data.request → NATS → DataExchange (Agent B)
   DataExchange (Agent B) → data.response → NATS → Agent A
   ```

## Initialization Order

For proper A2A messaging setup, initialize components in this order:

1. NatsClient.connect()
2. ServiceManager.initialize()
3. TaskManager.initialize()
4. StorageManager.initialize()
5. DataExchange.initialize()

## Last Updated: 2025-05-25
