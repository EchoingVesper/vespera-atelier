/**
 * Provider System - Migrated to Bindery Backend
 *
 * The legacy provider system (ClaudeCodeProvider, AnthropicProvider, etc.) has been removed
 * in favor of the Codex-based architecture managed by the Rust Bindery backend.
 *
 * LLM providers are now configured via Codex templates in .vespera/templates/llm-provider.json5
 * and managed by the Bindery backend's LLM module.
 *
 * See:
 * - PHASE_14_LLM_ARCHITECTURE.md for architecture details
 * - .vespera/templates/llm-provider.json5 for provider configuration
 * - packages/vespera-utilities/vespera-bindery/src/llm/ for Rust implementation
 */

// Placeholder - providers are now managed by Bindery backend
export {};
