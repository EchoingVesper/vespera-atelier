# Template-Driven Dynamic Automation Architecture

## Overview

The Vespera Codex Template-Driven Automation system transforms static content into reactive, intelligent ecosystems where **automation rules are defined within templates themselves**. By combining template-driven automation with LLM-assisted rule creation, the system enables magical user experiences where content automatically responds to changes based on user-customizable template definitions rather than hardcoded system types.

This document outlines the revolutionary template-aware automation engine that makes the Vespera Codex truly intelligent, reactive, and infinitely customizable to any workflow or domain.

## 🎯 Vision: Template-Driven Magical Content Ecosystems

Imagine a creative workspace where **templates define their own automation behavior**:

- A `fantasy_scene` template defines that changing mood from `#peaceful` to `#tense` automatically switches linked `ambient_music` template entries from "Forest Sounds" to "Battle Drums"
- An `agile_epic` template specifies that completing user stories automatically updates `sprint_burndown` templates and creates `code_review` template tasks
- A `research_paper` template defines that marking sections as "final" creates `peer_review` template tasks for all linked `co_author` template entries
- Content changes propagate through interconnected Codex entries based on template-defined automation rules rather than hardcoded system behavior

## 🏗️ System Architecture

### Core Components

```
vespera-atelier/
├── packages/
│   └── vespera-scriptorium/           # Enhanced task orchestrator
│       ├── automation/                # New automation engine
│       │   ├── engine/               # Core automation processing
│       │   ├── rules/               # Rule definitions and storage
│       │   ├── triggers/            # Event detection and handling
│       │   └── actions/             # Automated response execution
│       ├── events/                   # Event system architecture
│       │   ├── publishers/          # Event emission and broadcasting
│       │   ├── subscribers/         # Event listening and handling
│       │   └── middleware/          # Event processing pipeline
│       └── codex/                   # Codex integration layer
│           ├── content_types/       # Media-aware content handling
│           ├── relationships/       # Cross-codex relationship management
│           └── sync/               # Real-time content synchronization
└── plugins/
    └── Obsidian/
        └── vespera-scriptorium/      # Frontend integration
            ├── src/automation/       # Automation UI components
            └── src/events/          # Real-time event handling
```

### Template-Aware Event System Architecture

The automation engine builds on Vespera Scriptorium's existing triple-database architecture (SQLite + Chroma + KuzuDB), extending it with template-driven event processing:

```typescript
interface TemplateAwareVesperaEvent {
    id: string;
    type: string; // Dynamic type from template automation_rules
    source: EventSource;
    timestamp: DateTime;
    payload: EventPayload;
    tags: string[];
    codex_ids: string[];
    metadata: EventMetadata;
    
    // Template-specific properties
    template_id: string;
    template_version: string;
    template_context: TemplateEventContext;
}

interface TemplateEventContext {
    triggering_field?: string;        // Field that changed
    template_automation_rule: AutomationRule;  // Template-defined rule
    template_field_schema: FieldDefinition[];  // Available fields for this template
    cross_template_refs: CrossTemplateReference[]; // Links to other template types
}
```

## 🏷️ Template-Driven Automation Engine

### Template-Defined Event Detection

The system monitors changes across all Codex entries and triggers automation chains based on template-defined rules:

```python
class TemplateAutomationEngine:
    """Monitors template-defined events and executes template automation rules."""
    
    def __init__(self, task_service, event_publisher, template_registry):
        self.task_service = task_service
        self.event_publisher = event_publisher
        self.template_registry = template_registry
        self.rule_engine = TemplateAwareRuleEngine()
        
    async def on_template_event(self, event: TemplateAwareVesperaEvent):
        """Handle template-defined events and trigger automation."""
        # Get template definition
        template = await self.template_registry.get_template(event.template_id)
        
        # Find applicable template automation rules
        rules = await self.rule_engine.find_template_rules(
            template.automation_rules,
            event.type,
            event.template_context
        )
        
        # Execute template-defined automation chains
        for rule in rules:
            await self.execute_template_automation_rule(rule, event, template)
```

### Template-Defined Automation Example: Music Integration

**Scenario**: User creates custom `fantasy_scene` and `ambient_music` templates with integrated automation

```json5
// fantasy_scene.json5 template excerpt
{
  "template_id": "fantasy_scene_v1",
  "field_schema": {
    "mood": {
      "type": "select",
      "options": ["peaceful", "tense", "mysterious", "epic"]
    },
    "linked_music": {
      "type": "codex_reference",
      "filter": {"template_id": ["ambient_music_v1"]}
    }
  },
  
  // Template defines its own automation rules
  "automation_rules": [
    {
      "trigger": "field_changed",
      "field": "mood",
      "action": "update_linked_templates",
      "params": {
        "target_template_type": "ambient_music_v1",
        "update_rule": "mood_mapping",
        "field_mapping": {
          "peaceful": {"track_type": "nature_sounds", "intensity": "low"},
          "tense": {"track_type": "battle_music", "intensity": "high"}
        }
      }
    }
  ]
}
```

**Template-Driven Implementation Flow**:

1. **Template Field Change**: User changes `mood` field from "peaceful" to "tense" in fantasy_scene template instance
2. **Template Rule Matching**: System finds template-defined automation rule for mood field changes
3. **Template Context Resolution**: Identifies linked `ambient_music_v1` template instances
4. **Template Action Execution**:
   - Applies template-defined field mapping (tense → battle_music + high intensity)
   - Updates linked ambient_music template instances with new field values
   - Triggers template-defined transition behavior
