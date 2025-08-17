# Orchestrating Test Suite Recovery: May 2025

This document provides a high-level overview and actionable steps for addressing the current suite of test failures in the Vespera Scriptorium plugin, based on the results and remediation plan in `temp-tasks/01-per-chunk-timeout.md`.

---

## High-Level Strategy

1. **Unblock the LLMClient Layer**
   - Scaffold missing provider stubs (`OllamaProvider`, `LMStudioProvider`) in `src/providers/index.ts`.
   - Ensure these stubs export the expected classes and methods (even as no-ops or mocks).
   - Refactor LLMClient tests to use the new stubs or inject mocks as needed.

2. **Restore Writer Testability**
   - Update Writer test mocks to include all required Vault API methods (e.g., `createBinary`, `create`).
   - Ensure tests do not attempt real file I/O—use in-memory or no-op mocks.

3. **Harmonize Orchestrator & TemplateManager**
   - Review and align test expectations with the latest implementation.
   - Update or skip tests that are no longer relevant, but always add a `TODO` for future coverage.
   - Expand tests for new logic (chunk retry, checkpointing, template conditionals).

4. **Milestone & Documentation Hygiene**
   - Record this test suite recovery as a milestone in `docs/tracking/`.
   - Keep this orchestration doc up to date as steps are completed or new blockers emerge.

---

## Individual File Responsibilities

### `src/providers/index.ts`
- Export minimal `OllamaProvider` and `LMStudioProvider` classes with the correct interface for LLMClient.

### `tests/unit/Writer.spec.ts`
- Patch test setup to mock all required Obsidian Vault methods.
- Avoid file system side effects.

### `tests/unit/LLMClient.spec.ts`
- Refactor to use new provider stubs or dependency injection.
- Skip or TODO any tests that cannot run without a real provider.

### `tests/unit/ProcessingOrchestrator.spec.ts` & `tests/unit/PromptTemplateManager.spec.ts`
- Update for new expectations and logic.
- Add/expand tests for chunk retry, checkpointing, and template conditionals.

### `docs/tracking/`
- Add a new milestone markdown file summarizing this recovery session and its outcomes.

---

## Completion Criteria
- All tests for per-chunk timeout remain green.
- LLMClient, Writer, Orchestrator, and TemplateManager tests pass or are skipped with clear TODOs.
- New provider stubs and mocks are present.
- Milestone and orchestration docs are up to date.

---

// Reason: This orchestration ensures all contributors can work in parallel, minimizes merge pain, and documents the recovery process for future maintainers.
