# Getting Started with Vespera Codex Automation

This guide will help you get started with the Dynamic Automation and Tag-Driven Systems in the Vespera Codex. You'll learn how to set up automation rules, create reactive content workflows, and leverage the power of intelligent content ecosystems.

## 🚀 Quick Start

### Prerequisites

- Vespera Scriptorium V2 installed and running
- Basic understanding of tags and content organization
- Access to the Obsidian plugin (optional but recommended)

### Initial Setup

1. **Enable Automation Engine**:
   ```bash
   cd packages/vespera-scriptorium
   ./mcp_venv/bin/python -m automation.setup --enable
   ```

2. **Create Your First Automation Rule**:
   ```python
   from automation.engine import AutomationEngine
   
   engine = AutomationEngine()
   
   # Create a simple rule using natural language
   rule = await engine.create_rule_from_description(
       "When I add the tag #urgent to any task, set its priority to high"
   )
   
   print(f"Created rule: {rule.name}")
   ```

3. **Test the Automation**:
   - Create a task in your Vespera Codex
   - Add the tag `#urgent` to the task
   - Watch as the priority automatically changes to "high"

## 🏷️ Understanding Tags and Automation

### Tag Patterns

Tags are the foundation of automation in Vespera Codex. The system recognizes several tag patterns:

| Pattern | Example | Description |
|---------|---------|-------------|
| `#status:value` | `#status:complete` | Status-based tags |
| `#mood:value` | `#mood:tense` | Emotional/atmospheric tags |
| `#type:value` | `#type:character` | Content type classification |
| `#priority:value` | `#priority:urgent` | Priority indicators |
| Simple tags | `#review`, `#final` | Basic categorization |

### How Automation Works

1. **Tag Change Detection**: System monitors all tag modifications
2. **Rule Matching**: Finds automation rules that match the changed tags  
3. **Context Analysis**: Analyzes related content and relationships
4. **Action Execution**: Performs automated actions (update content, create tasks, etc.)
5. **Feedback Display**: Shows users what happened and why

## 🎵 Creating Your First Music Integration

Let's create a dynamic music system that changes based on scene moods:

### Step 1: Set Up Content Structure

```yaml
# Create a scene codex entry
title: "Forest Encounter"
type: "scene" 
tags: ["#mood:peaceful", "#location:forest"]
description: "A quiet moment in the ancient woods..."
```

```yaml
# Create music codex entries
title: "Forest Ambience"
type: "music"
tags: ["#mood:peaceful", "#atmosphere:natural"]
file_path: "/music/forest-sounds.mp3"
```

```yaml
title: "Battle Drums" 
type: "music"
tags: ["#mood:tense", "#atmosphere:combat"]
file_path: "/music/battle-drums.mp3"
```

### Step 2: Create the Automation Rule

You can create this rule in several ways:

**Option A: Natural Language (Recommended)**
```python
rule = await engine.create_rule_from_description(
    "When the mood of a scene changes, update the linked music to match"
)
```

**Option B: YAML Configuration**
```yaml
# Save as ~/.vespera/automation/rules/scene-music.yaml
name: "Scene Music Integration"
enabled: true

trigger:
  type: "tag_changed"
  codex_type: "scene"
  tag_patterns: ["#mood:*"]

conditions:
  - scene_has_linked_music: true

actions:
  - type: "update_linked_music"
    selection_criteria:
      mood_match: "${trigger.new_tag_value}"
    transition: "fade"
    duration: "2s"

  - type: "show_notification"
    message: "🎵 Music updated to ${selected_music.title}"
```

### Step 3: Link Content

```python
# Link the scene to music entries
await content_manager.create_relationship(
    source_id="scene_forest_encounter",
    target_id="music_forest_ambience", 
    relationship_type="uses_music"
)

await content_manager.create_relationship(
    source_id="scene_forest_encounter",
    target_id="music_battle_drums",
    relationship_type="alternate_music"
)
```

### Step 4: Test the Magic