5. **Template Event Propagation**: Publishes template-aware events for UI updates
6. **User Experience**: Music seamlessly transitions based on user-defined template automation, not hardcoded system behavior

### Template-Based Content Discovery

```python
class TemplateBasedContentEngine:
    """Manages content discovery and linking through template relationships."""
    
    async def find_related_content(self, 
                                 template_id: str,
                                 field_values: Dict[str, Any],
                                 related_template_types: List[str] = None) -> List[CodexEntry]:
        """Find content related through template-defined relationships."""
        template = await self.template_registry.get_template(template_id)
        
        # Build query based on template field schema and cross-references
        query = """
        MATCH (source:Codex {template_id: $template_id})
        MATCH (related:Codex)-[:TEMPLATE_RELATIONSHIP]->(source)
        WHERE related.template_id IN $related_template_types
        """
        
        # Add template-specific field matching
        for field_name, field_value in field_values.items():
            if self._is_reference_field(template.field_schema.get(field_name)):
                query += f" AND related.template_data.{field_name} = $field_{field_name}"
        
        query += """
        RETURN related,
               related.template_id as template_type,
               size((related)-[:TEMPLATE_RELATIONSHIP]->()) as relationship_strength
        ORDER BY relationship_strength DESC
        """
        
        return await self.graph_service.execute_query(query, {
            "template_id": template_id,
            "related_template_types": related_template_types or [],
            **{f"field_{k}": v for k, v in field_values.items()}
        })
```

## 🤖 LLM-Assisted Template Automation Setup

### Natural Language Template Rule Creation

Users can describe automation in natural language, and the LLM creates template-embedded automation rules:

```python
class LLMTemplateRuleGenerator:
    """Converts natural language descriptions into template automation rules."""
    
    async def generate_template_rule(self, 
                                   description: str, 
                                   template_context: Template) -> AutomationRule:
        """Convert natural language to template-embedded automation rule."""
        
        system_prompt = f"""
        Convert natural language automation descriptions into template-specific rules for the template "{template_context.name}".
        
        Available template triggers (based on template field schema):
        - field_changed: When template fields are modified
        - created: When template instance is created
        - status_changed: When template status fields change
        - relationship_added: When template cross-references are added
        
        Template field schema:
        {self._format_field_schema(template_context.field_schema)}
        
        Available template actions:
        - update_linked_templates: Modify related template instances
        - create_template_instance: Generate new template instances
        - update_template_relationship: Modify template cross-references
        - trigger_template_workflow: Run template-defined workflows
        - notify_template_users: Send template-aware notifications
        """
        
        user_prompt = f"""
        Create template automation rule for: "{description}"
        Template: {template_context.name} (ID: {template_context.template_id})
        
        Return structured JSON5 automation rule to embed in template definition.
        """
        
        # LLM processing with template context
        response = await self.llm_client.generate_completion(
            system_prompt, user_prompt
        )
        
        return self.parse_template_rule(response, template_context)
```

### Example Natural Language Template Automations

**User Input**: "When Alice's emotional state changes to scared, switch to tense music"
**Template Context**: User has `fantasy_character` and `ambient_music` templates

**Generated Template Rule** (embedded in fantasy_character template):

```json5
{
  "trigger": "field_changed",
  "field": "emotional_state",
  "condition": "new_value == 'scared'",
  "action": "update_linked_templates",
  "params": {
    "target_template_type": "ambient_music_v1",
    "filter": {"linked_character": "{{codex_id}}"},
    "update_fields": {
      "mood_category": "tense",
      "intensity_level": "high",
      "genre_preference": "horror"
    },
    "transition_method": "immediate_switch"
  }
}
```

**User Input**: "If I mark a scene as final, create review tasks for all characters"
**Template Context**: User has `fantasy_scene`, `fantasy_character`, and `review_task` templates

**Generated Template Rule** (embedded in fantasy_scene template):

```json5
{
  "trigger": "field_changed",
  "field": "scene_status",
  "condition": "new_value == 'final'",
  "action": "create_template_instances",
  "params": {
    "template_type": "review_task_v1",
    "for_each_linked": {
      "template_type": "fantasy_character_v1",
      "relationship_field": "characters_in_scene"
    },
    "instance_data": {
      "task_title": "Review {{character.character_name}} in {{scene.scene_title}}",
      "task_description": "Review character development and consistency",
      "review_type": "character_consistency",
      "related_scene": "{{codex_id}}",
      "target_character": "{{linked_character.codex_id}}",
      "priority": "high"
    }
  }
}
```

**User Input**: "When I complete character development tasks, update their relationship maps"
**Template Context**: User has `character_development_task` and `fantasy_character` templates

**Generated Template Rule** (embedded in character_development_task template):

```json5
{
  "trigger": "field_changed",
  "field": "task_status",
  "condition": "new_value == 'completed'",
  "action": "update_linked_templates",
  "params": {
    "target_template_type": "fantasy_character_v1",
    "link_field": "target_character",
    "update_strategy": "relationship_analysis",
    "update_fields": {
      "relationship_map": "{{analyze_development_impact(task_notes, character_relationships)}}",
      "character_arc_progress": "{{increment_progress()}}",
      "last_development_update": "{{current_timestamp()}}"
    },
    "trigger_events": [
      {
        "event_type": "character_relationships_updated",
        "template_context": true
      }
    ]
  }
}
```

