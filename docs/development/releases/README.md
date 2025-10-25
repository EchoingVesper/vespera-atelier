# Release Notes

Release notes for Vespera Atelier, organized by development phase.

## About Release Notes

Vespera Atelier follows a **phased development approach** where each phase represents a significant increment of functionality. Release notes are created when a phase reaches a stable milestone suitable for testing or use.

**Note**: During early development, not all phases will have corresponding releases. Phases focus on implementation and architecture, while releases focus on user-facing stability.

---

## Release Structure

Each release is organized under its corresponding phase:

```
releases/
├── README.md (this file)
├── RELEASE_TEMPLATE.md
├── phase-15/
│   └── v0.15.0-alpha.md
├── phase-16a/
│   └── v0.16a.0-alpha.md
└── phase-17/
    └── v0.17.0-alpha.md (when ready)
```

---

## Release Index

### Current Development

- **Phase 17**: In Progress
  - *No release yet* - See [Phase 17 Plan](../phases/PHASE_17_PLAN.md)

### Completed Phases

#### Phase 16b (October 2025)
- **[v0.16b.0-alpha](phase-16b/v0.16b.0-alpha.md)** ✅ - Project-Centric UI Integration
  - Navigator UI with project filtering
  - Project creation wizard and switcher
  - Bindery integration fixes
  - Known issues: Editor not displaying, template filtering pending
  - See [Phase 16b Completion](../phases/PHASE_16b_COMPLETE.md)

#### Phase 16a (October 2025)
- **[v0.16a.0-alpha](phase-16a/v0.16a.0-alpha.md)** ✅ - Project-Centric Architecture Foundation
  - ProjectService with CRUD operations (1,018 lines, 60+ tests)
  - 43 project types with comprehensive templates
  - Breaking changes: Enum → String literals, npm → pnpm
  - See [Phase 16a Completion](../phases/PHASE_16a_COMPLETE.md)

#### Phase 15 (October 2025)
- **[v0.15.0-alpha](phase-15/v0.15.0-alpha.md)** ✅ - Documentation Audit & Architecture Foundation
  - Documentation reorganization (56 files moved)
  - 3 foundation architecture documents created
  - ADR system and phase handover methodology established
  - No production code changes
  - See [Phase 15 Completion](../phases/PHASE_15_COMPLETE.md)

#### Phase 12 (October 2025)
- **[v0.12.0-alpha](phase-12/v0.12.0-alpha.md)** - Chat System Refactor
  - *Release notes to be created*
  - See [Phase 12 Completion](../phases/PHASE_12_COMPLETE.md)

#### Earlier Phases (2, 3)
- **Phase 2-3**: Initial MCP and Bindery integration
  - *Release notes not created for early phases*
  - See [Phase Reports](../phases/)

---

## Release Versioning

Vespera Atelier uses **phase-based alpha versioning** during early development:

- **Format**: `v0.[PHASE].[INCREMENT]-alpha`
- **Example**: `v0.17.0-alpha` (Phase 17, first alpha release)

**Version Components**:
- `0.x.x` - Major version (0 = pre-1.0 development)
- `x.PHASE.x` - Phase number (15, 16a, 16b, 17, etc.)
- `x.x.INCREMENT` - Increment within phase (0, 1, 2...)
- `-alpha` - Pre-release stage (alpha, beta, rc)

**Example Progression**:
```
v0.15.0-alpha   → Phase 15 initial release
v0.15.1-alpha   → Phase 15 bugfix release
v0.16a.0-alpha  → Phase 16a initial release
v0.16b.0-alpha  → Phase 16b initial release
v0.17.0-alpha   → Phase 17 initial release
v1.0.0          → First stable release (future)
```

---

## Creating Release Notes

### For Phase Completions

When completing a phase (using `/phase-complete`):

1. Create release notes using [RELEASE_TEMPLATE.md](RELEASE_TEMPLATE.md)
2. Place in appropriate phase subdirectory: `phase-XX/v0.XX.0-alpha.md`
3. Update this README index
4. Link from phase completion document

### For Incremental Releases

For bugfix or feature releases within a phase:

1. Increment the patch version: `v0.17.0-alpha` → `v0.17.1-alpha`
2. Create new file: `phase-17/v0.17.1-alpha.md`
3. Update this README index

---

## Release Criteria

**Alpha Releases** are created when:
- A development phase is complete
- Core features are implemented (may have bugs)
- Basic testing has been done
- Not recommended for production use

**Beta Releases** (future) will indicate:
- Feature-complete for the intended scope
- Comprehensive testing completed
- Suitable for early adopters
- Still not production-ready

**Release Candidates** (future) will indicate:
- Production-ready pending final validation
- All features complete and tested
- Only critical bugfixes allowed

---

## Finding Releases

**Latest Release**: See top of this index

**By Phase**: Navigate to `phase-XX/` subdirectory

**By Feature**: Check [Development Roadmap](../../DEVELOPMENT_ROADMAP.md)

**Full History**: See [Phase Reports](../phases/)

---

## Feedback and Issues

**For Released Versions**:
- Open issues on GitHub (when available)
- Reference the release version number
- Include reproduction steps

**For Development Builds**:
- Check [Phase Plans](../phases/) for known issues
- See [Current Phase Status](../phases/PHASE_17_PLAN.md)

---

## Related Documentation

- **[Phase Reports](../phases/)** - Detailed phase completion documents
- **[ADRs](../decisions/)** - Architecture decisions
- **[Development Roadmap](../../DEVELOPMENT_ROADMAP.md)** - Overall project progress
- **[Contributing Guide](../../contributing/CONTRIBUTING.md)** - How to contribute

---

*Release notes will be populated as phases reach stable milestones. This is a solo development project with incremental progress - expect irregular release schedules.*
