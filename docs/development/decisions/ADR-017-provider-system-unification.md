# ADR-017: Provider System Unification

**Status**: Accepted ✅
**Date**: 2025-11-15
**Related Phase**: [Phase 17.5: Provider System Reconciliation](../phases/PHASE_17.5_PLAN.md)
**Related PR**: #85 - Scriptorium Backend Improvements and LLM Provider Module
**Supersedes**: None
**Related**: [ADR-018: Secret Storage Architecture](./ADR-018-secret-storage-architecture.md)

---

## Context and Problem Statement

PR #85 introduced a duplicate LLM provider system (`src/llm/`) that conflicts with the existing working provider system (`src/providers/`) from Phase 17. We have two competing implementations:

**Phase 17 System** (`src/providers/`):
- ✅ Working in production with Vespera Forge AI Assistant
- ✅ Template-based configuration via Codex entries
- ✅ Session continuity with session_id tracking
- ❌ Simpler feature set
- ❌ No secret vault system

**PR #85 System** (`src/llm/`):
- ✅ Richer type system (ChatRequest/ChatResponse)
- ✅ Provider capabilities reporting
- ✅ Vault system for secrets (needs security fix)
- ✅ Better abstractions with ProviderType enum
- ❌ Not integrated with any UI
- ❌ Security vulnerabilities (Base64 secrets)
- ❌ TODOs in core functionality

**The Problem**: Which system should be canonical? How do we unify them without breaking the working AI Assistant?

---

## Decision Drivers

1. **Production Stability** - AI Assistant chat must continue working
2. **Feature Completeness** - Need tool calling and richer types for future work
3. **Architectural Principles** - Everything must be Codex-based, not hardcoded
4. **Migration Effort** - Minimize disruption to existing code
5. **Code Quality** - Single source of truth, no duplication

---

## Considered Options

### Option A: Keep Phase 17 System, Discard PR #85
**Approach**: Reject PR #85's provider code, keep only scriptorium fix and docs

**Pros**:
- ✅ Zero migration risk
- ✅ Proven to work in production
- ✅ Simpler implementation
- ✅ Already template-based

**Cons**:
- ❌ Miss out on improved abstractions (ChatRequest/ChatResponse)
- ❌ No vault system for secrets
- ❌ No capabilities reporting
- ❌ Will need to re-implement these features later anyway

### Option B: Adopt PR #85 System, Migrate Phase 17
**Approach**: Replace Phase 17 providers with PR #85 implementation

**Pros**:
- ✅ Richer type system
- ✅ Better abstraction layers
- ✅ Vault system (after security fix)
- ✅ Capabilities reporting

**Cons**:
- ❌ HIGH RISK: Could break working AI Assistant
- ❌ Not yet integrated with any UI
- ❌ Security vulnerabilities must be fixed first
- ❌ Uses hardcoded ProviderType enum (violates architecture)
- ❌ Large migration effort

### Option C: Hybrid Merge - Incrementally Adopt PR #85 Features ⭐ CHOSEN
**Approach**: Keep Phase 17 as foundation, selectively integrate PR #85 improvements

**Pros**:
- ✅ Preserves working production code
- ✅ Gradual, low-risk migration path
- ✅ Get benefits of both systems
- ✅ Can maintain Codex-based configuration
- ✅ Incremental testing and validation

**Cons**:
- ⚠️ More initial work than other options
- ⚠️ Requires careful adapter layer design
- ⚠️ Temporary code duplication during migration

---

## Decision Outcome

**Chosen Option**: **C - Hybrid Merge**

**Rationale** (user decision):
> "Hybrid merge makes the most sense. We'll have to add stuff like tool calling to the implementation soon, anyway. May as well get it now."

### Implementation Strategy

**Phase 1: Preserve Foundation** (Week 1-2)
1. Keep Phase 17 `src/providers/` as working baseline
2. Fix security vulnerabilities in PR #85 `src/llm/vault.rs`
3. Create adapter layer: Phase 17 ↔ PR #85 types
4. Comprehensive regression testing

**Phase 2: Incremental Adoption** (Week 3-4)
1. Add `ChatRequest`/`ChatResponse` types to Phase 17
2. Integrate capabilities reporting
3. Merge improved error handling
4. Add tool calling support (beyond TODO)
5. **Convert ProviderType enum to Codex templates**