## 🔗 Cross-Template Automation Chains

### Template-Aware Cascading Automation Architecture

Template automation chains enable complex workflows that span multiple template types based on user-defined template relationships:

```python
class TemplateAutomationChain:
    """Manages cascading automation across different template types."""
    
    def __init__(self, template_registry: TemplateRegistry):
        self.template_registry = template_registry
        self.chain_steps: List[TemplateAutomationStep] = []
        self.template_context: Dict[str, TemplateContext] = {}
        self.rollback_stack: List[TemplateRollbackAction] = []
    
    async def execute_template_chain(self, 
                                   initial_event: TemplateAwareVesperaEvent) -> TemplateChainResult:
        """Execute a multi-step template automation chain."""
        self.template_context["initial_event"] = initial_event
        self.template_context["source_template"] = await self.template_registry.get_template(initial_event.template_id)
        results = []
        
        try:
            for step in self.chain_steps:
                # Resolve template context for each step
                step_template = await self.template_registry.get_template(step.target_template_id)
                template_context = TemplateStepContext(
                    source_template=self.template_context["source_template"],
                    target_template=step_template,
                    field_mappings=step.template_field_mappings
                )
                
                result = await self.execute_template_step(step, template_context)
                results.append(result)
                
                # Update template context for next step
                self.template_context.update(result.template_updates)
                
                # Record template-aware rollback action
                if result.rollback_action:
                    self.rollback_stack.append(result.rollback_action)
                    
        except Exception as e:
            # Execute template-aware rollback
            await self.rollback_template_chain()
            raise TemplateAutomationChainError(f"Template chain failed: {e}")
            
        return TemplateChainResult(success=True, results=results, template_context=self.template_context)
```

### Example: Template-Driven Creative Workflow

**Scenario**: Scene completion across user's custom `fantasy_scene`, `fantasy_character`, `character_development_task`, and `ambient_music` templates

**Template Chain Definition** (stored in fantasy_scene template):

```json5
{
  "name": "Scene Completion Workflow",
  "description": "Comprehensive template automation when scene is marked complete",
  
  "automation_rules": [
    {
      "trigger": "field_changed",
      "field": "scene_status",
      "condition": "new_value == 'complete'",
      "action": "execute_template_chain",
      "chain_steps": [
        {
          "step": 1,
          "name": "Update Character States",
          "target_template": "fantasy_character_v1",
          "selection": {
            "linked_field": "characters_in_scene"
          },
          "updates": {
            "scenes_completed": "{{increment()}}",
            "character_arc_progress": "{{calculate_progress()}}",
            "relationship_developments": "{{analyze_scene_relationships()}}"
          }
        },

        {
          "step": 2,
          "name": "Generate Character Review Tasks",
          "target_template": "character_review_task_v1",
          "depends_on": [1],
          "create_instances": {
            "for_each": "{{linked_characters}}",
            "template_data": {
              "task_title": "Review {{character.character_name}} in {{scene.scene_title}}",
              "review_focus": "character_development",
              "source_scene": "{{codex_id}}",
              "target_character": "{{character.codex_id}}",
              "priority": "normal"
            }
          }
        },
        {
          "step": 3,
          "name": "Update Story Timeline",
          "target_template": "story_timeline_v1",
          "depends_on": [1],
          "updates": {
            "timeline_events": "{{append_scene_completion()}}",
            "plot_advancement": "{{analyze_plot_implications()}}",
            "character_arcs": "{{update_character_progressions()}}"
          }
        },
        {
          "step": 4,
          "name": "Adjust Ambient Music",
          "target_template": "ambient_music_v1",
          "depends_on": [3],
          "selection": {
            "linked_field": "scene_music"
          },
          "updates": {
            "current_track": "{{select_transition_music(story_phase, emotional_tone)}}",
            "transition_type": "gentle_fade",
            "intensity": "{{calculate_scene_intensity()}}"
          }
        }
      ]

    },
    "rollback_strategy": {
      "on_failure": "reverse_completed_template_steps",
      "preserve_user_changes": true,
      "restore_template_states": true,
      "notify_user": true
    }
  ]
}
```

## ⚡ Real-Time Template-Reactive Content

### Template-Aware Live Update Architecture

The system provides immediate UI updates and content synchronization based on template definitions:

