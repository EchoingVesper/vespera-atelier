# Automation Rule Examples

This document provides concrete examples of automation rules for different creative workflows, demonstrating the power and flexibility of the Vespera Codex Dynamic Automation system.

## 🎵 Music and Audio Automation

### Dynamic Scene Music

```yaml
name: "Dynamic Scene Music Integration"
description: "Automatically update background music based on scene mood and energy"
enabled: true

trigger:
  type: "tag_changed"
  codex_type: "scene"
  tag_patterns: 
    - "#mood:*"
    - "#energy:*" 
    - "#atmosphere:*"

conditions:
  - codex_has_linked_music: true
  - user_setting: "auto_music_enabled"

actions:
  - type: "query_music_library"
    criteria:
      mood: "${trigger.tag_value('mood')}"
      energy: "${trigger.tag_value('energy')}"
      atmosphere: "${trigger.tag_value('atmosphere')}"
    limit: 3
    store_as: "candidate_tracks"

  - type: "select_best_match"
    candidates: "${context.candidate_tracks}"
    selection_algorithm: "weighted_preference"
    store_as: "selected_track"

  - type: "update_linked_codex"
    target_type: "music"
    changes:
      current_track: "${context.selected_track.id}"
      track_title: "${context.selected_track.title}"
      fade_duration: "2.5s"
      auto_loop: true

  - type: "emit_event"
    event_type: "music_changed"
    payload:
      scene_id: "${trigger.codex_id}"
      old_track: "${context.previous_track}"
      new_track: "${context.selected_track}"
      change_reason: "scene_mood_update"

feedback:
  show_notification: true
  message: "🎵 Music updated to match ${trigger.tag_value('mood')} mood"
  duration: 3000
```

### Character Theme Music

```yaml
name: "Character Theme Music"
description: "Play character-specific music when character appears or is focused"
enabled: true

trigger:
  type: "tag_changed"
  codex_type: "character" 
  tag_patterns:
    - "#focus:active"
    - "#screen_time:current"

conditions:
  - character_has_theme_music: true
  - scene_music_allows_override: true

actions:
  - type: "get_character_theme"
    character_id: "${trigger.codex_id}"
    fallback: "generic_character_theme"
    store_as: "theme_track"

  - type: "create_music_transition"
    from: "${context.current_scene_music}"
    to: "${context.theme_track}"
    transition_type: "crossfade"
    duration: "1.5s"

  - type: "schedule_revert_music"
    delay: "30s"
    condition: "character_no_longer_active"
    revert_to: "${context.original_scene_music}"
```

## ✍️ Writing and Character Development

### Character Development Tracking

```yaml
name: "Character Development Tracker" 
description: "Track character growth and update relationship maps"
enabled: true

trigger:
  type: "task_completed"
  task_tags: 
    - "#character-development"
    - "#personality-change"
    - "#character-arc"

conditions:
  - task_has_character_reference: true

actions:
  - type: "extract_character_info"
    from_task: "${trigger.task_id}"
    fields: ["character_id", "development_type", "changes"]
    store_as: "character_update"

  - type: "update_character_codex"
    character_id: "${context.character_update.character_id}"
    updates:
      development_log: 
        - timestamp: "${now}"
          task_id: "${trigger.task_id}"
          changes: "${context.character_update.changes}"
          type: "${context.character_update.development_type}"
      
      personality_version: "${increment(current_version)}"
      last_development: "${now}"

  - type: "analyze_relationship_impact"
    character_id: "${context.character_update.character_id}"
    development_changes: "${context.character_update.changes}"
    store_as: "relationship_analysis"

  - type: "update_relationship_maps"
    character_id: "${context.character_update.character_id}"
    relationship_changes: "${context.relationship_analysis.changes}"

  - type: "create_follow_up_tasks"
    if: "${context.relationship_analysis.requires_follow_up}"
    tasks:
      - title: "Review ${character_name} relationships after development"
        description: "Check how character changes affect other characters"
        tags: ["#character-review", "#relationships"]
        priority: "normal"
        due_in: "3 days"
```

