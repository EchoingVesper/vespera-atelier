# Event System Specification

## Overview

The Vespera Codex Event System provides real-time, scalable event processing that powers the Dynamic Automation and Tag-Driven Systems. Built on top of the existing triple-database architecture (SQLite + Chroma + KuzuDB), it enables reactive content workflows and intelligent automation chains.

## 🏛️ Architecture

### Core Components

```
Event System Architecture
├── Event Producers
│   ├── Content Change Detector
│   ├── Tag Modification Monitor  
│   ├── Task Lifecycle Tracker
│   ├── User Interaction Capturer
│   └── External System Integrator
├── Event Processing Pipeline
│   ├── Event Router
│   ├── Filter Chain
│   ├── Transformation Layer
│   ├── Validation Engine
│   └── Rate Limiter
├── Event Storage & Persistence
│   ├── Event Stream (SQLite)
│   ├── Event Index (Chroma)
│   └── Event Graph (KuzuDB)
└── Event Consumers  
    ├── Automation Rule Engine
    ├── UI Notification System
    ├── Real-time Sync Manager
    └── External Webhook Handler
```

### Event Flow Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Event Source   │───▶│  Event Router   │───▶│ Filter Pipeline │
│                 │    │                 │    │                 │
│ • Tag Changes   │    │ • Type-based    │    │ • Relevance     │
│ • Content Edits │    │   routing       │    │ • Permissions   │
│ • Task Updates  │    │ • Priority      │    │ • Rate Limiting │
│ • User Actions  │    │   queueing      │    │ • Deduplication │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐             ▼
                       │ Event Consumer  │◀───┌─────────────────┐
                       │                 │    │   Event Store   │
                       │ • Automation    │    │                 │
                       │ • UI Updates    │    │ • SQLite Stream │
                       │ • Sync Manager  │    │ • Chroma Index  │
                       │ • Webhooks      │    │ • KuzuDB Graph  │
                       └─────────────────┘    └─────────────────┘
```

## 📊 Event Model

### Base Event Structure

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Any, Optional, Union
from enum import Enum
import uuid

@dataclass
class VesperaEvent:
    """Base event structure for all system events."""
    
    # Core identification
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: EventType = None
    source: EventSource = None
    
    # Temporal tracking
    timestamp: datetime = field(default_factory=datetime.utcnow)
    sequence_number: int = 0  # For ordering within same millisecond
    
    # Content references
    codex_ids: List[str] = field(default_factory=list)
    task_ids: List[str] = field(default_factory=list)  
    user_id: Optional[str] = None
    
    # Event payload
    payload: Dict[str, Any] = field(default_factory=dict)
    
    # Metadata and context
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Processing state
    processing_state: EventProcessingState = EventProcessingState.PENDING
    retry_count: int = 0
    max_retries: int = 3
    
    # Tracing and debugging
    trace_id: Optional[str] = None  # For correlation across event chains
    parent_event_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize event to dictionary."""
        return {
            "id": self.id,
            "type": self.type.value if self.type else None,
            "source": self.source.value if self.source else None,
            "timestamp": self.timestamp.isoformat(),
            "sequence_number": self.sequence_number,
            "codex_ids": self.codex_ids,
            "task_ids": self.task_ids,
            "user_id": self.user_id,
            "payload": self.payload,
            "tags": self.tags,
            "metadata": self.metadata,
            "processing_state": self.processing_state.value,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
            "trace_id": self.trace_id,
            "parent_event_id": self.parent_event_id
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'VesperaEvent':
        """Deserialize event from dictionary."""
        return cls(
            id=data["id"],
            type=EventType(data["type"]) if data["type"] else None,
            source=EventSource(data["source"]) if data["source"] else None,
            timestamp=datetime.fromisoformat(data["timestamp"]),
            sequence_number=data.get("sequence_number", 0),
            codex_ids=data.get("codex_ids", []),
            task_ids=data.get("task_ids", []),
            user_id=data.get("user_id"),
            payload=data.get("payload", {}),
            tags=data.get("tags", []),
            metadata=data.get("metadata", {}),
            processing_state=EventProcessingState(data.get("processing_state", "pending")),
            retry_count=data.get("retry_count", 0),
            max_retries=data.get("max_retries", 3),
            trace_id=data.get("trace_id"),
            parent_event_id=data.get("parent_event_id")
        )
```

