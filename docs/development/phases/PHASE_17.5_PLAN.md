# Phase 17.5: Provider System Reconciliation & Security Hardening

**Status**: Approved ✅
**Created**: 2025-11-15
**Approved**: 2025-11-15
**Related PR**: #85 - Scriptorium Backend Improvements and LLM Provider Module
**Previous Phase**: [Phase 17: AI Assistant Chat Functionality](./PHASE_17_COMPLETE.md)
**Related ADRs**:
- [ADR-017: Provider System Unification](../decisions/ADR-017-provider-system-unification.md)
- [ADR-018: Secret Storage Architecture](../decisions/ADR-018-secret-storage-architecture.md)

---

## Executive Summary

PR #85 introduced a duplicate LLM provider system (`src/llm/`) that conflicts with the existing working provider system (`src/providers/`) from Phase 17. This phase will reconcile the two implementations, address critical security vulnerabilities, and establish the canonical provider architecture for Vespera Atelier.

**Critical Issues Identified**:
1. 🚨 **Duplicate Provider Systems** - Two competing implementations causing confusion
2. 🔒 **Security Vulnerability** - API keys stored in Base64 (effectively plaintext)
3. ✅ **Missing Test Coverage** - No visible tests for LLM provider functionality
4. ⚠️ **Incomplete Implementation** - TODOs in core functionality (tool calling)
5. 📦 **Heavy Dependencies** - 20+ new dependencies, some very large (candle-*)

**Scope**: Emergency remediation phase to prevent technical debt accumulation and security issues before merging PR #85.

---

## Objectives

### Primary Goals

#### 1. Provider System Reconciliation ✋ CRITICAL
**Goal**: Determine canonical provider architecture and eliminate duplication

