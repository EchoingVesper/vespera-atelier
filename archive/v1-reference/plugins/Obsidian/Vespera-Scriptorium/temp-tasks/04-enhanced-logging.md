# Task: Enhanced Logging for Debuggability

**Goal:**
Improve logging to make future root cause analysis easier.

## Proposed Code Edits

- **src/Writer.ts, src/Chunker.ts**: Log every summary output filename (with index).
- **src/Chunker.ts**: Log per-chunk start, finish, and error (including timeout).
- **src/Chunker.ts**: Log configuration/settings used for each summarization run.
- **src/Logger.ts** (if present): Add log level controls if not already present.

## Acceptance Criteria

- Logs are detailed and actionable for debugging.
- All major events and errors are logged.

---

## Subtasks

- [ ] Add/Update logs for output filenames
- [ ] Add/Update logs for chunk lifecycle
- [ ] Log summarization config/settings
- [ ] Add log level controls (if needed)