### Event Type Taxonomy

```python
class EventType(Enum):
    """Comprehensive event type taxonomy."""
    
    # Content Events
    CONTENT_CREATED = "content_created"
    CONTENT_UPDATED = "content_updated"
    CONTENT_DELETED = "content_deleted"
    CONTENT_MOVED = "content_moved"
    CONTENT_LINKED = "content_linked"
    CONTENT_UNLINKED = "content_unlinked"
    
    # Tag Events  
    TAG_ADDED = "tag_added"
    TAG_REMOVED = "tag_removed"
    TAG_MODIFIED = "tag_modified"
    TAG_BATCH_CHANGED = "tag_batch_changed"
    
    # Task Events
    TASK_CREATED = "task_created"
    TASK_UPDATED = "task_updated"
    TASK_STATUS_CHANGED = "task_status_changed"
    TASK_ASSIGNED = "task_assigned"
    TASK_COMPLETED = "task_completed"
    TASK_DELETED = "task_deleted"
    
    # Relationship Events
    RELATIONSHIP_CREATED = "relationship_created"
    RELATIONSHIP_UPDATED = "relationship_updated"
    RELATIONSHIP_DELETED = "relationship_deleted"
    DEPENDENCY_ADDED = "dependency_added"
    DEPENDENCY_REMOVED = "dependency_removed"
    
    # User Events
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    USER_INTERACTION = "user_interaction"
    USER_PREFERENCE_CHANGED = "user_preference_changed"
    
    # Automation Events
    AUTOMATION_TRIGGERED = "automation_triggered"
    AUTOMATION_COMPLETED = "automation_completed"
    AUTOMATION_FAILED = "automation_failed"
    RULE_EXECUTED = "rule_executed"
    
    # System Events
    SYSTEM_STARTUP = "system_startup"
    SYSTEM_SHUTDOWN = "system_shutdown"
    SYNC_STARTED = "sync_started"
    SYNC_COMPLETED = "sync_completed"
    BACKUP_CREATED = "backup_created"
    
    # Media Events
    MEDIA_UPLOADED = "media_uploaded"
    MEDIA_PROCESSED = "media_processed"
    MEDIA_ANALYZED = "media_analyzed"
    
    # Notification Events
    NOTIFICATION_SENT = "notification_sent"
    NOTIFICATION_READ = "notification_read"
    ALERT_RAISED = "alert_raised"

class EventSource(Enum):
    """Event source identification."""
    USER_INTERFACE = "user_interface"
    AUTOMATION_ENGINE = "automation_engine"
    TASK_ORCHESTRATOR = "task_orchestrator"
    CONTENT_MANAGER = "content_manager"
    SYNC_COORDINATOR = "sync_coordinator"
    EXTERNAL_INTEGRATION = "external_integration"
    SYSTEM_MONITOR = "system_monitor"
    BACKGROUND_SERVICE = "background_service"

class EventProcessingState(Enum):
    """Event processing state tracking."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"
    CANCELLED = "cancelled"
```

### Specialized Event Types