```typescript
class TemplateReactiveContentManager {
    private eventBus: EventBus;
    private templateRegistry: TemplateRegistry;
    private subscriptions: Map<string, Set<TemplateContentSubscription>>;
    
    constructor(eventBus: EventBus, templateRegistry: TemplateRegistry) {
        this.eventBus = eventBus;
        this.templateRegistry = templateRegistry;
        this.subscriptions = new Map();
        
        // Subscribe to template automation events
        this.eventBus.subscribe('template.automation.*', this.handleTemplateAutomationEvent.bind(this));
        // Subscribe to template updates
        this.eventBus.subscribe('template.updated.*', this.handleTemplateUpdated.bind(this));
    }
    
    async handleTemplateAutomationEvent(event: TemplateAwareVesperaEvent): Promise<void> {
        // Get template definition for context
        const template = await this.templateRegistry.get_template(event.template_id);
        
        // Find template-aware UI subscriptions
        const affected_codex = event.codex_ids;
        const subscribers = this.getSubscribersForTemplate(event.template_id, affected_codex);
        
        // Push template-aware updates to UI
        for (const subscription of subscribers) {
            await this.pushTemplateUpdate(subscription, {
                type: 'template_automation_update',
                template_id: event.template_id,
                template_context: event.template_context,
                codex_ids: affected_codex,
                field_changes: event.payload.field_changes,
                automation_rule: event.template_context.template_automation_rule,
                timestamp: event.timestamp
            });
        }
    }
    
    async handleTemplateUpdated(event: TemplateUpdateEvent): Promise<void> {
        // Handle template definition changes - update all instances
        const affectedInstances = await this.findInstancesOfTemplate(event.template_id);
        
        for (const instance of affectedInstances) {
            // Notify subscribers that template definition changed
            await this.notifyTemplateSchemaChange(instance.codex_id, event.template_changes);
        }
    }
    
    async subscribeToTemplateInstance(codex_id: string, 
                                     template_id: string,
                                     callback: TemplateUpdateCallback): Promise<string> {
        const subscription_id = generateId();
        
        if (!this.subscriptions.has(codex_id)) {
            this.subscriptions.set(codex_id, new Set());
        }
        
        this.subscriptions.get(codex_id)!.add({
            id: subscription_id,
            template_id: template_id,
            callback,
            template_aware: true,
            created_at: new Date()
        });
        
        return subscription_id;
    }
    
    async subscribeToTemplate(template_id: string,
                             callback: TemplateSchemaUpdateCallback): Promise<string> {
        // Subscribe to template definition changes
        const subscription_id = generateId();
        const template_key = `template:${template_id}`;
        
        if (!this.subscriptions.has(template_key)) {
            this.subscriptions.set(template_key, new Set());
        }
        
        this.subscriptions.get(template_key)!.add({
            id: subscription_id,
            template_id: template_id,
            callback,
            schema_subscription: true,
            created_at: new Date()
        });
        
        return subscription_id;
    }
}
```

### Template-Aware UI Integration Examples

**Obsidian Plugin Integration**:

```typescript
// Template-aware Obsidian plugin component
class TemplateAwareVesperaCodexView extends ItemView {
    private templateReactiveManager: TemplateReactiveContentManager;
    private templateRegistry: TemplateRegistry;
    private subscriptions: string[] = [];
    private currentTemplate: Template | null = null;
    
    async onload() {
        const codex_id = this.getCodexId();
        const template_id = this.getTemplateId();
        
        // Load template definition
        this.currentTemplate = await this.templateRegistry.get_template(template_id);
        
        // Subscribe to template instance changes
        const instance_subscription = await this.templateReactiveManager.subscribeToTemplateInstance(
            codex_id,
            template_id,
            this.handleTemplateInstanceUpdate.bind(this)
        );
        
        // Subscribe to template definition changes
        const schema_subscription = await this.templateReactiveManager.subscribeToTemplate(
            template_id,
            this.handleTemplateSchemaUpdate.bind(this)
        );
        
        this.subscriptions.push(instance_subscription, schema_subscription);
    }
    
    private handleTemplateInstanceUpdate(update: TemplateUpdate): void {
        // Update UI based on template automation changes
        if (update.type === 'template_automation_update') {
            this.updateTemplateFields(update.field_changes);
            
            // Show template-specific automation feedback
            this.showTemplateAutomationFeedback({
                template_name: this.currentTemplate?.name,
                automation_rule: update.automation_rule.trigger + ' → ' + update.automation_rule.action,
                field_changes: update.field_changes,
                affected_templates: update.template_context.cross_template_refs
            });
        }
        
        if (update.type === 'cross_template_update') {
            this.updateCrossTemplateReferences(update.linked_template_changes);
        }
    }
    
    private handleTemplateSchemaUpdate(schemaUpdate: TemplateSchemaUpdate): void {
        // Template definition was updated - rebuild UI
        this.currentTemplate = schemaUpdate.updated_template;
        this.rebuildTemplateView();
        
        this.showNotification({
            message: `Template "${this.currentTemplate.name}" was updated`,
            details: 'UI has been refreshed with new template definition',
            type: 'info'
        });
    }
    
    private updateTemplateFields(fieldChanges: TemplateFieldChange[]): void {
        for (const change of fieldChanges) {
            const fieldDef = this.currentTemplate?.field_schema[change.field_name];
            if (fieldDef) {
                this.renderTemplateField(change.field_name, fieldDef, change.new_value);
            }
        }
    }
}
```

## 🔧 Template-Aware Technical Implementation

### Template Event System Performance