**Analysis Required**:
- [x] Map feature parity between `src/providers/` (Phase 17) and `src/llm/` (PR #85)
- [ ] Identify which implementation has better architecture
- [ ] Document compatibility matrix with Vespera Forge chat pane
- [ ] Create migration plan for unified system

**Decision Points**:
- **Option A**: Keep Phase 17 `src/providers/`, discard `src/llm/`
  - ✅ Working in production
  - ✅ Tested with real chat interface
  - ❌ Simpler feature set
  - ❌ No vault system for secrets

- **Option B**: Adopt `src/llm/`, migrate Phase 17 code
  - ✅ More comprehensive design
  - ✅ Better abstraction with `ProviderType` enum
  - ✅ Vault system for secrets (needs security fix)
  - ❌ Not yet integrated with working UI
  - ❌ Security vulnerabilities
  - ❌ Heavy dependency load

- **Option C**: Hybrid approach - merge best features
  - ✅ Preserve working Phase 17 integration
  - ✅ Incorporate improved abstractions from `src/llm/`
  - ✅ Incremental migration path
  - ❌ More complex initial work

**Success Criteria**:
- Single, canonical provider system in codebase
- Zero functional regressions for Vespera Forge chat pane
- Clear deprecation plan for unused code
- ADR documenting decision and rationale

#### 2. Security Hardening 🔒 CRITICAL
**Goal**: Eliminate plaintext secret storage before any merge

**Current Vulnerability** (`vault.rs:60-80`):
```rust
// TODO: Implement actual decryption here
// For now, secrets are stored in plaintext (Base64 encoded)
```

**Risk Assessment**:
- **Severity**: HIGH - API keys for Claude/OpenAI/Anthropic exposed
- **Likelihood**: HIGH - Any file system access = key compromise
- **Impact**: Account takeover, unauthorized API usage, financial loss

**Remediation Options**:
1. **System Keyring Integration** (RECOMMENDED)
   - Linux: libsecret / Secret Service API
   - macOS: Keychain
   - Windows: Windows Credential Manager
   - Rust crate: `keyring` (cross-platform)

2. **Age Encryption**
   - Modern, simple encryption standard
   - Key derivation from user password
   - Rust crate: `age`

3. **AES-256-GCM Encryption**
   - Industry standard symmetric encryption
   - Key derivation from workspace-specific secret
   - Rust crates: `aes-gcm`, `argon2`

**Success Criteria**:
- API keys encrypted at rest
- Security audit passes (no plaintext storage)
- Documented threat model
- Key rotation procedure documented

#### 3. Test Coverage 🧪 HIGH PRIORITY
**Goal**: Establish comprehensive test suite for provider functionality

**Missing Tests** (identified in PR review):
- [ ] Authentication flows for each provider
- [ ] Streaming response handling
- [ ] Error handling (network failures, invalid responses)
- [ ] Session continuity (session_id tracking)
- [ ] Provider health checks
- [ ] Vault encryption/decryption
- [ ] Provider configuration validation

**Test Strategy**:
- **Unit Tests**: Individual provider implementations
- **Integration Tests**: ProviderManager lifecycle
- **Mock Tests**: HTTP/CLI responses for deterministic testing
- **Property Tests**: Invariant checking (e.g., session_id preservation)

**Success Criteria**:
- 80%+ code coverage for provider modules
- All critical paths tested (auth, streaming, errors)
- CI integration with test failure = PR block

#### 4. Complete Core Functionality ⚠️ MEDIUM PRIORITY
**Goal**: Resolve TODOs in production code paths

**Known TODOs** (`claude_code.rs:285`):
```rust
tool_calls: Vec::new(), // TODO: Parse tool calls from output
```

**Investigation Required**:
- [ ] Audit all TODO/FIXME in `src/llm/` modules
- [ ] Classify by severity (blocking vs enhancement)
- [ ] Implement or document deferral plan

**Success Criteria**:
- No TODOs in critical paths (auth, message sending)
- Tool calling either implemented or documented as future work
- All TODOs have GitHub issues for tracking

### Secondary Goals

#### 5. Dependency Optimization 📦 NICE-TO-HAVE
**Goal**: Reduce heavy dependency load via feature flags

**Current Issue**:
- Cargo.toml adds 20+ dependencies for LLM features
- `candle-*` ML frameworks are very large (100+ MB each)
- Not all deployments need all features

**Proposal**:
- Make LLM dependencies optional via features
- Example: `embeddings-local`, `embeddings-onnx`, `embeddings-api`
- Default feature set should be minimal

**Success Criteria**:
- LLM features behind feature flags
- Documentation of feature flag combinations
- Baseline build reduced by 50%+ when features disabled

#### 6. CLI Process Management 🔧 NICE-TO-HAVE
**Goal**: Add observability for CLI process spawning

**Concern**: Spawning `claude` CLI for every message may be resource-intensive

**Analysis Required**:
- [ ] Benchmark current process spawn overhead
- [ ] Profile memory usage with multiple concurrent chats
- [ ] Determine if connection pooling needed

**Potential Solutions**:
- Process pooling (reuse claude processes)
- Rate limiting (throttle concurrent spawns)
- Metrics/observability (track resource usage)

**Success Criteria**:
- Performance baseline established
- Resource usage documented
- Optimization plan if needed

### Non-Goals (Explicitly Out of Scope)

- ❌ Adding new LLM providers (focus on reconciliation)
- ❌ UI changes to chat interface (Phase 17 already works)
- ❌ Template system changes (separate concern)
- ❌ Advanced features (tool calling beyond placeholder)

---

## Prerequisites

Before starting this phase:

- [x] Phase 17 complete (AI Assistant functional)
- [x] PR #85 created and reviewed
- [x] Automated review completed
- [ ] User approval of reconciliation approach (Option A/B/C)
- [ ] Decision on security approach (keyring/age/AES)
- [ ] Agreement on test coverage target

---

## Technical Approach

### Provider System Analysis

**Phase 17 `src/providers/` Architecture**:
```
Provider Trait
├── send_message(message, model, session_id, system_prompt, stream) → ProviderResponse
├── send_message_stream(...) → Stream<StreamChunk>
├── health_check() → bool
├── provider_type() → &str
└── display_name() → &str

Implementations:
- claude_code.rs (Claude Code CLI via JSON-RPC)
- ollama.rs (Ollama HTTP REST API)
- manager.rs (ProviderManager for lifecycle)

Integration:
- Used by Vespera Forge AI Assistant (working, tested)
- Template-based configuration via Codex entries
- Session continuity via session_id tracking
```

**PR #85 `src/llm/` Architecture**:
```
LlmProvider Trait
├── send_message_streaming(ChatRequest) → StreamingResponse
├── send_message(ChatRequest) → ChatResponse
├── capabilities() → ProviderCapabilities
├── validate_config() → Result<()>
└── name() → &str

Implementations:
- provider.rs (Trait definition + ProviderType enum)
- claude_code.rs (Claude Code CLI)
- ollama.rs (Ollama HTTP)
- vault.rs (Secret storage - INSECURE)
- streaming.rs (Stream helpers)
- types.rs (Request/Response types)

Integration:
- NOT YET INTEGRATED with any UI
- Configuration via ProviderType enum
- No demonstrated session continuity
```

**Key Differences**:
1. **Type System**: PR #85 has richer types (ChatRequest/ChatResponse vs simple strings)
2. **Capabilities**: PR #85 has capabilities reporting system
3. **Configuration**: PR #85 uses enum, Phase 17 uses templates
4. **Security**: PR #85 has vault (insecure), Phase 17 has no vault
5. **Testing**: Neither has visible tests, but Phase 17 works in production

### Reconciliation Strategy (Recommendation: Option C - Hybrid)

**Phase 1: Security Fix** (Week 1)
1. Fix vault.rs encryption BEFORE merging PR #85
2. Implement keyring integration or age encryption
3. Add tests for vault security
4. Security audit before proceeding

**Phase 2: Integration Analysis** (Week 2)
1. Create adapter layer: Phase 17 `Provider` ↔ PR #85 `LlmProvider`
2. Test adapter with Vespera Forge chat pane
3. Verify zero functional regression
4. Document compatibility shims

**Phase 3: Gradual Migration** (Week 3-4)
1. Add PR #85 improvements incrementally to Phase 17 code
2. Adopt `ChatRequest`/`ChatResponse` types
3. Add `capabilities()` and `validate_config()`
4. Migrate to unified `src/providers/` directory
5. Deprecate `src/llm/` with clear migration guide

**Phase 4: Cleanup** (Week 5)
1. Remove duplicate code
2. Update all call sites to unified API
3. Comprehensive test suite
4. Documentation and examples

### Security Implementation Plan

**Recommended Approach**: System Keyring (cross-platform, OS-native)

**Implementation** (`vault.rs` refactor):
```rust
use keyring::Entry;
use anyhow::Result;

pub struct SecretVault {
    service: String,
}

impl SecretVault {
    pub fn new(service: &str) -> Self {
        Self { service: service.to_string() }
    }

    pub fn store_secret(&self, key: &str, value: &str) -> Result<()> {
        let entry = Entry::new(&self.service, key)?;
        entry.set_password(value)?;
        Ok(())
    }

    pub fn get_secret(&self, key: &str) -> Result<String> {
        let entry = Entry::new(&self.service, key)?;
        Ok(entry.get_password()?)
    }

    pub fn delete_secret(&self, key: &str) -> Result<()> {
        let entry = Entry::new(&self.service, key)?;
        entry.delete_password()?;
        Ok(())
    }
}
```

**Migration for Existing Secrets**:
1. Detect Base64-encoded secrets in old vault files
2. Prompt user to re-enter API keys (cannot decrypt Base64 safely)
3. Store in system keyring
4. Delete old vault files with warning

---

## Decisions Made ✅

### Provider System Architecture

**Q1**: Which provider system should be canonical?
- **Decision**: ✅ **Hybrid merge** - Combine best features of both systems
- **Rationale**: "We'll have to add stuff like tool calling to the implementation soon, anyway. May as well get it now."
- **Approach**: Incrementally migrate PR #85 improvements into Phase 17 codebase
- **See**: [ADR-017: Provider System Unification](../decisions/ADR-017-provider-system-unification.md)

**Q2**: How should we handle provider configuration?
- **Decision**: ✅ **Codex templates only** - No hardcoded enums
- **Rationale**: "Nothing should be hardcoded as enums here. Everything is supposed to be Codex-based for easy updating and sharing between users."
- **Impact**: PR #85's `ProviderType` enum will be replaced with template-driven configuration
- **Migration**: Convert enum variants to Codex template definitions

### Security

**Q3**: Should we support multiple secret storage backends?
- **Decision**: ✅ **Pluggable backend system** - Support keyring, age, AND AES-256-GCM
- **Rationale**: "Let's do plan on supporting all three options here. We'll implement whichever is simplest first, and make documents for tasks to add the other types later."
- **Implementation Order**:
  1. **Phase 17.5**: Implement system keyring (simplest, OS-native)
  2. **Future**: Add age encryption support (documented task)
  3. **Future**: Add AES-256-GCM support (documented task)
- **See**: [ADR-018: Secret Storage Architecture](../decisions/ADR-018-secret-storage-architecture.md)

**Q4**: How should we handle secret migration?
- **Decision**: ✅ **Ignore migration** - No existing secrets to transfer
- **Rationale**: "The secret handling has never been used by anyone, including me, the only human dev on this project. There's nothing to transfer."
- **Action**: Remove migration code complexity, fresh implementation only

### Testing

**Q5**: What is acceptable test coverage target?
- **Decision**: ✅ **Aim for 100%, minimum 80%+** - High quality standards
- **Rationale**: "I believe in 'measure twice, cut once' and quality, so I'd prefer to aim for 100%. We can settle with 80%+ for now."
- **Requirement**: "All items deferred need to be documented for later resolution"
- **Deliverables**:
  - Comprehensive test suite for all critical paths
  - GitHub issues for deferred test cases
  - CI integration with coverage reporting

### Dependencies

**Q6**: Should LLM features be optional?
- **Decision**: ✅ **Keep as optional** - Already behind feature flags ✅
- **Analysis**: candle-* dependencies are for RAG/embeddings (local ML inference)
- **Current State**: Already optional via `embeddings-local`, `embeddings-onnx`, `embeddings-api` features
- **Action**: No changes needed - current implementation is correct
- **Note**: Dependencies are NOT part of PR #85 - they're existing Phase 17 functionality

---

## Success Criteria

This phase is complete when:

### Must-Have ✅

1. **Single Provider System**
   - [ ] Only one implementation in codebase
   - [ ] Clear migration guide if code changed
   - [ ] Zero functional regression for AI Assistant

2. **Security Hardening**
   - [ ] No plaintext API key storage
   - [ ] Security audit passes
   - [ ] Threat model documented

3. **Test Coverage**
   - [ ] 80%+ coverage for provider modules
   - [ ] All critical paths tested
   - [ ] CI integration complete

4. **Documentation**
   - [ ] ADR for provider system decision
   - [ ] Updated architecture docs
   - [ ] Security setup guide

### Nice-to-Have 🎯

5. **Dependency Optimization**
   - [ ] LLM features optional
   - [ ] 50%+ build size reduction when disabled

6. **Observability**
   - [ ] Metrics for provider health
   - [ ] Resource usage tracking
   - [ ] Performance baseline documented

---

## Risks & Mitigation

### Risk 1: Breaking Working AI Assistant

**Probability**: HIGH
**Impact**: CRITICAL
**Mitigation**:
- Adapter layer for backward compatibility
- Comprehensive regression testing
- Feature flag for new vs old provider system
- Rollback plan documented

### Risk 2: Security Implementation Complexity

**Probability**: MEDIUM
**Impact**: HIGH
**Mitigation**:
- Use proven libraries (keyring crate)
- External security review
- Gradual rollout with opt-in

### Risk 3: Provider System Disagreement

**Probability**: MEDIUM
**Impact**: HIGH
**Mitigation**:
- Early alignment with user
- Prototype both approaches
- Decision matrix with clear criteria

### Risk 4: Timeline Extension

**Probability**: HIGH
**Impact**: MEDIUM
**Mitigation**:
- Phased delivery (security first)
- Defer nice-to-haves if needed
- Regular checkpoint reviews

---

## Timeline Estimate

**Total Duration**: 3-5 weeks
**Effort**: 40-60 hours

**Week 1: Critical Security** (12-16 hours)
- Security vulnerability fix
- Vault refactoring
- Security tests
- Audit

**Week 2: System Analysis** (8-12 hours)
- Provider compatibility analysis
- Integration testing
- Decision on canonical system

**Week 3-4: Migration** (16-24 hours)
- Code migration
- Test suite development
- Documentation updates

**Week 5: Cleanup & Polish** (4-8 hours)
- Remove duplicate code
- Final testing
- Release preparation

---

## Next Steps

1. **User Decision Required**:
   - Review this plan
   - Choose provider system approach (A/B/C)
   - Approve security strategy (keyring/age/AES)
   - Confirm priority (security vs features)

2. **Create Related ADRs**:
   - ADR-017: Provider System Unification
   - ADR-018: Secret Storage Architecture

3. **Initialize Work**:
   - Branch: `fix/phase-17.5-provider-reconciliation`
   - First task: Fix vault.rs security vulnerability
   - Regular checkpoints with user

4. **Communication**:
   - Update PR #85 with findings
   - Notify that merge blocked pending security fix
   - Set expectations for timeline

---

## References

### Related Documentation
- [Phase 17 Completion](./PHASE_17_COMPLETE.md) - Working provider system
- [PR #85 Review](https://github.com/EchoingVesper/vespera-atelier/pull/85) - Automated security review
- [Provider Architecture](../../architecture/subsystems/MCP_BINDERY_ARCHITECTURE.md) - System overview

### Code Locations
**Phase 17 System** (Working, Tested):
- `packages/vespera-utilities/vespera-bindery/src/providers/mod.rs` - Provider trait
- `packages/vespera-utilities/vespera-bindery/src/providers/manager.rs` - Lifecycle management
- `packages/vespera-utilities/vespera-bindery/src/providers/claude_code.rs` - Claude CLI provider
- `packages/vespera-utilities/vespera-bindery/src/providers/ollama.rs` - Ollama provider
- `plugins/VSCode/vespera-forge/src/views/ai-assistant.ts` - UI integration

**PR #85 System** (New, Untested, Insecure):
- `packages/vespera-utilities/vespera-bindery/src/llm/provider.rs` - LlmProvider trait
- `packages/vespera-utilities/vespera-bindery/src/llm/claude_code.rs` - Claude implementation
- `packages/vespera-utilities/vespera-bindery/src/llm/ollama.rs` - Ollama implementation
- `packages/vespera-utilities/vespera-bindery/src/llm/vault.rs` - ⚠️ INSECURE secret storage
- `packages/vespera-utilities/vespera-bindery/src/llm/types.rs` - Request/Response types
- `packages/vespera-utilities/vespera-bindery/src/llm/streaming.rs` - Stream helpers

### External References
- [keyring crate](https://crates.io/crates/keyring) - Cross-platform secret storage
- [age](https://crates.io/crates/age) - Modern encryption standard
- [OWASP Secret Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) - Security best practices

---

*Phase plan created: 2025-11-15*
*Status: Awaiting user approval*
*Template version: 1.0.0*
*Created by: Claude Code (Sonnet 4.5)*