```python
@dataclass
class TagChangedEvent(VesperaEvent):
    """Specialized event for tag changes."""
    
    def __init__(self, codex_id: str, added_tags: List[str], 
                 removed_tags: List[str], user_id: str, **kwargs):
        super().__init__(
            type=EventType.TAG_BATCH_CHANGED,
            source=EventSource.USER_INTERFACE,
            codex_ids=[codex_id],
            user_id=user_id,
            **kwargs
        )
        
        self.payload.update({
            "added_tags": added_tags,
            "removed_tags": removed_tags,
            "codex_id": codex_id
        })

@dataclass  
class ContentUpdatedEvent(VesperaEvent):
    """Specialized event for content updates."""
    
    def __init__(self, codex_id: str, content_type: str, 
                 changes: Dict[str, Any], user_id: str, **kwargs):
        super().__init__(
            type=EventType.CONTENT_UPDATED,
            source=EventSource.CONTENT_MANAGER,
            codex_ids=[codex_id],
            user_id=user_id,
            **kwargs
        )
        
        self.payload.update({
            "codex_id": codex_id,
            "content_type": content_type,
            "changes": changes,
            "change_summary": self._summarize_changes(changes)
        })
    
    def _summarize_changes(self, changes: Dict[str, Any]) -> str:
        """Create human-readable change summary."""
        change_count = len(changes)
        if change_count == 1:
            field_name = list(changes.keys())[0]
            return f"Updated {field_name}"
        else:
            return f"Updated {change_count} fields: {', '.join(changes.keys())}"

@dataclass
class TaskStatusChangedEvent(VesperaEvent):
    """Specialized event for task status changes."""
    
    def __init__(self, task_id: str, old_status: str, new_status: str, 
                 user_id: str, **kwargs):
        super().__init__(
            type=EventType.TASK_STATUS_CHANGED,
            source=EventSource.TASK_ORCHESTRATOR,
            task_ids=[task_id],
            user_id=user_id,
            **kwargs
        )
        
        self.payload.update({
            "task_id": task_id,
            "old_status": old_status,
            "new_status": new_status,
            "status_transition": f"{old_status} -> {new_status}"
        })
```

## 🚀 Event Processing Pipeline

### Event Router

```python
class EventRouter:
    """Routes events to appropriate processors based on type and content."""
    
    def __init__(self):
        self.routes: Dict[EventType, List[EventProcessor]] = {}
        self.pattern_routes: List[Tuple[str, EventProcessor]] = []
        self.default_processors: List[EventProcessor] = []
        
    def register_processor(self, event_type: EventType, 
                         processor: EventProcessor) -> None:
        """Register processor for specific event type."""
        if event_type not in self.routes:
            self.routes[event_type] = []
        self.routes[event_type].append(processor)
    
    def register_pattern_processor(self, pattern: str, 
                                 processor: EventProcessor) -> None:
        """Register processor for event type pattern."""
        self.pattern_routes.append((pattern, processor))
    
    async def route_event(self, event: VesperaEvent) -> List[EventProcessor]:
        """Find appropriate processors for event."""
        processors = []
        
        # Direct type match
        if event.type in self.routes:
            processors.extend(self.routes[event.type])
        
        # Pattern matching
        for pattern, processor in self.pattern_routes:
            if self._match_pattern(pattern, event.type.value):
                processors.append(processor)
        
        # Default processors
        processors.extend(self.default_processors)
        
        return processors
    
    def _match_pattern(self, pattern: str, event_type: str) -> bool:
        """Match event type against pattern (supports wildcards)."""
        import fnmatch
        return fnmatch.fnmatch(event_type, pattern)
```

### Filter Pipeline