```python
class TemplateEventProcessor:
    """High-performance template event processing with batching and template-aware throttling."""
    
    def __init__(self, template_registry: TemplateRegistry):
        self.template_registry = template_registry
        self.template_event_queue = asyncio.Queue(maxsize=10000)
        self.batch_size = 100
        self.batch_timeout = 0.1  # 100ms
        self.template_processors = {}  # Processors by template_id
        
    async def process_template_events(self):
        """Process template events in batches with template-aware grouping."""
        while True:
            batch = []
            deadline = asyncio.get_event_loop().time() + self.batch_timeout
            
            # Collect batch of template events
            while len(batch) < self.batch_size and asyncio.get_event_loop().time() < deadline:
                try:
                    event = await asyncio.wait_for(
                        self.template_event_queue.get(), 
                        timeout=deadline - asyncio.get_event_loop().time()
                    )
                    batch.append(event)
                except asyncio.TimeoutError:
                    break
            
            if batch:
                await self.process_template_batch(batch)
    
    async def process_template_batch(self, events: List[TemplateAwareVesperaEvent]):
        """Process a batch of template events efficiently with template-aware grouping."""
        # Group by template_id and event type for optimized processing
        template_grouped = {}
        for event in events:
            template_key = f"{event.template_id}:{event.type}"
            if template_key not in template_grouped:
                template_grouped[template_key] = []
            template_grouped[template_key].append(event)
        
        # Process each template group
        tasks = []
        for template_key, event_list in template_grouped.items():
            template_id, event_type = template_key.split(':', 1)
            
            # Get template-specific processor or use generic
            processor_key = f"{template_id}:{event_type}"
            if processor_key in self.template_processors:
                processor = self.template_processors[processor_key]
            elif template_id in self.template_processors:
                processor = self.template_processors[template_id]
            else:
                # Use generic template processor
                processor = self.generic_template_processor
            
            task = asyncio.create_task(
                processor(event_list, await self.template_registry.get_template(template_id))
            )
            tasks.append(task)
        
        # Wait for all template processing to complete
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
```

### Template Automation Rule Engine

```python
class TemplateAutomationRuleEngine:
    """Core template-aware rule evaluation and execution engine."""
    
    def __init__(self, task_service, graph_service, template_registry):
        self.task_service = task_service
        self.graph_service = graph_service
        self.template_registry = template_registry
        self.template_rule_cache = {}  # Cache by template_id
        self.template_execution_stats = {}  # Stats by template_id
        
    async def evaluate_template_rule(self, 
                                   rule: TemplateAutomationRule, 
                                   event: TemplateAwareVesperaEvent,
                                   template: Template) -> bool:
        """Evaluate if a template rule should trigger for an event."""
        template_context = {
            'event': event,
            'template': template,
            'codex_instance': await self.get_template_instance_context(event.codex_ids[0]),
            'template_field_values': event.template_context.field_values,
            'linked_templates': await self.get_linked_template_instances(event.codex_ids[0]),
            'user': await self.get_user_context(event.user_id)
        }
        
        # Check template-defined trigger conditions
        if not await self._check_template_trigger_match(rule.trigger, event, template):
            return False
            
        # Evaluate template-specific conditions
        if rule.condition:
            if not await self._evaluate_template_condition(rule.condition, template_context):
                return False
                
        return True
    
    async def execute_template_rule(self, 
                                  rule: TemplateAutomationRule, 
                                  event: TemplateAwareVesperaEvent,
                                  template: Template) -> TemplateRuleExecutionResult:
        """Execute template automation rule actions."""
        start_time = time.time()
        results = []
        template_context = await self.build_template_execution_context(rule, event, template)
        
        try:
            # Execute template-defined action
            result = await self._execute_template_action(
                rule.action, 
                rule.params or {}, 
                template_context
            )
            results.append(result)
            
            execution_time = time.time() - start_time
            
            # Record template-specific execution statistics
            self._record_template_execution_stats(
                template.template_id, 
                rule.trigger + ':' + rule.action,
                execution_time, 
                success=True
            )
            
            return TemplateRuleExecutionResult(
                success=True,
                template_id=template.template_id,
                rule_description=f"{rule.trigger} → {rule.action}",
                action_results=results,
                execution_time=execution_time,
                template_context=template_context
            )
            
        except Exception as e:
            self._record_execution_stats(rule.name, time.time() - start_time, success=False)
            
            return RuleExecutionResult(
                success=False,
                rule_name=rule.name,
                error=str(e),
                execution_time=time.time() - start_time
            )
```

### Template-Aware Loop Prevention and Safety

```python
class TemplateAutomationSafetyManager:
    """Prevents infinite loops and manages template automation safety."""
    
    def __init__(self, template_registry: TemplateRegistry):
        self.template_registry = template_registry
        self.template_execution_history = deque(maxlen=1000)
        self.template_rate_limits = {}  # Rate limits per template_id
        self.template_circuit_breakers = {}  # Circuit breakers per template_id
        
    async def check_template_safety(self, 
                                  rule: TemplateAutomationRule, 
                                  event: TemplateAwareVesperaEvent,
                                  template: Template) -> TemplateSafetyCheck:
        """Check if template rule execution is safe."""
        template_rule_key = f"{template.template_id}:{rule.trigger}:{rule.action}"
        
        # Check for potential template automation loops
        if self._detect_template_loop(template_rule_key, event):
            return TemplateSafetyCheck(
                safe=False, 
                reason=f"Potential infinite loop detected in template {template.name}",
                template_id=template.template_id
            )
        
        # Check template-specific rate limits
        if self._check_template_rate_limit(template_rule_key):
            return TemplateSafetyCheck(
                safe=False,
                reason=f"Rate limit exceeded for template rule {template_rule_key}",
                template_id=template.template_id
            )
        
        # Check template circuit breaker
        if self._check_template_circuit_breaker(template.template_id):
            return TemplateSafetyCheck(
                safe=False,
                reason=f"Circuit breaker open for template {template.name}",
                template_id=template.template_id
            )
        
        # Check cross-template chain depth
        if await self._check_cross_template_chain_depth(event) > 10:
            return TemplateSafetyCheck(
                safe=False,
                reason="Cross-template automation chain too deep (>10 levels)",
                template_id=template.template_id
            )
        
        return TemplateSafetyCheck(safe=True, template_id=template.template_id)
    
    def _detect_template_loop(self, 
                            template_rule_key: str, 
                            event: TemplateAwareVesperaEvent) -> bool:
        """Detect potential infinite loops in template automation chains."""
        recent_executions = [
            entry for entry in self.template_execution_history
            if entry.timestamp > datetime.now() - timedelta(minutes=1)
        ]
        
        # Check for rapid repetition of same template rule on same codex instance
        same_template_rule_same_instance = [
            entry for entry in recent_executions
            if entry.template_rule_key == template_rule_key and
               set(entry.codex_ids) & set(event.codex_ids)
        ]
        
        # Flag if more than 5 executions in 1 minute for same template rule
        if len(same_template_rule_same_instance) > 5:
            return True
        
        # Check for cross-template loops (A triggers B which triggers A)
        cross_template_pattern = self._detect_cross_template_ping_pong(
            event.template_id, 
            event.codex_ids[0], 
            recent_executions
        )
        
        return cross_template_pattern
```