1. Change the scene's mood tag: `#mood:peaceful` → `#mood:tense`
2. Watch as the music automatically changes from "Forest Ambience" to "Battle Drums"
3. See the notification confirming the change

## ✍️ Character Development Automation

Create automation that tracks character growth and updates relationships:

### Step 1: Set Up Character Structure

```yaml
# Character codex entry
title: "Alice Brightblade"
type: "character"
tags: ["#protagonist", "#development:growing"]
personality_traits: ["brave", "impulsive", "kind"]
character_arc: "learning_patience"
```

### Step 2: Create Development Tracking Rule

```python
rule = await engine.create_rule_from_description(
    "When I complete character development tasks, update their relationship maps and suggest follow-up scenes"
)
```

### Step 3: Create Development Tasks

```python
task = await task_manager.create_task(
    title="Alice learns patience in marketplace scene",
    description="Show Alice holding back from confronting rude merchant",
    tags=["#character-development", "#character:alice"],
    metadata={
        "character_id": "alice_brightblade",
        "development_aspect": "patience",
        "personality_change": "less_impulsive"
    }
)
```

### Step 4: Complete Task and Watch Automation

When you mark the task as complete:

1. **Character Profile Updates**: Alice's traits automatically update
2. **Relationship Analysis**: System analyzes how this affects her relationships
3. **Scene Suggestions**: Creates tasks for scenes showing her new patience
4. **Plot Implications**: Updates story timeline with character growth

## 🔗 Cross-Codex Automation Chains

Create complex workflows that span multiple content types:

### Example: Scene Completion Workflow

```python
workflow = await engine.create_automation_chain([
    {
        "name": "Analyze Scene Impact",
        "trigger": {"type": "tag_changed", "tag": "#status:complete"},
        "actions": ["analyze_plot_implications", "identify_affected_characters"]
    },
    {
        "name": "Update Character States", 
        "depends_on": ["Analyze Scene Impact"],
        "actions": ["update_character_progression", "log_character_appearances"]
    },
    {
        "name": "Generate Review Tasks",
        "depends_on": ["Update Character States"],
        "actions": ["create_character_review_tasks", "suggest_consistency_checks"]
    },
    {
        "name": "Update Story Timeline",
        "depends_on": ["Analyze Scene Impact"],
        "actions": ["advance_plot_markers", "update_story_pacing"]
    }
])
```

## 🛠️ Customizing Automation Rules

### Rule Conditions

Add conditions to make rules more specific:

```yaml
conditions:
  - user_preference: "auto_music_enabled"
  - time_of_day: "not_late_night"  
  - content_type: "scene"
  - has_linked_content: "music"
  - tag_count: "> 3"
```

### Action Types

Available automation actions:

| Action | Purpose | Example |
|--------|---------|---------|
| `update_linked_codex` | Modify related content | Change linked music |
| `create_task` | Generate new tasks | Create review tasks |
| `send_notification` | Alert users | Show status updates |
| `update_relationship` | Modify connections | Link characters to scenes |
| `analyze_content` | AI analysis | Sentiment analysis |
| `execute_script` | Custom automation | Run user scripts |

### Custom Variables

Use variables in your automation rules:

```yaml
actions:
  - type: "create_task"
    title: "Review ${character.name} in ${scene.title}"
    description: "Character development: ${development_summary}"
    due_date: "${now + 3 days}"
    assignee: "${scene.author}"
```

## 🎮 User Interface Integration

### Obsidian Plugin Features

If using the Obsidian plugin:

1. **Live Automation Feedback**: See automation notifications in real-time
2. **Rule Management Panel**: Enable/disable rules, view execution history
3. **Content Relationship Graph**: Visualize automated connections
4. **Automation Dashboard**: Monitor system performance and rule effectiveness

### Visual Indicators

The system provides visual feedback:

- **🤖 Automation Icons**: Show when content was modified by automation
- **🔗 Relationship Lines**: Highlight automated connections
- **📈 Progress Bars**: Track automation chain completion
- **⚠️ Alert Badges**: Indicate automation conflicts or failures

## 🔍 Debugging and Troubleshooting

### Common Issues

**Automation Not Triggering**:
```python
# Check rule status
rules = await engine.get_active_rules()
for rule in rules:
    print(f"{rule.name}: {'enabled' if rule.enabled else 'disabled'}")

# Check event history
events = await engine.get_recent_events(limit=10)
for event in events:
    print(f"{event.type}: {event.payload}")
```

**Performance Issues**:
```python
# Check automation metrics
metrics = await engine.get_performance_metrics()
print(f"Average rule execution time: {metrics['avg_execution_time']}")
print(f"Events processed per minute: {metrics['events_per_minute']}")
```

**Rule Conflicts**:
```python
# Analyze rule interactions
conflicts = await engine.analyze_rule_conflicts()
for conflict in conflicts:
    print(f"Rules '{conflict.rule1}' and '{conflict.rule2}' may conflict")
```

### Debug Mode

Enable detailed logging:

```python
await engine.set_debug_mode(True)

# Monitor specific rules
await engine.add_rule_monitor("Scene Music Integration", 
                              callback=print_debug_info)
```

## 📊 Advanced Features

### Machine Learning Integration

The system can learn from your patterns:

```python
# Enable pattern learning
await engine.enable_pattern_learning(True)

# The system will automatically suggest new rules based on your usage
suggestions = await engine.get_rule_suggestions()
for suggestion in suggestions:
    print(f"Suggested rule: {suggestion.description}")
    print(f"Confidence: {suggestion.confidence}")
```

### External Integrations

Connect with external services:

```yaml
# Spotify integration example
name: "Spotify Playlist Sync"
trigger:
  type: "tag_changed"
  tag_patterns: ["#playlist:*"]

actions:
  - type: "external_api_call"
    service: "spotify"
    action: "create_playlist"
    parameters:
      name: "${codex.title} - ${tag_value}"
      tracks: "${related_music_codex.spotify_tracks}"
```

### Collaboration Features

Share automation rules with your team:

```python
# Export rules
await engine.export_rules("/shared/automation/team-rules.yaml")

# Import shared rules  
await engine.import_rules("/shared/automation/team-rules.yaml")

# Sync with team repository
await engine.sync_with_repository("https://github.com/team/vespera-rules")
```

## 🎯 Best Practices

### Rule Design

1. **Start Simple**: Begin with basic tag-based rules
2. **Test Thoroughly**: Always test rules with sample content
3. **Use Descriptive Names**: Make rule purposes clear
4. **Add Conditions**: Prevent unwanted automation triggers
5. **Monitor Performance**: Check rule execution times regularly

### Content Organization

1. **Consistent Tagging**: Use standardized tag patterns
2. **Meaningful Relationships**: Link related content explicitly  
3. **Clear Hierarchies**: Organize content in logical structures
4. **Regular Cleanup**: Remove unused tags and outdated content

### Automation Management

1. **Document Rules**: Explain complex automation logic
2. **Version Control**: Track rule changes over time
3. **User Training**: Ensure team understands automation behavior
4. **Gradual Rollout**: Introduce new automation incrementally

## 🚀 Next Steps

Now that you understand the basics:

1. **Experiment**: Try different rule types and patterns
2. **Customize**: Adapt automation to your specific workflow
3. **Collaborate**: Share rules with your team or community  
4. **Extend**: Create custom actions using the API
5. **Optimize**: Monitor and improve rule performance

### Resources

- **Rule Examples**: Check `/docs/examples/AUTOMATION_RULE_EXAMPLES.md`
- **API Documentation**: See `/docs/technical/AUTOMATION_API.md`
- **Community Rules**: Visit the Vespera community repository
- **Support**: Join the Vespera Discord for help and tips

Welcome to the world of intelligent, reactive content creation with Vespera Codex automation! 🎉