```python
class EventFilterPipeline:
    """Applies filters to events before processing."""
    
    def __init__(self):
        self.filters: List[EventFilter] = []
    
    def add_filter(self, filter_obj: EventFilter) -> None:
        """Add filter to pipeline."""
        self.filters.append(filter_obj)
    
    async def apply_filters(self, event: VesperaEvent) -> FilterResult:
        """Apply all filters to event."""
        result = FilterResult(passed=True, event=event)
        
        for filter_obj in self.filters:
            filter_result = await filter_obj.filter(result.event)
            
            if not filter_result.passed:
                return FilterResult(
                    passed=False,
                    reason=filter_result.reason,
                    event=result.event
                )
            
            # Filter may modify event
            result.event = filter_result.event
            
        return result

class EventFilter:
    """Base class for event filters."""
    
    async def filter(self, event: VesperaEvent) -> FilterResult:
        """Filter event. Return FilterResult with passed=True to continue."""
        raise NotImplementedError

class RelevanceFilter(EventFilter):
    """Filter events based on relevance to active codex/tasks."""
    
    def __init__(self, active_codex_ids: Set[str], active_task_ids: Set[str]):
        self.active_codex_ids = active_codex_ids
        self.active_task_ids = active_task_ids
    
    async def filter(self, event: VesperaEvent) -> FilterResult:
        """Only pass events relevant to active content."""
        is_relevant = (
            bool(set(event.codex_ids) & self.active_codex_ids) or
            bool(set(event.task_ids) & self.active_task_ids) or
            event.type in [EventType.SYSTEM_STARTUP, EventType.SYSTEM_SHUTDOWN]
        )
        
        return FilterResult(
            passed=is_relevant,
            reason="Not relevant to active content" if not is_relevant else None,
            event=event
        )

class RateLimitFilter(EventFilter):
    """Rate limit events to prevent spam."""
    
    def __init__(self, max_events_per_second: int = 100):
        self.max_events_per_second = max_events_per_second
        self.event_timestamps: deque = deque()
    
    async def filter(self, event: VesperaEvent) -> FilterResult:
        """Apply rate limiting."""
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=1)
        
        # Remove old timestamps
        while self.event_timestamps and self.event_timestamps[0] < cutoff:
            self.event_timestamps.popleft()
        
        # Check rate limit
        if len(self.event_timestamps) >= self.max_events_per_second:
            return FilterResult(
                passed=False,
                reason="Rate limit exceeded",
                event=event
            )
        
        # Add current timestamp
        self.event_timestamps.append(now)
        
        return FilterResult(passed=True, event=event)

class DeduplicationFilter(EventFilter):
    """Remove duplicate events within time window."""
    
    def __init__(self, dedup_window_seconds: int = 5):
        self.dedup_window_seconds = dedup_window_seconds
        self.recent_events: Dict[str, datetime] = {}
    
    async def filter(self, event: VesperaEvent) -> FilterResult:
        """Remove duplicate events."""
        event_key = self._generate_event_key(event)
        now = datetime.utcnow()
        
        # Clean old entries
        cutoff = now - timedelta(seconds=self.dedup_window_seconds)
        self.recent_events = {
            k: v for k, v in self.recent_events.items() 
            if v > cutoff
        }
        
        # Check for duplicate
        if event_key in self.recent_events:
            return FilterResult(
                passed=False,
                reason="Duplicate event within deduplication window",
                event=event
            )
        
        # Record event
        self.recent_events[event_key] = now
        
        return FilterResult(passed=True, event=event)
    
    def _generate_event_key(self, event: VesperaEvent) -> str:
        """Generate key for deduplication."""
        key_components = [
            event.type.value,
            str(sorted(event.codex_ids)),
            str(sorted(event.task_ids)),
            event.user_id or "system",
            str(sorted(event.payload.items()))
        ]
        return "|".join(key_components)

@dataclass
class FilterResult:
    """Result of filter application."""
    passed: bool
    event: VesperaEvent
    reason: Optional[str] = None
```

## 💾 Event Storage and Persistence

### Triple Database Event Storage