**Phase 3: Cleanup** (Week 5)
1. Remove duplicate code from `src/llm/`
2. Migrate all call sites to unified API
3. Update documentation
4. Comprehensive test suite

### Configuration Architecture Decision

**Critical**: Provider configuration will remain **Codex-based only**

**Rationale** (user decision):
> "Nothing should be hardcoded as enums here. Everything is supposed to be Codex-based for easy updating and sharing between users."

**Impact**: PR #85's `ProviderType` enum will be **replaced** with template-driven configuration:

```rust
// ❌ REMOVE: Hardcoded enum
pub enum ProviderType {
    ClaudeCode { model: String, ... },
    Anthropic { api_key: String, ... },
    ...
}

// ✅ KEEP: Template-based configuration
// Provider configuration stored in Codex entries with templates:
// .vespera/templates/codex/providers/claude-code-cli.codex.json5
// .vespera/templates/codex/providers/anthropic-api.codex.json5
```

**Migration**: Each `ProviderType` enum variant becomes a Codex template definition

---

## Pros and Cons of Chosen Option

### Pros ✅

**Production Safety**:
- Phase 17 codebase remains untouched until validated
- Working AI Assistant guaranteed to function
- Rollback plan is simple (keep old code)

**Feature Richness**:
- Get ChatRequest/ChatResponse type improvements
- Gain capabilities reporting system
- Acquire vault infrastructure (after security fix)
- Prepare for tool calling

**Architectural Alignment**:
- Can enforce Codex-based configuration
- Eliminates hardcoded enums
- Maintains template system consistency

**Incremental Risk**:
- Small, testable changes
- Each step can be validated
- Can pause migration if issues arise

### Cons ⚠️

**Development Complexity**:
- Requires adapter layer during transition
- Temporary code duplication
- More initial planning needed

**Timeline Extension**:
- 3-5 weeks vs 1-2 weeks for simpler options
- Requires careful phase coordination

**Testing Burden**:
- Must test both old and new code paths
- Regression suite must be comprehensive

---

## Validation and Testing

### Acceptance Criteria

**Functional**:
- [ ] AI Assistant chat continues working without regression
- [ ] All Phase 17 features preserved (session continuity, streaming, etc.)
- [ ] New features working (ChatRequest types, capabilities, tool calling)
- [ ] Provider configuration via Codex templates only

**Code Quality**:
- [ ] Zero duplicate provider implementations
- [ ] 80%+ test coverage (aiming for 100%)
- [ ] No hardcoded ProviderType enum
- [ ] All TODOs resolved or documented as issues

**Security**:
- [ ] Secret vault using system keyring (no Base64)
- [ ] Security audit passes
- [ ] Threat model documented

### Test Strategy

**Regression Tests** (Phase 17 functionality):
- Create channel, send message, verify response
- Switch channels, verify session continuity
- Provider/model selection persistence
- Error handling (network failures, invalid models)
- Streaming response handling

**Integration Tests** (Hybrid system):
- Adapter layer: Phase 17 ↔ PR #85 types
- Template-based provider configuration
- Vault secret storage and retrieval
- Capabilities reporting

**Unit Tests** (New features):
- ChatRequest/ChatResponse serialization
- Tool calling parsing and execution
- Provider capabilities detection
- Error type conversions

---

## Implementation Plan

### Week 1-2: Foundation & Security

**Deliverables**:
- [ ] Fix vault.rs security vulnerability (system keyring)
- [ ] Create type adapter layer
- [ ] Comprehensive regression test suite
- [ ] Security audit

**Validation**:
- AI Assistant must work with zero functional changes
- All security tests pass

### Week 3-4: Feature Integration

**Deliverables**:
- [ ] Integrate ChatRequest/ChatResponse types
- [ ] Add capabilities reporting
- [ ] Implement tool calling (beyond TODO)
- [ ] Convert ProviderType enum → Codex templates

**Validation**:
- All new types work with existing code
- Template-based configuration proven
- Tool calling functional

### Week 5: Cleanup & Documentation

**Deliverables**:
- [ ] Remove `src/llm/` duplicate code
- [ ] Update architecture documentation
- [ ] Migration guide for external users
- [ ] Comprehensive examples

**Validation**:
- Code coverage ≥ 80% (target 100%)
- All documentation updated
- No orphaned code

---

## Migration Guide

### For AI Assistant Code

