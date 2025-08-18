# Task: Implement Per-Chunk Timeout Enforcement

**Goal:**
Refactor the summarization pipeline so each chunk processed by the LLM has its own timeout, rather than a single timeout for the entire batch.

## Proposed Code Edits

- **src/Chunker.ts**: Refactor the chunk processing loop to wrap each LLM call in a per-chunk timeout using `Promise.race` or similar.
- **src/LLMClient.ts**: Ensure the LLM call interface accepts a timeout parameter per chunk.
- **src/Chunker.ts**: On timeout, log the failure, skip the chunk and add it to a redo queue, and continue processing others.
- **tests/Chunker.test.ts**: Add unit tests simulating slow LLM responses and verifying only the slow chunk fails.
- **src/Chunker.ts & logs**: Update logging to indicate per-chunk timeout events distinctly from batch failures.

## Test Failures & New Action Items (2025-05-01)

### Summary of Test Results
- **LLMProcessingService per-chunk timeout logic is robust and passes all new tests.**
- **Major failures in LLMClient, Writer, ProcessingOrchestrator, and PromptTemplateManager tests.**
- **Root causes:**
  - `src/providers` (with OllamaProvider, LMStudioProvider) is missing, breaking all LLMClient instantiations.
  - Writer tests fail due to incomplete Obsidian Vault API mocks (e.g., `createBinary`).
  - ProcessingOrchestrator/PromptTemplateManager tests fail due to assertion mismatches and logic drift.

### Updated Remediation Plan

#### 1. Restore/Stub LLM Providers
- [ ] Create `src/providers/index.ts` with minimal `OllamaProvider` and `LMStudioProvider` stubs (enough to unblock LLMClient tests).
- [ ] Refactor LLMClient tests to use these stubs or mocks if needed.

#### 2. Patch Writer/Obsidian Vault Mocks
- [ ] Update Writer test mocks to include all required Vault API methods (e.g., `createBinary`, `create`).
- [ ] Refactor Writer tests to use improved mocks and avoid real file I/O.

#### 3. Fix ProcessingOrchestrator & PromptTemplateManager Tests
- [ ] Review recent changes to orchestrator/template logic.
- [ ] Update tests for new expectations, or restore implementation to match test expectations.
- [ ] Add/expand tests for any new behaviors (especially chunk retry, checkpointing, and template conditionals).

#### 4. Milestone/Session Tracking
- [ ] Record this troubleshooting and recovery as a session milestone in `docs/tracking/` (see global rules).

#### 5. Documentation
- [ ] Add a high-level orchestration/overview doc: `docs/Fixing-Test-Suite-2025-05-01.md`.

## Acceptance Criteria (Revised)
- All per-chunk timeout tests remain green.
- LLMClient, Writer, Orchestrator, and TemplateManager tests pass or are skipped with clear TODOs.
- New provider stubs and mocks are in place.
- Milestone tracking and overview docs are updated.

## Next Steps
1. Scaffold missing provider stubs.
2. Patch Writer/Obsidian mocks.
3. Update failing tests/logic.
4. Document the orchestration process.
5. Track as a milestone.

---

## Subtasks

- [ ] Refactor chunk processing loop for per-chunk timeout
- [ ] Update LLMClient to accept timeout per call
- [ ] Add/Update unit tests for timeout
- [ ] Enhance logging for chunk timeouts