```python
class EventStorageManager:
    """Manages event storage across triple database system."""
    
    def __init__(self, sqlite_service, chroma_service, kuzu_service):
        self.sqlite_service = sqlite_service
        self.chroma_service = chroma_service  
        self.kuzu_service = kuzu_service
        
    async def store_event(self, event: VesperaEvent) -> bool:
        """Store event across all databases."""
        success = True
        
        # Store in SQLite (primary event stream)
        try:
            await self._store_in_sqlite(event)
        except Exception as e:
            logger.error(f"Failed to store event in SQLite: {e}")
            success = False
        
        # Store in Chroma (for semantic search)
        try:
            await self._store_in_chroma(event)
        except Exception as e:
            logger.error(f"Failed to store event in Chroma: {e}")
            success = False
        
        # Store in KuzuDB (for relationship analysis)
        try:
            await self._store_in_kuzu(event)
        except Exception as e:
            logger.error(f"Failed to store event in KuzuDB: {e}")
            success = False
            
        return success
    
    async def _store_in_sqlite(self, event: VesperaEvent) -> None:
        """Store event in SQLite event stream."""
        query = """
        INSERT INTO events (
            id, type, source, timestamp, sequence_number,
            codex_ids, task_ids, user_id, payload, tags, metadata,
            processing_state, retry_count, max_retries,
            trace_id, parent_event_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        parameters = (
            event.id,
            event.type.value,
            event.source.value,
            event.timestamp,
            event.sequence_number,
            json.dumps(event.codex_ids),
            json.dumps(event.task_ids),
            event.user_id,
            json.dumps(event.payload),
            json.dumps(event.tags),
            json.dumps(event.metadata),
            event.processing_state.value,
            event.retry_count,
            event.max_retries,
            event.trace_id,
            event.parent_event_id
        )
        
        await self.sqlite_service.execute(query, parameters)
    
    async def _store_in_chroma(self, event: VesperaEvent) -> None:
        """Store event in Chroma for semantic search."""
        # Create searchable document from event
        document_content = f"""
        Event Type: {event.type.value}
        Source: {event.source.value}
        Tags: {', '.join(event.tags)}
        Payload: {json.dumps(event.payload, indent=2)}
        Metadata: {json.dumps(event.metadata, indent=2)}
        """
        
        metadata = {
            "event_id": event.id,
            "event_type": event.type.value,
            "source": event.source.value,
            "timestamp": event.timestamp.isoformat(),
            "codex_ids": event.codex_ids,
            "task_ids": event.task_ids,
            "user_id": event.user_id or "",
            "tags": event.tags,
            "processing_state": event.processing_state.value
        }
        
        collection = self.chroma_service.get_collection("events")
        collection.add(
            ids=[event.id],
            documents=[document_content],
            metadatas=[metadata]
        )
    
    async def _store_in_kuzu(self, event: VesperaEvent) -> None:
        """Store event in KuzuDB graph database."""
        connection = kuzu.Connection(self.kuzu_service.database)
        
        try:
            # Create Event node
            query = """
            CREATE (e:Event {
                id: $id,
                type: $type,
                source: $source,
                timestamp: $timestamp,
                sequence_number: $sequence_number,
                user_id: $user_id,
                processing_state: $processing_state,
                tags: $tags
            })
            """
            
            parameters = {
                "id": event.id,
                "type": event.type.value,
                "source": event.source.value,
                "timestamp": event.timestamp,
                "sequence_number": event.sequence_number,
                "user_id": event.user_id or "",
                "processing_state": event.processing_state.value,
                "tags": event.tags
            }
            
            connection.execute(query, parameters)
            
            # Create relationships to Codex entries
            for codex_id in event.codex_ids:
                rel_query = """
                MATCH (e:Event {id: $event_id}), (c:Codex {id: $codex_id})
                CREATE (e)-[:AFFECTS]->(c)
                """
                connection.execute(rel_query, {
                    "event_id": event.id,
                    "codex_id": codex_id
                })
            
            # Create relationships to Tasks
            for task_id in event.task_ids:
                rel_query = """
                MATCH (e:Event {id: $event_id}), (t:Task {id: $task_id})
                CREATE (e)-[:AFFECTS]->(t)
                """
                connection.execute(rel_query, {
                    "event_id": event.id,
                    "task_id": task_id
                })
                
        finally:
            connection.close()
```

