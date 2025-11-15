# Contributing to Vespera Atelier

Thanks for your interest in contributing! This document explains how to get involved.

## ⚠️ Important Context

This is a solo development project in early stages. The codebase is evolving rapidly, and architectural decisions are still being made. Contributions are welcome, but expect:

- Breaking changes between phases
- Documentation that may be ahead of implementation
- Some features described but not yet built
- Limited bandwidth for PR reviews (solo developer with health challenges)

If you're okay with that uncertainty, read on!

## Getting Started

### 1. Understand the Architecture

**Must Read:**
- [CLAUDE.md](../../CLAUDE.md) - Monorepo structure and development guidance
- [docs/architecture/core/](../architecture/core/) - Core system design
- [docs/development/decisions/](../development/decisions/README.md) - Architecture Decision Records

**Recommended:**
- [docs/philosophy/](../philosophy/) - Design philosophy and motivation
- [docs/development/phases/](../development/phases/) - Current phase status

### 2. Set Up Development Environment

See [SETUP.md](SETUP.md) for detailed setup instructions.

**Quick Overview:**
- **Monorepo**: Multiple packages and plugins
- **VS Code Extension**: Primary development focus ([plugins/VSCode/vespera-forge/](../../plugins/VSCode/vespera-forge/))
- **Rust Backend**: Bindery for content management ([packages/vespera-utilities/vespera-bindery/](../../packages/vespera-utilities/vespera-bindery/))
- **MCP Server**: FastMCP translation layer ([packages/vespera-scriptorium/](../../packages/vespera-scriptorium/))

### 3. Find Something to Work On

**Current Phase**: Phase 17 - Codex Editor Implementation

Check [docs/development/phases/PHASE_17_PLAN.md](../development/phases/PHASE_17_PLAN.md) for current goals.

**Good First Areas:**
- Documentation improvements
- Bug fixes in existing features
- Test coverage
- TypeScript type safety improvements

**Complex Areas** (coordinate first):
- Architectural changes
- New major features
- Database schema changes
- Template system modifications

## Development Workflow

1. **Fork and clone** the repository
2. **Create a branch** for your work
3. **Make changes** following code standards in [CLAUDE.md](../../CLAUDE.md)
4. **Test thoroughly** - this is early-stage, bugs compound
5. **Commit** with descriptive messages (see commit conventions below)
6. **Open PR** with clear description and context

### Commit Conventions

Use conventional commit format with package scope:

```
feat(forge): add codex editor toolbar
fix(bindery): resolve database connection leak
docs(architecture): update template system diagrams
test(forge): add navigator integration tests
```

**Scopes:**
- `forge` - VS Code extension (Vespera Forge)
- `bindery` - Rust backend
- `scriptorium` - MCP server
- `docs` - Documentation
- `architecture` - Architectural changes
- `templates` - Template system

## Code Standards

**TypeScript:**
- Strict mode enabled
- No `any` types without justification
- Functional components with hooks for React
- Comprehensive error handling

**Rust:**
- Follow clippy lints
- Document public APIs
- Write tests for new features

**Documentation:**
- Update relevant docs with code changes
- Keep ADRs up to date for architectural decisions
- Update phase plans when completing tasks

See [CLAUDE.md](../../CLAUDE.md) "Development Best Practices" section for detailed guidelines.

## Communication

**Currently**: No established communication channels (solo development)

**For Now**:
- Open issues for bugs or feature discussions
- PRs for contributions
- Discussions tab for questions

## What Helps Most

As a solo developer, the most valuable contributions are:

1. **Bug reports** with clear reproduction steps
2. **Documentation improvements** (especially catching outdated docs)
3. **Focused PRs** that solve one problem well
4. **Patience** with review times

## What to Avoid

- Large architectural refactors without discussion first
- PRs touching multiple systems simultaneously
- Features not aligned with current phase goals
- Assumptions about implementation details (ask first!)

## Testing

**VS Code Extension:**
```bash
cd plugins/VSCode/vespera-forge
npm install
npm run test
```

**Rust Backend:**
```bash
cd packages/vespera-utilities/vespera-bindery
cargo test
```

**MCP Server:**
```bash
cd packages/vespera-scriptorium
pip install -r requirements.txt
pytest
```

## Documentation Style

- Use clear, straightforward language
- Avoid marketing hype or overselling
- Be honest about implementation status
- Include code examples where helpful
- Link to related documents

## License

By contributing, you agree your contributions will be licensed under AGPL-3.0.

---

Thanks for being interested in this project. Every bit helps!