## 🎮 Template-Aware User Control and Debugging

### Template Automation Dashboard

```python
class TemplateAutomationDashboard:
    """Provides monitoring and control interface for template automation."""
    
    def __init__(self, template_registry: TemplateRegistry):
        self.template_registry = template_registry
    
    async def get_template_automation_status(self) -> Dict[str, Any]:
        """Get current template automation system status."""
        active_templates = await self.template_registry.get_all_templates()
        
        template_stats = {}
        for template in active_templates:
            template_stats[template.template_id] = {
                'name': template.name,
                'automation_rules_count': len(template.automation_rules),
                'active_instances': await self.count_template_instances(template.template_id),
                'automations_triggered_today': await self.get_template_events_count(template.template_id, days=1)
            }
        
        return {
            'total_templates': len(active_templates),
            'templates_with_automation': len([t for t in active_templates if t.automation_rules]),
            'template_events_processed_today': await self.get_total_template_events_count(days=1),
            'cross_template_chains_running': len(await self.get_active_cross_template_chains()),
            'template_safety_incidents': await self.get_template_safety_incidents(),
            'template_performance_metrics': await self.get_template_performance_metrics(),
            'template_details': template_stats
        }
    
    async def get_template_execution_history(self, 
                                           template_id: str = None,
                                           limit: int = 100) -> List[TemplateRuleExecution]:
        """Get recent template rule executions for debugging."""
        if template_id:
            return await self.template_execution_logger.get_template_executions(template_id, limit)
        else:
            return await self.template_execution_logger.get_recent_executions(limit)
    
    async def disable_template_automation(self, 
                                        template_id: str, 
                                        rule_index: int = None,
                                        reason: str = None) -> bool:
        """Disable automation for a specific template or rule."""
        template = await self.template_registry.get_template(template_id)
        
        if rule_index is not None:
            # Disable specific rule within template
            if 0 <= rule_index < len(template.automation_rules):
                template.automation_rules[rule_index].enabled = False
                await self.template_registry.update_template(template)
                await self.audit_logger.log_template_rule_disabled(
                    template_id, rule_index, reason or "User requested"
                )
                return True
        else:
            # Disable all automation for template
            for rule in template.automation_rules:
                rule.enabled = False
            await self.template_registry.update_template(template)
            await self.audit_logger.log_template_automation_disabled(
                template_id, reason or "User requested"
            )
            return True
        
        return False
    
    async def get_template_automation_metrics(self, template_id: str) -> Dict[str, Any]:
        """Get detailed automation metrics for a specific template."""
        template = await self.template_registry.get_template(template_id)
        
        return {
            'template_name': template.name,
            'total_rules': len(template.automation_rules),
            'active_rules': len([r for r in template.automation_rules if r.enabled]),
            'executions_last_hour': await self.get_template_executions_count(template_id, hours=1),
            'executions_last_day': await self.get_template_executions_count(template_id, days=1),
            'average_execution_time': await self.get_template_avg_execution_time(template_id),
            'success_rate': await self.get_template_success_rate(template_id),
            'most_triggered_rule': await self.get_most_triggered_template_rule(template_id),
            'linked_template_types': await self.get_linked_template_types(template_id),
            'safety_incidents': await self.get_template_safety_incidents(template_id)
        }
```

### Template Automation Override System

