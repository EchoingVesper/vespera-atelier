# Phase 17.5: Provider System Reconciliation & Security Hardening

**Status**: Complete ✅
**Created**: 2025-11-15
**Started**: 2025-11-15
**Completed**: 2025-11-16
**Completion Document**: [PHASE_17.5_COMPLETE.md](./PHASE_17.5_COMPLETE.md)
**Related PR**: #85 - Scriptorium Backend Improvements and LLM Provider Module
**Previous Phase**: [Phase 17: AI Assistant Chat Functionality](./PHASE_17_COMPLETE.md)
**Related ADRs**:
- [ADR-017: Provider System Unification](../decisions/ADR-017-provider-system-unification.md)
- [ADR-018: Secret Storage Architecture](../decisions/ADR-018-secret-storage-architecture.md)

---

## Executive Summary

PR #85 introduced a duplicate LLM provider system (`src/llm/`) that conflicts with the existing working provider system (`src/providers/`) from Phase 17. This phase will reconcile the two implementations, address critical security vulnerabilities, and establish the canonical provider architecture.

**Critical Issues**:
1. 🚨 **Duplicate Provider Systems** - Two competing implementations
2. 🔒 **Security Vulnerability** - API keys stored in Base64 (effectively plaintext)
3. ✅ **Missing Test Coverage** - No tests for new LLM provider functionality
4. ⚠️ **Incomplete Implementation** - TODOs in core functionality

**Approach**: Hybrid merge - incrementally adopt PR #85 improvements into Phase 17 codebase while fixing security issues.

---

## Decisions Made

All architectural decisions have been documented in ADRs. See:
- **[ADR-017: Provider System Unification](../decisions/ADR-017-provider-system-unification.md)** - Hybrid merge approach, Codex-based configuration only
- **[ADR-018: Secret Storage Architecture](../decisions/ADR-018-secret-storage-architecture.md)** - Pluggable backends (keyring first, age/AES-GCM later)

**Key Decisions**:
- ✅ Hybrid merge of both provider systems
- ✅ Codex templates only (no hardcoded ProviderType enum)
- ✅ System keyring for secret storage (Phase 17.5), age/AES-GCM deferred to issues #86/#87
- ✅ No migration needed (no existing secrets in use)
- ✅ Test coverage target: 100% (minimum 80%+)
- ✅ Dependencies already properly optional via feature flags

---

## Implementation Tasks

### Week 1-2: Foundation & Security

#### Task 1: Implement System Keyring Backend
**Priority**: CRITICAL 🔒
**Deliverables**:
- [ ] Create `src/secrets/` module with pluggable backend trait
- [ ] Implement `KeyringBackend` using `keyring` crate
- [ ] Replace insecure `vault.rs` Base64 encoding
- [ ] Add comprehensive security tests
- [ ] Security audit verification

**Files**:
- Create: `packages/vespera-utilities/vespera-bindery/src/secrets/mod.rs`
- Create: `packages/vespera-utilities/vespera-bindery/src/secrets/keyring.rs`
- Create: `packages/vespera-utilities/vespera-bindery/src/secrets/manager.rs`
- Delete: `packages/vespera-utilities/vespera-bindery/src/llm/vault.rs`

**Dependencies**:
```toml
keyring = "3.0"
```

#### Task 2: Create Type Adapter Layer
**Priority**: CRITICAL
**Deliverables**:
- [ ] Adapter between Phase 17 `Provider` trait and PR #85 `LlmProvider` trait
- [ ] Conversion functions: `ChatRequest`/`ChatResponse` ↔ Phase 17 types
- [ ] Preserve session continuity (session_id tracking)
- [ ] Zero functional regression for AI Assistant

**Files**:
- Create: `packages/vespera-utilities/vespera-bindery/src/providers/adapter.rs`
- Modify: `packages/vespera-utilities/vespera-bindery/src/providers/mod.rs`

#### Task 3: Comprehensive Regression Test Suite
**Priority**: HIGH ✅
**Deliverables**:
- [ ] Unit tests for all provider implementations
- [ ] Integration tests for ProviderManager
- [ ] Regression tests for AI Assistant functionality
- [ ] Security tests for keyring backend
- [ ] CI integration with coverage reporting

**Coverage Target**: 80%+ (aiming for 100%)

**Files**:
- Create: `packages/vespera-utilities/vespera-bindery/src/providers/tests/`
- Create: `packages/vespera-utilities/vespera-bindery/src/secrets/tests/`

### Week 3-4: Feature Integration

#### Task 4: Integrate ChatRequest/ChatResponse Types
**Priority**: MEDIUM
**Deliverables**:
- [ ] Add `ChatRequest`/`ChatResponse` types to Phase 17 providers
- [ ] Update `Provider` trait to support richer types
- [ ] Maintain backward compatibility via adapter
- [ ] Update all call sites