## 🔄 Event Processing and Consumption

### Event Bus Implementation

```python
class VesperaEventBus:
    """High-performance event bus with async processing."""
    
    def __init__(self):
        self.subscribers: Dict[str, List[EventSubscriber]] = {}
        self.event_queue = asyncio.Queue(maxsize=10000)
        self.processing_task: Optional[asyncio.Task] = None
        self.storage_manager: Optional[EventStorageManager] = None
        self.filter_pipeline = EventFilterPipeline()
        self.router = EventRouter()
        self._shutdown = False
        
    async def start(self) -> None:
        """Start event bus processing."""
        if self.processing_task is None or self.processing_task.done():
            self._shutdown = False
            self.processing_task = asyncio.create_task(self._process_events())
            logger.info("Event bus started")
    
    async def stop(self) -> None:
        """Stop event bus processing."""
        self._shutdown = True
        if self.processing_task:
            self.processing_task.cancel()
            try:
                await self.processing_task
            except asyncio.CancelledError:
                pass
        logger.info("Event bus stopped")
    
    async def publish(self, event: VesperaEvent) -> bool:
        """Publish event to bus."""
        try:
            await self.event_queue.put(event)
            return True
        except asyncio.QueueFull:
            logger.error(f"Event queue full, dropping event {event.id}")
            return False
    
    def subscribe(self, event_pattern: str, subscriber: EventSubscriber) -> str:
        """Subscribe to events matching pattern."""
        if event_pattern not in self.subscribers:
            self.subscribers[event_pattern] = []
        
        subscriber_id = str(uuid.uuid4())
        subscriber.id = subscriber_id
        self.subscribers[event_pattern].append(subscriber)
        
        return subscriber_id
    
    def unsubscribe(self, subscriber_id: str) -> bool:
        """Unsubscribe from events."""
        for pattern, subscribers in self.subscribers.items():
            self.subscribers[pattern] = [
                sub for sub in subscribers if sub.id != subscriber_id
            ]
        return True
    
    async def _process_events(self) -> None:
        """Main event processing loop."""
        while not self._shutdown:
            try:
                event = await asyncio.wait_for(
                    self.event_queue.get(), 
                    timeout=1.0
                )
                
                await self._handle_event(event)
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing event: {e}")
                await asyncio.sleep(0.1)
    
    async def _handle_event(self, event: VesperaEvent) -> None:
        """Handle individual event."""
        # Apply filters
        filter_result = await self.filter_pipeline.apply_filters(event)
        if not filter_result.passed:
            logger.debug(f"Event {event.id} filtered: {filter_result.reason}")
            return
        
        # Store event
        if self.storage_manager:
            await self.storage_manager.store_event(filter_result.event)
        
        # Find subscribers
        matching_subscribers = self._find_matching_subscribers(filter_result.event)
        
        # Notify subscribers
        await self._notify_subscribers(filter_result.event, matching_subscribers)
    
    def _find_matching_subscribers(self, event: VesperaEvent) -> List[EventSubscriber]:
        """Find subscribers for event."""
        matching = []
        
        for pattern, subscribers in self.subscribers.items():
            if self._match_event_pattern(pattern, event):
                matching.extend(subscribers)
        
        return matching
    
    def _match_event_pattern(self, pattern: str, event: VesperaEvent) -> bool:
        """Match event against subscription pattern."""
        import fnmatch
        
        # Support patterns like "tag_*", "task_status_changed", "*_completed"
        return fnmatch.fnmatch(event.type.value, pattern)
    
    async def _notify_subscribers(self, event: VesperaEvent, 
                                subscribers: List[EventSubscriber]) -> None:
        """Notify all matching subscribers."""
        if not subscribers:
            return
        
        # Create notification tasks
        tasks = [
            asyncio.create_task(subscriber.handle_event(event))
            for subscriber in subscribers
        ]
        
        # Wait for all notifications (don't fail if one subscriber fails)
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Log any failures
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Subscriber {subscribers[i].id} failed: {result}")
```

