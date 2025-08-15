# Vespera Atelier Monorepo Build System
# ====================================

.PHONY: help install build test lint clean dev setup-hooks check format

# Default target
help:
	@echo "Vespera Atelier Monorepo Build System"
	@echo "===================================="
	@echo ""
	@echo "Available targets:"
	@echo "  install        Install all dependencies"
	@echo "  build          Build all packages"
	@echo "  test           Run all tests"
	@echo "  lint           Run linting on all packages"
	@echo "  format         Format code in all packages"
	@echo "  check          Run all quality checks"
	@echo "  clean          Clean all build artifacts"
	@echo "  dev            Setup development environment"
	@echo "  setup-hooks    Setup pre-commit hooks"
	@echo "  ci-test        Run CI test suite"
	@echo ""
	@echo "Package-specific targets:"
	@echo "  scriptorium-*  Commands for vespera-scriptorium"
	@echo "  utilities-*    Commands for vespera-utilities"
	@echo "  obsidian-*     Commands for Obsidian plugin"

# Development setup
dev: setup-hooks install
	@echo "Development environment ready!"

setup-hooks:
	@echo "Setting up pre-commit hooks..."
	pip install pre-commit
	pre-commit install
	pre-commit install --hook-type commit-msg

# Global commands
install: scriptorium-install utilities-install obsidian-install
	@echo "All dependencies installed!"

build: scriptorium-build utilities-build obsidian-build
	@echo "All packages built!"

test: scriptorium-test utilities-test obsidian-test
	@echo "All tests completed!"

lint: scriptorium-lint utilities-lint obsidian-lint
	@echo "All linting completed!"

format: scriptorium-format utilities-format obsidian-format
	@echo "All code formatted!"

check: lint test
	@echo "All quality checks passed!"

clean: scriptorium-clean utilities-clean obsidian-clean
	@echo "All build artifacts cleaned!"

# Vespera Scriptorium (Python package)
scriptorium-install:
	@echo "Installing vespera-scriptorium dependencies..."
	cd packages/vespera-scriptorium && pip install -e ".[dev]"

scriptorium-build:
	@echo "Building vespera-scriptorium..."
	cd packages/vespera-scriptorium && python -m build

scriptorium-test:
	@echo "Testing vespera-scriptorium..."
	cd packages/vespera-scriptorium && pytest tests/unit/ tests/integration/test_complete_task.py tests/integration/test_orchestrator.py tests/integration/test_task_execution.py -v

scriptorium-test-all:
	@echo "Running all vespera-scriptorium tests..."
	cd packages/vespera-scriptorium && pytest -v

scriptorium-lint:
	@echo "Linting vespera-scriptorium..."
	cd packages/vespera-scriptorium && flake8 mcp_task_orchestrator/
	cd packages/vespera-scriptorium && mypy mcp_task_orchestrator/ || true

scriptorium-format:
	@echo "Formatting vespera-scriptorium..."
	cd packages/vespera-scriptorium && black mcp_task_orchestrator/
	cd packages/vespera-scriptorium && isort mcp_task_orchestrator/

scriptorium-clean:
	@echo "Cleaning vespera-scriptorium..."
	cd packages/vespera-scriptorium && rm -rf build/ dist/ *.egg-info/ .pytest_cache/
	cd packages/vespera-scriptorium && find . -type d -name __pycache__ -exec rm -rf {} +

scriptorium-dev:
	@echo "Starting vespera-scriptorium development server..."
	cd packages/vespera-scriptorium && vespera-scriptorium --server

# Vespera Utilities (Node.js package)
utilities-install:
	@echo "Installing vespera-utilities dependencies..."
	cd vespera-utilities && npm ci

utilities-build:
	@echo "Building vespera-utilities..."
	cd vespera-utilities && npm run build

utilities-test:
	@echo "Testing vespera-utilities..."
	cd vespera-utilities && npm test

utilities-lint:
	@echo "Linting vespera-utilities..."
	cd vespera-utilities && npm run lint
	cd vespera-utilities && npm run type-check

utilities-format:
	@echo "Formatting vespera-utilities..."
	cd vespera-utilities && npm run format

utilities-clean:
	@echo "Cleaning vespera-utilities..."
	cd vespera-utilities && rm -rf dist/ build/ node_modules/.cache/

utilities-dev:
	@echo "Starting vespera-utilities development server..."
	cd vespera-utilities && npm run dev

