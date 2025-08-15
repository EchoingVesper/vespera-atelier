# Switch Workspace Package

Quick command to switch between packages in the monorepo.

## Available Packages

- `vespera-scriptorium` - MCP task orchestrator backend
- `vespera-atelier` - Platform coordination services  
- `vespera-utilities` - Shared utilities
- `obsidian-plugin` - Obsidian Vespera-Scriptorium plugin

## Usage

```bash
# Switch to vespera-scriptorium
cd packages/vespera-scriptorium

# Switch to vespera-atelier
cd packages/vespera-atelier

# Switch to utilities
cd packages/vespera-utilities

# Switch to Obsidian plugin
cd plugins/Obsidian/Vespera-Scriptorium

# Return to monorepo root
cd /home/aya/dev/monorepo/vespera-atelier
```

## Package-Specific Commands

### Vespera Scriptorium

```bash
cd packages/vespera-scriptorium
pip install -e ".[dev]"
pytest tests/
```

### Vespera Atelier

```bash
cd packages/vespera-atelier
# Package-specific commands here
```

### Obsidian Plugin

```bash
cd plugins/Obsidian/Vespera-Scriptorium
npm install
npm run dev
```