### Event Subscribers

```python
class EventSubscriber:
    """Base class for event subscribers."""
    
    def __init__(self, name: str):
        self.name = name
        self.id: Optional[str] = None
    
    async def handle_event(self, event: VesperaEvent) -> None:
        """Handle event. Override in subclasses."""
        raise NotImplementedError

class AutomationEventSubscriber(EventSubscriber):
    """Subscriber that triggers automation rules."""
    
    def __init__(self, automation_engine):
        super().__init__("AutomationEventSubscriber")
        self.automation_engine = automation_engine
    
    async def handle_event(self, event: VesperaEvent) -> None:
        """Trigger automation rules for event."""
        await self.automation_engine.process_event(event)

class UINotificationSubscriber(EventSubscriber):
    """Subscriber that sends UI notifications."""
    
    def __init__(self, notification_manager):
        super().__init__("UINotificationSubscriber")
        self.notification_manager = notification_manager
    
    async def handle_event(self, event: VesperaEvent) -> None:
        """Send UI notifications for relevant events."""
        if self._should_notify(event):
            notification = self._create_notification(event)
            await self.notification_manager.send(notification)
    
    def _should_notify(self, event: VesperaEvent) -> bool:
        """Determine if event should trigger notification."""
        notify_types = [
            EventType.TASK_COMPLETED,
            EventType.AUTOMATION_FAILED,
            EventType.CONTENT_LINKED,
            EventType.TAG_ADDED
        ]
        return event.type in notify_types
    
    def _create_notification(self, event: VesperaEvent) -> Dict[str, Any]:
        """Create notification from event."""
        return {
            "type": "event_notification",
            "title": f"{event.type.value.replace('_', ' ').title()}",
            "message": self._format_event_message(event),
            "timestamp": event.timestamp,
            "codex_ids": event.codex_ids,
            "actions": self._suggest_actions(event)
        }
    
    def _format_event_message(self, event: VesperaEvent) -> str:
        """Format human-readable event message."""
        if event.type == EventType.TASK_COMPLETED:
            return f"Task '{event.payload.get('task_title', 'Unknown')}' completed"
        elif event.type == EventType.AUTOMATION_FAILED:
            return f"Automation rule '{event.payload.get('rule_name')}' failed"
        elif event.type == EventType.TAG_ADDED:
            return f"Tag '{event.payload.get('tag')}' added to content"
        else:
            return f"Event: {event.type.value.replace('_', ' ')}"

class SyncEventSubscriber(EventSubscriber):
    """Subscriber that handles synchronization events."""
    
    def __init__(self, sync_coordinator):
        super().__init__("SyncEventSubscriber")
        self.sync_coordinator = sync_coordinator
    
    async def handle_event(self, event: VesperaEvent) -> None:
        """Handle synchronization for relevant events."""
        if self._requires_sync(event):
            await self._schedule_sync(event)
    
    def _requires_sync(self, event: VesperaEvent) -> bool:
        """Check if event requires synchronization."""
        sync_events = [
            EventType.CONTENT_CREATED,
            EventType.CONTENT_UPDATED,
            EventType.TASK_CREATED,
            EventType.TASK_UPDATED,
            EventType.RELATIONSHIP_CREATED
        ]
        return event.type in sync_events
    
    async def _schedule_sync(self, event: VesperaEvent) -> None:
        """Schedule synchronization for event."""
        # Schedule sync for affected codex entries
        for codex_id in event.codex_ids:
            await self.sync_coordinator.schedule_sync(
                codex_id, "update", priority=1
            )
        
        # Schedule sync for affected tasks
        for task_id in event.task_ids:
            await self.sync_coordinator.schedule_sync(
                task_id, "update", priority=1
            )
```

## 📈 Performance and Monitoring

### Event Metrics Collection