```python
class TemplateAutomationOverrideManager:
    """Allows users to override or customize template automation behavior."""
    
    def __init__(self, template_registry: TemplateRegistry):
        self.template_registry = template_registry
    
    async def create_template_override(self, 
                                     user_id: str, 
                                     template_id: str,
                                     rule_index: int,
                                     override_type: TemplateOverrideType, 
                                     parameters: Dict[str, Any]) -> str:
        """Create a user-specific template automation override."""
        template = await self.template_registry.get_template(template_id)
        
        override = TemplateAutomationOverride(
            id=generate_id(),
            user_id=user_id,
            template_id=template_id,
            template_name=template.name,
            rule_index=rule_index,
            original_rule=template.automation_rules[rule_index],
            override_type=override_type,
            parameters=parameters,
            created_at=datetime.now()
        )
        
        await self.template_override_repository.save(override)
        return override.id
    
    async def apply_template_overrides(self, 
                                     rule: TemplateAutomationRule,
                                     template_id: str,
                                     rule_index: int,
                                     user_id: str, 
                                     event: TemplateAwareVesperaEvent) -> TemplateAutomationRule:
        """Apply user overrides to a template rule before execution."""
        overrides = await self.template_override_repository.get_by_user_and_template_rule(
            user_id, template_id, rule_index
        )
        
        modified_rule = rule.copy()
        
        for override in overrides:
            if override.override_type == TemplateOverrideType.DISABLE:
                modified_rule.enabled = False
            elif override.override_type == TemplateOverrideType.MODIFY_CONDITION:
                # Modify the template rule condition
                modified_rule.condition = override.parameters.get('new_condition', modified_rule.condition)
            elif override.override_type == TemplateOverrideType.CHANGE_ACTION:
                # Replace template action
                modified_rule.action = override.parameters['new_action']
                modified_rule.params = override.parameters.get('new_params', modified_rule.params)
            elif override.override_type == TemplateOverrideType.ADD_CONDITION:
                # Add additional condition to template rule
                if modified_rule.condition:
                    modified_rule.condition = f"({modified_rule.condition}) AND ({override.parameters['additional_condition']})"
                else:
                    modified_rule.condition = override.parameters['additional_condition']
            elif override.override_type == TemplateOverrideType.MODIFY_PARAMS:
                # Modify rule parameters
                if modified_rule.params:
                    modified_rule.params.update(override.parameters.get('param_overrides', {}))
                else:
                    modified_rule.params = override.parameters.get('param_overrides', {})
        
        return modified_rule
```

## 🚀 Getting Started with Template-Driven Automation

### Basic Setup

1. **Install Dependencies**:

   ```bash
   cd packages/vespera-scriptorium
   pip install -r requirements-automation.txt
   ```

2. **Initialize Template-Aware Automation Engine**:

   ```python
   from automation.template_engine import TemplateAutomationEngine
   from events.bus import EventBus
   from templates.registry import TemplateRegistry
   
   event_bus = EventBus()
   template_registry = TemplateRegistry()
   automation_engine = TemplateAutomationEngine(event_bus, template_registry)
   
   # Load templates first
   await template_registry.load_all_templates()
   
   # Start template-aware automation
   await automation_engine.start()
   ```

3. **Create Your First Template with Automation**:

   ```json5
   // urgent_task.json5 template
   {
     "template_id": "urgent_task_v1",
     "name": "Urgent Task",
     "field_schema": {
       "priority": {
         "type": "select",
         "options": ["low", "normal", "high", "urgent"]
       },
       "urgency_tag": {
         "type": "select",
         "options": ["normal", "urgent", "critical"]
       }
     },
     "automation_rules": [
       {
         "trigger": "field_changed",
         "field": "urgency_tag",
         "condition": "new_value == 'urgent'",
         "action": "update_field",
         "params": {
           "field_name": "priority",
           "new_value": "high"
         }
       }
     ]
   }
   ```

4. **Use Template Automation**:

   ```python
   # Create instance of template
   urgent_task = await automation_engine.create_template_instance(
       "urgent_task_v1",
       {
         "task_title": "Fix critical bug",
         "priority": "normal",
         "urgency_tag": "normal"
       }
   )
   
   # Trigger automation by changing field
   await automation_engine.update_template_field(
       urgent_task.codex_id,
       "urgency_tag", 
       "urgent"  # This will automatically set priority to "high"
   )
   ```

### Template Integration Examples

**Music Integration** - User creates custom templates with integrated automation:

```json5
// fantasy_scene.json5 - User-defined template
{
  "template_id": "fantasy_scene_v1",
  "name": "Fantasy Scene",
  "field_schema": {
    "mood": {
      "type": "select",
      "options": ["peaceful", "tense", "mysterious", "epic"]
    },
    "linked_music": {
      "type": "codex_reference",
      "filter": {"template_id": ["ambient_music_v1"]}
    }
  },
  "automation_rules": [
    {
      "trigger": "field_changed",
      "field": "mood",
      "action": "update_linked_templates",
      "params": {
        "target_template_type": "ambient_music_v1",
        "link_field": "linked_music",
        "field_mappings": {
          "peaceful": {"track_type": "nature", "intensity": "low"},
          "tense": {"track_type": "battle", "intensity": "high"},
          "mysterious": {"track_type": "ambient", "intensity": "medium"},
          "epic": {"track_type": "orchestral", "intensity": "high"}
        },
        "transition_params": {
          "fade_duration": "3s",
          "crossfade": true
        }
      }
    },
    {
      "trigger": "created",
      "condition": "linked_music == null",
      "action": "create_template_instance",
      "params": {
        "template_type": "ambient_music_v1",
        "instance_data": {
          "music_title": "{{scene_title}} Soundtrack",
          "track_type": "{{mood_to_track_type(mood)}}",
          "linked_scene": "{{codex_id}}"
        },
        "link_back": {
          "field": "linked_music",
          "value": "{{created_instance.codex_id}}"
        }
      }
    }
  ]
}
```

**Character Development Tracking** - User-defined template ecosystem:

```json5
// character_development_task.json5
{
  "template_id": "character_dev_task_v1",
  "name": "Character Development Task",
  "extends": "base_task_v1",
  "field_schema": {
    "target_character": {
      "type": "codex_reference",
      "filter": {"template_id": ["fantasy_character_v1"]},
      "required": true
    },
    "development_type": {
      "type": "select",
      "options": ["personality_growth", "skill_development", "relationship_change", "backstory_revelation"]
    },
    "development_notes": {
      "type": "rich_text"
    }
  },
  "automation_rules": [
    {
      "trigger": "field_changed",
      "field": "task_status",
      "condition": "new_value == 'completed'",
      "action": "update_linked_templates",
      "params": {
        "target_template_type": "fantasy_character_v1",
        "link_field": "target_character",
        "update_strategy": "append_to_field",
        "updates": {
          "development_history": "{{development_notes}}",
          "character_arc_progress": "{{increment_progress()}}",
          "last_development_date": "{{current_date()}}"
        }
      }
    },
    {
      "trigger": "field_changed", 
      "field": "task_status",
      "condition": "new_value == 'completed' AND development_type == 'relationship_change'",
      "action": "trigger_template_workflow",
      "params": {
        "workflow_name": "update_character_relationships",
        "workflow_params": {
          "character_id": "{{target_character}}",
          "relationship_changes": "{{development_notes}}"
        }
      }
    }
  ]
}
```

## 📊 Template Automation Performance and Monitoring

### Template Metrics Collection

The system automatically collects template-aware performance metrics:

- **Template rule execution times**: Track automation performance per template type
- **Cross-template event processing**: Monitor template chain throughput
- **Template usage patterns**: Optimize template automation suggestions
- **Template relationship analysis**: Improve cross-template automation effectiveness
- **Template safety incident tracking**: Ensure reliable template automation operation
- **Template instance lifecycle metrics**: Track creation, updates, and automation triggers
- **User template customization patterns**: Guide template design improvements

### Template Automation Debugging Tools

```python
# Enable debug mode for template automation
await template_automation_engine.set_debug_mode(True)

# Monitor specific template automation
await template_automation_engine.add_template_monitor(
    "fantasy_scene_v1", 
    rule_index=0,  # Monitor first automation rule
    callback=template_debug_callback
)

# Trace cross-template automation chains
chain_trace = await template_automation_engine.trace_template_chain_execution(
    initial_template_id="fantasy_scene_v1",
    initial_codex_id="codex_123"
)

# Debug template field changes and automation triggers
field_debug = await template_automation_engine.debug_template_field_change(
    template_id="fantasy_scene_v1",
    field_name="mood",
    old_value="peaceful",
    new_value="tense"
)

# View template automation execution history
execution_log = await template_automation_engine.get_template_execution_log(
    template_id="fantasy_scene_v1",
    time_range="last_hour"
)
```

## 🔮 Template Automation Future Enhancements

1. **AI-Powered Template Intelligence**:
   - Learn user template usage patterns for smarter automation suggestions
   - Predict optimal cross-template relationships based on content analysis
   - Adaptive template rule generation based on user behavior
   - LLM-powered template optimization recommendations

2. **Advanced Template Analysis**:
   - Template field sentiment analysis for emotion-based automation
   - Cross-template dependency analysis and optimization
   - Template performance profiling and bottleneck detection
   - Template usage analytics and improvement suggestions

3. **Collaborative Template Ecosystem**:
   - Community template marketplace with ratings and reviews
   - Team-based template library management
   - Real-time collaborative template editing and testing
   - Template version control and branching
   - Shared template automation debugging tools

4. **Extended Template Integrations**:
   - External API integration templates (Spotify, YouTube, notion, etc.)
   - AI service integration templates (DALL-E, GPT, Claude)
   - Workflow automation templates (Zapier, IFTTT integration)
   - File system and external tool integration templates
   - Template-driven plugin architecture for unlimited extensibility

5. **Template System Evolution**:
   - Visual template designer with drag-and-drop automation rules
   - Template testing framework with automated validation
   - Template migration tools for seamless updates
   - Template inheritance optimization and circular dependency detection
   - Template-aware performance monitoring and scaling

---

## Conclusion: Template-Driven Automation Revolution

The **Template-Driven Dynamic Automation Architecture** represents a fundamental paradigm shift from hardcoded automation systems to user-extensible, template-defined automation ecosystems. By embedding automation rules directly within user-customizable templates, the Vespera Codex system becomes infinitely adaptable to any workflow, domain, or creative process.

### Key Architectural Innovations:

1. **User-Defined Automation**: Templates contain their own automation rules, eliminating hardcoded system behavior
2. **Cross-Template Intelligence**: Automation chains work seamlessly across different user-defined template types
3. **Template-Aware Safety**: Loop prevention and rate limiting understand template relationships and inheritance
4. **Dynamic Event System**: Events are generated based on template field schemas rather than fixed system types
5. **Inheritance-Powered Rules**: Template automation rules inherit and extend like template fields themselves

### User Empowerment:

- **Complete Control**: Users define not just content structure, but also automation behavior
- **Infinite Customization**: Any workflow can be modeled through templates with embedded automation
- **Seamless Integration**: Templates work together through user-defined relationships and automation chains
- **Evolution-Ready**: Templates can be updated, extended, and shared without system modifications

**The Result**: A truly **user-extensible automation platform** where creative professionals, researchers, developers, and knowledge workers can create complete workflow ecosystems that include both content organization and intelligent automation behavior - all through simple, shareable JSON5 template files.

This template-driven approach transforms the Vespera Codex from a smart content management system into a **universal workflow intelligence platform** that grows and adapts to meet any user's unique creative and organizational needs.
