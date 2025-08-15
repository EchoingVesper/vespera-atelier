"""
Universal Installer for Vespera Scriptorium

This module provides comprehensive installation lifecycle management
for the Vespera Scriptorium project, supporting multiple installation
modes, sources, and MCP client integration.
"""

from .core import UniversalInstaller
from .models import (
    InstallationScope,
    InstallationSource, 
    OperationType,
    InstallerConfig,
    InstallationEnvironment,
    InstallationStatus
)

__all__ = [
    "UniversalInstaller",
    "InstallationScope",
    "InstallationSource",
    "OperationType", 
    "InstallerConfig",
    "InstallationEnvironment",
    "InstallationStatus"
]