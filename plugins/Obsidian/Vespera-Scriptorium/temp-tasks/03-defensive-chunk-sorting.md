# Task: Defensive Chunk Sorting & Assembly

**Goal:**
Fix the `localeCompare` bug and make chunk sorting robust against missing or malformed metadata.

## Proposed Code Edits

- **src/Chunker.ts**: Audit chunk metadata population; ensure all chunks have required fields for sorting.
- **src/Chunker.ts**: Add defensive checks before calling `localeCompare` (fallbacks, error logs if data is missing).
- **tests/Chunker.test.ts**: Add tests for chunk sorting with missing/invalid metadata.
- **src/Chunker.ts**: Log a warning and skip unsortable chunks (rather than crashing).

## Acceptance Criteria

- No crashes from missing metadata.
- Errors are logged; unsortable chunks are skipped.
- Unit tests verify robustness.

---

## Subtasks

- [ ] Audit chunk metadata population
- [ ] Add defensive checks for sorting
- [ ] Add/Update unit tests for sorting failures
- [ ] Enhance logging for sorting errors
