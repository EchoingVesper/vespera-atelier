#!/usr/bin/env python3
"""
Setup script for Vespera Scriptorium
"""

import os
from setuptools import setup, find_packages

# Read the content of README.md
with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

# Read requirements.txt
with open("requirements.txt", "r", encoding="utf-8") as f:
    requirements = [line.strip() for line in f.readlines() if line.strip() and not line.startswith("#")]

setup(
    name="vespera-scriptorium",
    version="2.0.0",
    author="Echoing Vesper",
    author_email="noreply@github.com",
    description="Vespera Scriptorium - An intelligent platform for document-centric orchestration, task management, and creative workflows",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/EchoingVesper/vespera-atelier",
    project_urls={
        "Homepage": "https://github.com/EchoingVesper/vespera-atelier",
        "Documentation": "https://github.com/EchoingVesper/vespera-atelier/blob/main/packages/vespera-scriptorium/README.md",
        "Issues": "https://github.com/EchoingVesper/vespera-atelier/issues",
        "Releases": "https://github.com/EchoingVesper/vespera-atelier/releases",
        "Repository": "https://github.com/EchoingVesper/vespera-atelier",
    },
    keywords=["mcp", "ai", "vespera", "scriptorium", "claude", "automation", "llm", "workflow", "creative-tools"],
    packages=find_packages(),
    include_package_data=True,
    package_data={
        "vespera_scriptorium": ["config/*.yaml"],
        "vespera_scriptorium_cli": ["config/*.yaml"],
        "": ["config/*.yaml"],  # Include config files from root
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Environment :: Console",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
    install_requires=[req for req in requirements if not req.startswith("pytest") and not req.startswith("#")],
    extras_require={
        "dev": ["pytest>=7.0.0", "pytest-asyncio>=0.21.0"],
        "cli": ["typer>=0.9.0", "rich>=13.0.0"],
    },
    entry_points={
        "console_scripts": [
            "vespera-scriptorium=vespera_scriptorium.__main__:main_sync",
            "vespera-scriptorium-cli=vespera_scriptorium_cli.__main__:main",
        ],
    },
)