### Scene Completion Workflow

```yaml
name: "Scene Completion Automation"
description: "Comprehensive automation when scene is marked complete"
enabled: true

trigger:
  type: "tag_changed"
  codex_type: "scene"
  tag: "#status:complete"

conditions:
  - scene_has_characters: true
  - user_preference: "auto_scene_processing"

actions:
  # Step 1: Analyze scene impact
  - type: "analyze_scene_impact"
    scene_id: "${trigger.codex_id}"
    analysis_types: 
      - "plot_advancement"
      - "character_development" 
      - "world_building"
      - "conflict_resolution"
    store_as: "scene_analysis"

  # Step 2: Update character progression
  - type: "query_scene_characters"
    scene_id: "${trigger.codex_id}"
    store_as: "scene_characters"

  - type: "update_character_progression"
    for_each: "${context.scene_characters}"
    character_id: "${item.id}"
    updates:
      scenes_completed: "${increment}"
      story_arc_progress: "${calculate_arc_progress}"
      last_appearance: "${trigger.timestamp}"

  # Step 3: Generate review tasks
  - type: "create_review_tasks"
    for_each: "${context.scene_characters}"
    task_template:
      title: "Review ${item.name} in scene: ${scene.title}"
      description: |
        Review character development and consistency for ${item.name}
        
        Scene: ${scene.title}
        Character arc progress: ${item.story_arc_progress}%
        Key developments: ${scene_analysis.character_impacts[item.id]}
        
        Questions to consider:
        - Was the character consistent with established personality?
        - Did they grow or change in meaningful ways?
        - How do their actions affect other characters?
      
      tags: 
        - "#character-review"
        - "#scene:${scene.slug}"
        - "#character:${item.slug}"
      priority: "normal"
      due_in: "1 week"

  # Step 4: Update story timeline
  - type: "update_story_timeline"
    scene_id: "${trigger.codex_id}"
    plot_advancement: "${context.scene_analysis.plot_advancement}"
    timeline_updates:
      - type: "scene_complete"
        scene_title: "${scene.title}"
        plot_points: "${context.scene_analysis.plot_points}"
        timestamp: "${trigger.timestamp}"

  # Step 5: Suggest next scenes
  - type: "analyze_story_flow"
    completed_scene: "${trigger.codex_id}"
    story_analysis: "${context.scene_analysis}"
    store_as: "flow_analysis"

  - type: "create_scene_suggestions"
    if: "${context.flow_analysis.suggests_next_scenes}"
    suggestions: "${context.flow_analysis.next_scene_ideas}"
    create_as: "planning_tasks"
```

## 🎨 Visual and Media Automation

### Image Organization by Mood

```yaml
name: "Image Mood Organization"
description: "Automatically organize images based on mood and content"
enabled: true

trigger:
  type: "content_updated"
  codex_type: "image"
  content_change: "image_uploaded"

actions:
  - type: "analyze_image_content"
    image_codex_id: "${trigger.codex_id}"
    analysis_types:
      - "mood_detection"
      - "color_palette"
      - "content_recognition" 
      - "artistic_style"
    store_as: "image_analysis"

  - type: "generate_tags"
    based_on: "${context.image_analysis}"
    tag_categories:
      mood: "${context.image_analysis.detected_moods}"
      colors: "${context.image_analysis.dominant_colors}"
      content: "${context.image_analysis.recognized_objects}"
      style: "${context.image_analysis.artistic_style}"

  - type: "update_codex_tags"
    codex_id: "${trigger.codex_id}"
    new_tags: "${context.generated_tags}"
    merge_strategy: "add_new"

  - type: "find_related_content"
    similarity_criteria:
      - "mood_similarity: 0.8"
      - "color_harmony: 0.6"
    content_types: ["scene", "character", "location"]
    store_as: "related_content"

  - type: "suggest_relationships"
    if: "${context.related_content.length > 0}"
    image_id: "${trigger.codex_id}"
    suggested_links: "${context.related_content}"
    create_notification: true
```

### Video Chapter Creation

