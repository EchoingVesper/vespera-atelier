# Vespera Bindery

**A high-performance Rust library for collaborative Codex management with CRDT-based real-time editing**

Vespera Bindery is the core content management system for the Vespera Atelier ecosystem. It provides conflict-free replicated data types (CRDTs) for real-time collaborative editing of structured documents called "Codices".

## Architecture Overview

### Hybrid CRDT Structure
```rust
pub struct VesperaCRDT {
    text_layer: YTextCRDT,           // Text editing within template fields
    tree_layer: VesperaTreeCRDT,     // Hierarchical Codex relationships  
    metadata_layer: LWWMap,          // Template metadata (last-writer-wins)
    reference_layer: ORSet,          // Cross-Codex references
    operation_log: Vec<CRDTOperation>, // Git-like operation history
}
```

### Key Features
- **Real-time Collaboration**: Google Drive-level multi-user editing
- **Offline-first**: Full functionality without internet connection
- **Conflict-free**: Mathematical guarantees prevent merge conflicts
- **Template-aware**: CRDT operations understand structured content
- **Cross-platform**: Dual bindings for Node.js (NAPI-RS) and Python (PyO3)

## Project Structure

```
vespera-bindery/
├── Cargo.toml                  # Hybrid CRDT dependencies
├── package.json                # Node.js package configuration
├── pyproject.toml              # Python package configuration
├── build.rs                    # Build configuration
├── README.md                   # This file
├── ARCHITECTURE.md             # Detailed architecture documentation
├── IMPLEMENTATION_PLAN.md      # Phase-by-phase implementation guide
├── src/
│   ├── lib.rs                  # Public API
│   ├── crdt/                   # CRDT implementation
│   │   ├── mod.rs              # CRDT orchestrator
│   │   ├── text_layer.rs       # Y-CRDT for text editing
│   │   ├── tree_layer.rs       # Hierarchical document structure
│   │   ├── metadata_layer.rs   # Template metadata (LWW-Map)
│   │   └── reference_layer.rs  # Cross-document references (OR-Set)
│   ├── codex/                  # Codex management
│   │   ├── mod.rs              # Public codex API
│   │   ├── format.rs           # JSON5 + binary serialization
│   │   ├── template.rs         # Template-driven content
│   │   └── versioning.rs       # Git-like operation logs
│   ├── sync/                   # Network synchronization
│   │   ├── mod.rs              # Public sync API
│   │   ├── protocol.rs         # Peer-to-peer sync protocol
│   │   ├── conflict.rs         # Conflict resolution
│   │   └── offline.rs          # Offline-first operations
│   └── bindings/
│       ├── mod.rs              # Binding utilities
│       ├── nodejs.rs           # NAPI-RS bindings for VS Code
│       └── python.rs           # PyO3 bindings for MCP server
├── tests/                      # Integration tests
├── benches/                    # Performance benchmarks
└── docs/                       # Additional documentation
```

## Development Phases

### Phase 1: Core CRDT Foundation (3-4 months)
- [x] Project structure setup
- [ ] Hybrid CRDT implementation
- [ ] Enhanced Codex format with CRDT metadata
- [ ] Dual language bindings (Node.js + Python)

### Phase 2: VS Code Plugin Integration (2-3 months)  
- [ ] Vespera Forge plugin structure
- [ ] Real-time collaboration UI
- [ ] MCP agent integration
- [ ] Template-aware editing

### Phase 3: Advanced Collaboration (2-3 months)
- [ ] Peer-to-peer synchronization
- [ ] Multi-provider agent support
- [ ] Advanced template system
- [ ] Conflict resolution UI

### Phase 4: Production Hardening (2-3 months)
- [ ] Performance optimization
- [ ] Cross-platform integration
- [ ] Security & reliability features
- [ ] Comprehensive testing

## Dependencies

### Core CRDT Libraries
- `yrs` - Y-CRDT implementation in Rust
- `loro-crdt` - Next-generation hierarchical CRDT
- `automerge` - Alternative CRDT for comparison

### Bindings & Serialization
- `napi` + `napi-derive` - Node.js bindings
- `pyo3` - Python bindings  
- `serde` + `json5` - Structured format support
- `tokio` - Async operations

### Utilities
- `uuid` - Codex identification
- `sha2` - Content hashing
- `thiserror` + `anyhow` - Error handling
- `tracing` - Structured logging

## Usage Examples

### Basic Codex Creation (Rust)
```rust
use vespera_bindery::{CodexManager, Template};

let manager = CodexManager::new()?;
let template = Template::load("react-component")?;
let codex = manager.create_codex("MyComponent", template)?;
```

### Real-time Collaboration (Node.js)
```typescript
import { VesperaBindery } from 'vespera-bindery';

const bindery = new VesperaBindery();
bindery.onCollaboratorJoined((user) => {
  console.log(`${user.name} joined the session`);
});

const codex = await bindery.openCodex('component-uuid');
codex.edit('title', 'New Component Name');
```

### MCP Integration (Python)
```python
from vespera_bindery import CodexManager

manager = CodexManager()
codex = manager.get_codex('component-uuid')
changes = codex.get_pending_operations()
```

## Performance Targets

- **Memory Usage**: ~5:1 ratio (5MB memory for 1MB content)
- **Network Efficiency**: 3:1 to 5:1 compression ratios  
- **Scalability**: 50+ concurrent editors per document
- **Conflict Resolution**: <100ms for typical document merges
- **Offline Sync**: <1 second merge time for day-long offline work

## Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for development guidelines.

## License

GNU Affero General Public License v3.0 (AGPL-3.0)