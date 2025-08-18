# Task: Implement Incremental Output File Naming

**Goal:**
Prevent summary overwrites by ensuring output files use an incremental naming scheme (e.g., filename_00.md, filename_01.md, ...).

## Proposed Code Edits

- **src/Writer.ts**: Refactor output writer to check for existing summary files and increment suffix accordingly.
- **src/Writer.ts**: Update file writing logic to always use the next available index.
- **tests/Writer.test.ts**: Add unit tests for file naming under various scenarios (existing summaries, concurrent runs).
- **src/Writer.ts & logs**: Update logs to record the actual output filename for each summary.

## Acceptance Criteria

- Output files never overwrite previous summaries.
- Naming follows the incremental pattern.
- Unit tests verify correct behavior.

---

## Subtasks

- [ ] Refactor output writer for incremental naming
- [ ] Add/Update unit tests for naming
- [ ] Enhance logging for output filenames
