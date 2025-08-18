---
trigger: model_decision
description: "Apply when selecting appropriate MCP tools for A2A messaging tasks"
---

# MCP Tools Best Practices

## File Operations with Desktop Commander

### Handling Large Files

When using `write_file` to create or modify files:

1. **Check Line Count**:
   - Be aware of the 50-line limit per `write_file` call
   - For files larger than 50 lines, split content into chunks

2. **Multi-Chunk Writing Pattern**:

   ```javascript
   // First chunk (create/overwrite file)
   write_file(path, firstChunk, {mode: 'rewrite'});
   
   // Additional chunks (append to existing file)
   write_file(path, secondChunk, {mode: 'append'});
   write_file(path, thirdChunk, {mode: 'append'});
   ```

3. **Content Organization**:
   - Split content at logical boundaries (sections, paragraphs)
   - Keep related content together in the same chunk when possible
   - Ensure proper formatting at chunk boundaries

## Tool Selection for A2A Messaging

1. **Development Tasks**:
   - Use NATS tools for message testing
   - Use Memory tools for architecture tracking
   - Use GitHub tools for code research

2. **Documentation Tasks**:
   - Use Brave Search for research
   - Use Context7 for official documentation
   - Use Puppeteer for visual documentation

3. **Testing Tasks**:
   - Use Playwright for web interface testing
   - Use Desktop Commander for file operations
   - Use Windows CLI for system-level operations

## Performance Considerations

1. **Minimize Tool Calls**:
   - Batch operations when possible
   - Cache results for repeated lookups
   - Use the most efficient tool for each task

2. **Resource Management**:
   - Close browser sessions when finished
   - Terminate long-running processes
   - Clean up temporary files

## Last Updated: 2025-05-25