**Before** (Phase 17):
```typescript
const response = await provider.send_message(
    message,
    model,
    sessionId,
    systemPrompt,
    false
);
```

**After** (Unified):
```typescript
const request: ChatRequest = {
    message,
    model,
    session_id: sessionId,
    system_prompt: systemPrompt,
    stream: false
};
const response = await provider.send_message(request);
```

### For Provider Configuration

**Before** (PR #85 - REJECT):
```rust
let config = ProviderType::ClaudeCode {
    model: "claude-sonnet-4-5".to_string(),
    cli_path: None,
    ...
};
```

**After** (Unified - Codex-based):
```json5
// .vespera/templates/codex/providers/claude-code-cli.codex.json5
{
    template_id: "claude-code-cli",
    title: "Claude Code CLI Provider",
    fields: {
        model: { type: "string", default: "claude-sonnet-4-5" },
        cli_path: { type: "string", optional: true },
        ...
    }
}
```

---

## Consequences

### Positive Impacts

**Stability**:
- Working AI Assistant remains functional throughout migration
- Gradual migration reduces risk of catastrophic failures

**Features**:
- Richer type system improves code quality
- Tool calling support enables future features
- Capabilities reporting helps UI/UX decisions

**Architecture**:
- Single, unified provider system
- Consistent Codex-based configuration
- Eliminates technical debt from duplication

### Negative Impacts

**Development Time**:
- 3-5 weeks vs 1-2 weeks for simpler options
- Requires careful coordination and testing

**Code Churn**:
- Temporary adapter layer adds complexity
- Multiple touch points across codebase

**Learning Curve**:
- New types require documentation and examples
- Migration guide needed for external contributions

### Mitigation Strategies

**Risk: Breaking AI Assistant**
- Comprehensive regression test suite
- Feature flag for old vs new code paths
- Gradual rollout with checkpoints

**Risk: Timeline Extension**
- Phased delivery (security first, features later)
- Can defer nice-to-haves if needed
- Regular progress reviews with user

---

## Related Decisions

### Upstream Decisions
- **[ADR-015: Workspace/Project/Context Hierarchy](./ADR-015-workspace-project-context-hierarchy.md)** - Codex-based architecture
- **[ADR-016: Global Registry Storage](./ADR-016-global-registry-storage.md)** - Cross-workspace patterns

### Downstream Decisions
- **[ADR-018: Secret Storage Architecture](./ADR-018-secret-storage-architecture.md)** - Vault implementation details
- **Future**: ADR for tool calling implementation
- **Future**: ADR for provider capabilities schema

---

## Links

### Architecture Documentation
- [Provider System (Phase 17)](../../architecture/subsystems/MCP_BINDERY_ARCHITECTURE.md)
- [Template System Architecture](../../architecture/core/TEMPLATE_SYSTEM_ARCHITECTURE.md)

### Code Locations
**Phase 17 (Keep)**:
- `packages/vespera-utilities/vespera-bindery/src/providers/mod.rs`
- `packages/vespera-utilities/vespera-bindery/src/providers/manager.rs`
- `packages/vespera-utilities/vespera-bindery/src/providers/claude_code.rs`
- `packages/vespera-utilities/vespera-bindery/src/providers/ollama.rs`

**PR #85 (Merge selectively, then remove)**:
- `packages/vespera-utilities/vespera-bindery/src/llm/provider.rs` - Extract types
- `packages/vespera-utilities/vespera-bindery/src/llm/types.rs` - Migrate ChatRequest/ChatResponse
- `packages/vespera-utilities/vespera-bindery/src/llm/vault.rs` - Fix security, migrate vault
- `packages/vespera-utilities/vespera-bindery/src/llm/` - DELETE after migration

### Phase Documentation
- [Phase 17 Completion](../phases/PHASE_17_COMPLETE.md) - Working provider system
- [Phase 17.5 Plan](../phases/PHASE_17.5_PLAN.md) - This reconciliation phase

### External References
- [Rust Adapter Pattern](https://rust-unofficial.github.io/patterns/patterns/behavioural/strategy.html)
- [Type-Driven Design](https://fsharpforfunandprofit.com/posts/designing-with-types-intro/)

---

*ADR created: 2025-11-15*
*Status: Accepted*
*Decision maker: Echoing Vesper (user)*
*Documented by: Claude Code (Sonnet 4.5)*