```python
class EventMetricsCollector:
    """Collects performance metrics for event system."""
    
    def __init__(self):
        self.metrics = {
            "events_published": 0,
            "events_processed": 0,
            "events_filtered": 0,
            "processing_errors": 0,
            "average_processing_time": 0,
            "queue_size": 0,
            "subscriber_count": 0
        }
        self.processing_times: deque = deque(maxlen=1000)
    
    def record_event_published(self) -> None:
        """Record event publication."""
        self.metrics["events_published"] += 1
    
    def record_event_processed(self, processing_time: float) -> None:
        """Record event processing."""
        self.metrics["events_processed"] += 1
        self.processing_times.append(processing_time)
        
        # Update average processing time
        if self.processing_times:
            self.metrics["average_processing_time"] = (
                sum(self.processing_times) / len(self.processing_times)
            )
    
    def record_event_filtered(self, reason: str) -> None:
        """Record event filtering."""
        self.metrics["events_filtered"] += 1
    
    def record_processing_error(self, error: Exception) -> None:
        """Record processing error."""
        self.metrics["processing_errors"] += 1
    
    def update_queue_size(self, size: int) -> None:
        """Update queue size metric."""
        self.metrics["queue_size"] = size
    
    def update_subscriber_count(self, count: int) -> None:
        """Update subscriber count."""
        self.metrics["subscriber_count"] = count
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics."""
        return self.metrics.copy()
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get performance summary."""
        if not self.processing_times:
            return {"error": "No processing times recorded"}
        
        times = list(self.processing_times)
        times.sort()
        
        return {
            "total_processed": len(times),
            "average_time": sum(times) / len(times),
            "median_time": times[len(times) // 2],
            "p95_time": times[int(len(times) * 0.95)],
            "p99_time": times[int(len(times) * 0.99)],
            "min_time": min(times),
            "max_time": max(times)
        }
```

## 🔧 Configuration and Setup

### Event System Configuration

```python
@dataclass
class EventSystemConfig:
    """Configuration for event system."""
    
    # Queue settings
    max_queue_size: int = 10000
    batch_size: int = 100
    batch_timeout: float = 0.1
    
    # Filter settings
    enable_rate_limiting: bool = True
    max_events_per_second: int = 100
    enable_deduplication: bool = True
    dedup_window_seconds: int = 5
    
    # Storage settings
    store_events_sqlite: bool = True
    store_events_chroma: bool = True
    store_events_kuzu: bool = True
    event_retention_days: int = 90
    
    # Processing settings
    max_concurrent_processors: int = 10
    retry_failed_events: bool = True
    max_event_retries: int = 3
    
    # Performance settings
    enable_metrics: bool = True
    metrics_collection_interval: int = 60
    
    # Debug settings
    log_all_events: bool = False
    log_filtered_events: bool = False
    enable_event_tracing: bool = False

class EventSystemFactory:
    """Factory for creating configured event system."""
    
    @staticmethod
    def create(config: EventSystemConfig, 
               storage_manager: EventStorageManager) -> VesperaEventBus:
        """Create fully configured event system."""
        
        # Create event bus
        event_bus = VesperaEventBus()
        event_bus.storage_manager = storage_manager
        
        # Configure filters
        if config.enable_rate_limiting:
            rate_filter = RateLimitFilter(config.max_events_per_second)
            event_bus.filter_pipeline.add_filter(rate_filter)
        
        if config.enable_deduplication:
            dedup_filter = DeduplicationFilter(config.dedup_window_seconds)
            event_bus.filter_pipeline.add_filter(dedup_filter)
        
        # Configure metrics collection
        if config.enable_metrics:
            metrics_collector = EventMetricsCollector()
            # Wire up metrics collection...
        
        return event_bus
```

The Event System Specification provides the foundation for reactive content workflows and intelligent automation in the Vespera Codex architecture, enabling real-time responses to user actions and content changes while maintaining high performance and reliability.