```yaml
name: "Video Chapter Generation" 
description: "Automatically create video chapters based on content analysis"
enabled: true

trigger:
  type: "content_updated"
  codex_type: "video"
  content_change: "video_processed"

conditions:
  - video_length: "> 5 minutes"
  - user_setting: "auto_chapters_enabled"

actions:
  - type: "analyze_video_segments"
    video_codex_id: "${trigger.codex_id}"
    detection_methods:
      - "scene_changes"
      - "audio_level_changes"
      - "speaker_identification"
      - "content_topic_shifts"
    store_as: "video_segments"

  - type: "generate_chapter_titles"
    segments: "${context.video_segments}"
    title_generation: "ai_assisted"
    context_aware: true
    store_as: "chapter_titles"

  - type: "create_video_chapters"
    video_id: "${trigger.codex_id}"
    chapters: "${context.video_segments}"
    titles: "${context.chapter_titles}"
    
  - type: "update_video_codex"
    codex_id: "${trigger.codex_id}"
    updates:
      chapters: "${context.created_chapters}"
      chapter_count: "${context.created_chapters.length}"
      indexed_at: "${now}"
```

## 📋 Task and Project Management

### Deadline Management

```yaml
name: "Smart Deadline Management"
description: "Automatically adjust deadlines and priorities based on dependencies"
enabled: true

trigger:
  type: "task_completed"
  task_priority: ["high", "critical"]

conditions:
  - task_has_dependents: true

actions:
  - type: "query_dependent_tasks"
    completed_task_id: "${trigger.task_id}"
    store_as: "dependent_tasks"

  - type: "recalculate_deadlines"
    for_each: "${context.dependent_tasks}"
    task_id: "${item.id}"
    calculation_method: "critical_path"
    consider_factors:
      - "estimated_effort"
      - "available_resources"
      - "current_workload"
      - "external_dependencies"
    store_as: "updated_deadlines"

  - type: "update_task_priorities"
    deadline_changes: "${context.updated_deadlines}"
    priority_algorithm: "deadline_pressure"

  - type: "create_notifications"
    for_each: "${context.updated_deadlines}"
    if: "${item.deadline_moved_earlier}"
    notification:
      type: "deadline_update"
      task_id: "${item.task_id}"
      message: "Deadline moved up due to dependency completion"
      urgency: "medium"
```

### Workload Balancing

```yaml
name: "Automatic Workload Balancing"
description: "Distribute tasks based on current workload and capacity"
enabled: true

trigger:
  type: "task_created"
  task_tags: ["#auto-assign"]

conditions:
  - multiple_assignees_available: true
  - workload_tracking_enabled: true

actions:
  - type: "calculate_current_workloads"
    assignee_pool: "${project.team_members}"
    time_window: "current_sprint"
    store_as: "workload_analysis"

  - type: "match_task_to_assignee"
    task_requirements: 
      skills: "${trigger.task.required_skills}"
      estimated_effort: "${trigger.task.estimated_effort}"
      priority: "${trigger.task.priority}"
    
    assignee_criteria:
      workload_capacity: "> 20%"
      skill_match: "> 70%"
      availability: "next_3_days"
    
    selection_algorithm: "optimal_fit"
    store_as: "best_assignee"

  - type: "assign_task"
    task_id: "${trigger.task_id}"
    assignee: "${context.best_assignee.user_id}"
    
  - type: "create_assignment_notification"
    assignee: "${context.best_assignee.user_id}"
    task_details: "${trigger.task}"
    assignment_reason: "${context.best_assignee.selection_reason}"
```

## 🌐 Cross-System Integration

### External Tool Synchronization

```yaml
name: "External Tool Sync"
description: "Synchronize with external project management tools"
enabled: true

trigger:
  type: "task_status_changed"
  status_change: "todo -> doing"

conditions:
  - external_tools_configured: true
  - task_has_external_id: true

actions:
  - type: "sync_to_external_tools"
    for_each: "${config.external_integrations}"
    tool_name: "${item.name}"
    sync_action:
      type: "update_task_status"
      external_task_id: "${task.external_ids[item.name]}"
      new_status: "${item.status_mapping['doing']}"
      include_fields: 
        - "updated_at"
        - "assignee" 
        - "progress_notes"

  - type: "pull_external_updates"
    delay: "5 seconds"  # Allow external system to process
    external_task_ids: "${task.external_ids}"
    merge_strategy: "preserve_local_priority"
```

