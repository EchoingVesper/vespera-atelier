"""
API Routers Package

Contains all FastAPI routers for the Vespera V2 REST API.
"""

from . import tasks, search, projects, roles, plugins

__all__ = ["tasks", "search", "projects", "roles", "plugins"]