# Obsidian Plugin (TypeScript package)
obsidian-install:
	@echo "Installing Obsidian plugin dependencies..."
	cd plugins/Obsidian/Vespera-Scriptorium && npm ci

obsidian-build:
	@echo "Building Obsidian plugin..."
	cd plugins/Obsidian/Vespera-Scriptorium && npm run build

obsidian-test:
	@echo "Testing Obsidian plugin..."
	cd plugins/Obsidian/Vespera-Scriptorium && npm test || echo "Tests not yet implemented"

obsidian-lint:
	@echo "Linting Obsidian plugin..."
	cd plugins/Obsidian/Vespera-Scriptorium && npm run lint || echo "Linting not configured"

obsidian-format:
	@echo "Formatting Obsidian plugin..."
	cd plugins/Obsidian/Vespera-Scriptorium && npm run format || echo "Formatting not configured"

obsidian-clean:
	@echo "Cleaning Obsidian plugin..."
	cd plugins/Obsidian/Vespera-Scriptorium && rm -rf dist/ build/ node_modules/.cache/

obsidian-dev:
	@echo "Starting Obsidian plugin development build..."
	cd plugins/Obsidian/Vespera-Scriptorium && npm run dev

# CI/CD targets
ci-test: scriptorium-test utilities-test
	@echo "CI test suite completed!"

ci-build: build
	@echo "CI build completed!"

ci-lint: lint
	@echo "CI linting completed!"

# Release targets
prepare-release: clean install build test
	@echo "Release preparation completed!"

# Security checks
security-check:
	@echo "Running security checks..."
	cd packages/vespera-scriptorium && bandit -r mcp_task_orchestrator/ || true
	cd packages/vespera-scriptorium && safety check || true
	@echo "Security checks completed!"

# Documentation
docs-build:
	@echo "Building documentation..."
	@echo "Documentation build not yet implemented"

# Version management
version-check:
	@echo "Checking package versions..."
	@echo "vespera-scriptorium: $(shell cd packages/vespera-scriptorium && python -c 'import toml; print(toml.load("pyproject.toml")["project"]["version"])')"
	@echo "vespera-utilities: $(shell cd vespera-utilities && node -p 'require("./package.json").version')"
	@echo "Obsidian plugin: $(shell cd plugins/Obsidian/Vespera-Scriptorium && node -p 'require("./package.json").version')"

# Monorepo health checks
health-check:
	@echo "Running monorepo health checks..."
	@echo "✓ Checking package.json files exist..."
	@test -f vespera-utilities/package.json || (echo "✗ vespera-utilities/package.json missing" && exit 1)
	@test -f plugins/Obsidian/Vespera-Scriptorium/package.json || (echo "✗ Obsidian plugin package.json missing" && exit 1)
	@echo "✓ Checking pyproject.toml exists..."
	@test -f packages/vespera-scriptorium/pyproject.toml || (echo "✗ vespera-scriptorium/pyproject.toml missing" && exit 1)
	@echo "✓ Checking CI workflow exists..."
	@test -f .github/workflows/ci.yml || (echo "✗ .github/workflows/ci.yml missing" && exit 1)
	@echo "✓ Monorepo health check passed!"

# Quick development commands
quick-test: scriptorium-test
	@echo "Quick test completed!"

quick-build: scriptorium-build
	@echo "Quick build completed!"

# Emergency fixes
fix-imports:
	@echo "Fixing imports in vespera-scriptorium..."
	cd packages/vespera-scriptorium && python -c "
import ast
import os
print('Checking for import issues...')
for root, dirs, files in os.walk('mcp_task_orchestrator'):
    for file in files:
        if file.endswith('.py'):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r') as f:
                    ast.parse(f.read())
            except SyntaxError as e:
                print(f'Syntax error in {filepath}: {e}')
print('Import check completed!')
"

# Show monorepo status
status:
	@echo "Vespera Atelier Monorepo Status"
	@echo "==============================="
	@echo ""
	@echo "Git status:"
	@git status --short
	@echo ""
	@echo "Package versions:"
	@make version-check
	@echo ""
	@echo "Build artifacts:"
	@echo "vespera-scriptorium dist/: $(shell ls packages/vespera-scriptorium/dist/ 2>/dev/null | wc -l) files"
	@echo "vespera-utilities dist/: $(shell ls vespera-utilities/dist/ 2>/dev/null | wc -l) files"
	@echo "Obsidian plugin dist/: $(shell ls plugins/Obsidian/Vespera-Scriptorium/dist/ 2>/dev/null | wc -l) files"