### Email and Communication Integration

```yaml
name: "Communication Triggers"
description: "Send notifications and updates based on content changes"  
enabled: true

trigger:
  type: "tag_changed"
  codex_type: "any"
  tag_patterns:
    - "#review-requested"
    - "#feedback-needed"
    - "#urgent"

conditions:
  - notification_settings: "enabled"
  - codex_has_collaborators: true

actions:
  - type: "identify_stakeholders"
    codex_id: "${trigger.codex_id}"
    stakeholder_types: 
      - "assigned_reviewers"
      - "content_watchers"  
      - "project_managers"
    store_as: "notification_recipients"

  - type: "compose_notification"
    template: "${trigger.tag}_notification"
    variables:
      codex_title: "${codex.title}"
      codex_type: "${codex.type}"
      requester: "${trigger.user}"
      deadline: "${codex.tags.deadline || 'ASAP'}"
      priority: "${codex.priority || 'normal'}"
    store_as: "notification_content"

  - type: "send_notifications"
    recipients: "${context.notification_recipients}"
    content: "${context.notification_content}"
    channels: ["email", "slack", "in_app"]
    delivery_preferences: "respect_user_settings"
```

## 🔧 System and Performance Automation

### Backup and Cleanup

```yaml
name: "Automated Backup and Cleanup"
description: "Regular maintenance and backup operations"
enabled: true

trigger:
  type: "scheduled"
  schedule: "daily at 2:00 AM"

conditions:
  - system_maintenance_window: true
  - backup_enabled: true

actions:
  - type: "create_incremental_backup" 
    backup_scope:
      - "codex_content"
      - "automation_rules"
      - "user_preferences"
      - "relationship_data"
    
    exclude:
      - "temp_files"
      - "cache_data"
      - "log_files"
    
    compression: "lz4"
    encryption: "aes256"
    
  - type: "cleanup_old_backups"
    retention_policy:
      daily_backups: "keep_7"
      weekly_backups: "keep_4" 
      monthly_backups: "keep_12"
      
  - type: "optimize_databases"
    databases: ["sqlite", "chroma", "kuzu"]
    operations:
      - "vacuum"
      - "reindex"
      - "analyze_statistics"
      
  - type: "clear_temporary_data"
    age_threshold: "7 days"
    data_types:
      - "image_thumbnails"
      - "video_previews"
      - "processed_audio"
      - "automation_logs"
```

### Performance Monitoring

```yaml
name: "Performance Alert System"
description: "Monitor system performance and alert on issues"
enabled: true

trigger:
  type: "metric_threshold"
  metrics:
    - "cpu_usage > 80%"
    - "memory_usage > 90%"
    - "automation_queue_size > 1000"
    - "event_processing_lag > 5s"

conditions:
  - alert_cooldown_expired: true
  - system_monitoring_enabled: true

actions:
  - type: "collect_diagnostic_info"
    include:
      - "system_resources"
      - "active_automations"  
      - "event_queue_status"
      - "database_performance"
    store_as: "diagnostics"

  - type: "attempt_auto_remediation"
    if: "${trigger.metric} == 'automation_queue_size'"
    actions:
      - "pause_low_priority_automations"
      - "increase_batch_processing"
      - "clear_stale_events"

  - type: "send_admin_alert"
    severity: "${calculate_severity(trigger.metric, trigger.value)}"
    alert_content:
      metric: "${trigger.metric}"
      current_value: "${trigger.value}"
      threshold: "${trigger.threshold}"
      diagnostics: "${context.diagnostics}"
      remediation_attempted: "${context.auto_remediation_result}"
```

These examples demonstrate the flexibility and power of the Vespera Codex automation system, showing how natural creative workflows can be enhanced with intelligent, context-aware automation that adapts to user needs and creative processes.