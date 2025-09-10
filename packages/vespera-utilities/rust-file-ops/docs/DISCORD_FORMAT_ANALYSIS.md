# Discord Chat Exporter HTML Format Analysis

## Key HTML Structure (from Tyrrrz/DiscordChatExporter)

### Message Container
```html
<div class="chatlog__message-group">
    <div id="chatlog__message-container-{messageId}" class="chatlog__message-container" data-message-id="{messageId}">
        <div class="chatlog__message">
            <!-- Message content -->
        </div>
    </div>
</div>
```

### Regular Message Structure
```html
<div class="chatlog__message-aside">
    <img class="chatlog__avatar" src="{avatarUrl}" alt="Avatar">
</div>
<div class="chatlog__message-primary">
    <div class="chatlog__header">
        <span class="chatlog__author" data-user-id="{userId}">{displayName}</span>
        <span class="chatlog__timestamp">{timestamp}</span>
    </div>
    <div class="chatlog__content chatlog__markdown">
        <span class="chatlog__markdown-preserve">{messageContent}</span>
    </div>
</div>
```

### System Messages
```html
<div class="chatlog__message-aside">
    <svg class="chatlog__system-notification-icon">
        <use href="#join-icon"></use>
    </svg>
</div>
<div class="chatlog__message-primary">
    <span class="chatlog__system-notification-author">{author}</span>
    <span class="chatlog__system-notification-content">{content}</span>
    <span class="chatlog__system-notification-timestamp">{timestamp}</span>
</div>
```

### Reply Structure
```html
<div class="chatlog__reply">
    <img class="chatlog__reply-avatar" src="{avatarUrl}">
    <div class="chatlog__reply-author">{author}</div>
    <div class="chatlog__reply-content">
        <span class="chatlog__reply-link" onclick="scrollToMessage(event, '{messageId}')">
            {replyContent}
        </span>
    </div>
</div>
```

## Key CSS Classes to Parse

- `.chatlog__message-group` - Groups of messages
- `.chatlog__message-container` - Individual message container
- `.chatlog__author` - Message author name
- `.chatlog__timestamp` - Message timestamp
- `.chatlog__content` - Message text content
- `.chatlog__attachment` - File attachments
- `.chatlog__embed` - Rich embeds (links, videos, etc.)
- `.chatlog__reaction` - Message reactions
- `.chatlog__reply` - Reply references
- `.chatlog__system-notification-content` - System messages (joins, pins, etc.)

## Data Attributes

- `data-message-id` - Unique message identifier
- `data-user-id` - User identifier
- `title` attribute on timestamps contains full date/time

## Parsing Strategy

1. **Message Extraction**:
   - Select all `.chatlog__message-container` elements
   - Extract message ID from `data-message-id`
   - Extract timestamp from `.chatlog__timestamp`
   - Extract author from `.chatlog__author`
   - Extract content from `.chatlog__content`

2. **Conversation Detection**:
   - Track timestamps to detect time gaps
   - Monitor author changes for conversation flow
   - Identify system messages that indicate topic changes
   - Group related replies and threads

3. **Metadata Preservation**:
   - Keep user IDs for participant tracking
   - Preserve reply chains
   - Track reactions and engagement
   - Note attachments and embeds

## Broader Document Support Strategy

### Phase 2a: Discord Focus
- Complete Discord HTML parser with exact format support
- Handle all message types (regular, system, reply, thread)
- Extract rich metadata (participants, timestamps, attachments)
- Smart conversation boundary detection

### Phase 2b: Generic Document Types
1. **PDF Documents**:
   - Use `pdf-extract` or similar crate
   - Preserve document structure (headings, paragraphs)
   - Extract tables and lists
   - Handle multi-column layouts

2. **Office Documents** (DOCX, ODT):
   - Parse XML structure
   - Extract styled text with formatting
   - Preserve document hierarchy
   - Handle embedded objects

3. **Markdown/Plain Text**:
   - Already partially supported
   - Enhance with header-based chunking
   - Preserve code blocks intact
   - Respect document structure

4. **Email Archives** (MBOX, EML):
   - Parse email headers
   - Extract conversation threads
   - Handle attachments
   - Group by subject/thread

5. **Academic Papers** (LaTeX, PDF):
   - Section-aware chunking
   - Preserve citations and references
   - Keep equations and figures intact
   - Extract abstract and conclusions

### Chunking Strategy Extensions

1. **Structure-Aware Chunking**:
   - Respect document hierarchy (chapters, sections, subsections)
   - Keep related content together (lists, tables)
   - Preserve context across boundaries

2. **Semantic Chunking**:
   - Use NLP for topic detection
   - Group semantically related paragraphs
   - Identify key concepts and entities
   - Create knowledge graphs

3. **Hybrid Strategies**:
   - Combine multiple strategies based on document type
   - User-configurable strategy selection
   - Adaptive chunking based on content analysis

4. **LLM Optimization**:
   - Token counting for precise context windows
   - Overlap strategies for context preservation
   - Metadata injection for enhanced understanding
   - Query-aware chunking (chunk differently based on search intent)