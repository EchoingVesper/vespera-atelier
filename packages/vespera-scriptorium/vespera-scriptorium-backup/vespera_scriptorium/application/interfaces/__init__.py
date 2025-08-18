"""
Application layer interfaces.

These interfaces define contracts for external services
that the application layer depends on.
"""

from .external_api_client import ExternalApiClient
from .notification_service import NotificationService

__all__ = ["NotificationService", "ExternalApiClient"]