**Files**:
- Create: `packages/vespera-utilities/vespera-bindery/src/providers/types.rs`
- Modify: Phase 17 provider implementations

#### Task 5: Add Capabilities Reporting
**Priority**: MEDIUM
**Deliverables**:
- [ ] Add `capabilities()` method to `Provider` trait
- [ ] Implement for all providers
- [ ] Document provider feature matrix

**Files**:
- Modify: `packages/vespera-utilities/vespera-bindery/src/providers/mod.rs`

#### Task 6: Implement Tool Calling Support
**Priority**: MEDIUM
**Deliverables**:
- [ ] Complete TODO in `claude_code.rs:285` (tool call parsing)
- [ ] Add tool calling to `Provider` trait
- [ ] Tests for tool execution

**Files**:
- Modify: `packages/vespera-utilities/vespera-bindery/src/providers/claude_code.rs`
- Modify: `packages/vespera-utilities/vespera-bindery/src/llm/claude_code.rs`

#### Task 7: Convert ProviderType Enum to Codex Templates
**Priority**: HIGH
**Deliverables**:
- [ ] Remove hardcoded `ProviderType` enum from `src/llm/provider.rs`
- [ ] Create Codex templates for each provider type
- [ ] Update configuration loading to use templates
- [ ] Migration guide for configuration format

**Files**:
- Create: `.vespera/templates/codex/providers/claude-code-cli.codex.json5`
- Create: `.vespera/templates/codex/providers/anthropic-api.codex.json5`
- Create: `.vespera/templates/codex/providers/ollama.codex.json5`
- Delete enum from: `packages/vespera-utilities/vespera-bindery/src/llm/provider.rs`

### Week 5: Cleanup & Documentation

#### Task 8: Remove Duplicate Code
**Priority**: HIGH
**Deliverables**:
- [ ] Delete `src/llm/` directory after migration
- [ ] Update all imports to use unified `src/providers/`
- [ ] Verify no orphaned code

**Files**:
- Delete: `packages/vespera-utilities/vespera-bindery/src/llm/` (entire directory)

#### Task 9: Documentation Updates
**Priority**: MEDIUM
**Deliverables**:
- [ ] Update architecture documentation
- [ ] Create security setup guide
- [ ] Provider configuration examples
- [ ] Migration guide for external users

**Files**:
- Update: `docs/architecture/subsystems/MCP_BINDERY_ARCHITECTURE.md`
- Create: `docs/guides/SECRET_STORAGE_SETUP.md`
- Create: `docs/guides/PROVIDER_CONFIGURATION.md`

---

## Success Criteria

### Must-Have ✅

- [ ] **Single Provider System**: Only `src/providers/` exists, `src/llm/` deleted
- [ ] **No Security Vulnerabilities**: System keyring implemented, no Base64 secrets
- [ ] **Zero Regression**: AI Assistant works exactly as before
- [ ] **Test Coverage**: 80%+ coverage for all provider code
- [ ] **Codex Templates**: All configuration via templates, no hardcoded enums
- [ ] **Documentation**: ADRs created, architecture docs updated

### Deferred to Future Issues

- [ ] Age encryption backend (Issue #86)
- [ ] AES-256-GCM backend (Issue #87)
- [ ] Advanced tool calling features
- [ ] Provider connection pooling

---

## Timeline

**Total Duration**: 3-5 weeks
**Effort**: 40-60 hours

- **Week 1-2**: Security + Adapter Layer (Critical)
- **Week 3-4**: Feature Integration (Medium Priority)
- **Week 5**: Cleanup + Documentation (Low Priority)

---

## Code Locations

### Phase 17 System (Foundation)
- `packages/vespera-utilities/vespera-bindery/src/providers/` - Keep and enhance

### PR #85 System (Extract then Delete)
- `packages/vespera-utilities/vespera-bindery/src/llm/` - Extract improvements, then delete
- `packages/vespera-utilities/vespera-bindery/src/llm/vault.rs` - ⚠️ **DELETE** (security vulnerability)
- `packages/vespera-utilities/vespera-bindery/src/llm/types.rs` - Extract to `src/providers/types.rs`
- `packages/vespera-utilities/vespera-bindery/src/llm/streaming.rs` - Extract to `src/providers/streaming.rs`

---

## Risks & Mitigation

**Risk**: Breaking working AI Assistant
**Mitigation**: Adapter layer, comprehensive regression tests, feature flags

**Risk**: Security implementation complexity
**Mitigation**: Use proven `keyring` crate, security audit, gradual rollout

**Risk**: Timeline extension
**Mitigation**: Phased delivery (security first), defer nice-to-haves

---

*Phase started: 2025-11-15*
*Status: In Progress*
*Current task: Implementing system keyring backend*
