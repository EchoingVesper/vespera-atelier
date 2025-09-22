# Development Tools

This directory contains development utilities and temporary scripts for Vespera V2.

## Structure

```
dev-tools/
├── temp-scripts/    # Temporary validation and development scripts (gitignored)
├── scratch/         # Scratch space for experiments (gitignored)  
└── README.md        # This file
```

## Usage

### Temporary Scripts (`temp-scripts/`)

Use this directory for:
- Quick validation scripts
- Development debugging tools
- MCP integration testing
- One-off verification scripts

**Note**: This directory is gitignored - files here won't be committed.

### Scratch Space (`scratch/`)

Use this directory for:
- Code experiments
- Prototype implementations  
- Temporary data files
- Development notes

**Note**: This directory is also gitignored.

## Lifecycle

Files in these directories are considered temporary and may be automatically cleaned up by:
- Development scripts
- CI/CD pipelines
- Manual cleanup processes

If you have a script that should be permanent, move it to the appropriate location:
- `tests/` for test files
- Main package directories for permanent utilities
- Documentation for reference materials

## Examples

```bash
# Quick MCP tool validation
echo "mcp__vespera-scriptorium__get_task_dashboard()" > dev-tools/temp-scripts/quick_mcp_test.py

# Template system experiment  
cp templates/examples/meta-prp-basic dev-tools/scratch/my-template-experiment

# Development debugging
echo "import pdb; pdb.set_trace()" > dev-tools/temp-scripts/debug_helper.py
```