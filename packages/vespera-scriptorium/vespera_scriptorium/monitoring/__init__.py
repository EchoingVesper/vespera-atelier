"""
Monitoring package for the Vespera Scriptorium.

This package provides comprehensive monitoring, hang detection, and performance
analysis tools for the task orchestration system.
"""

from .hang_detection import (
    HangDetector,
    get_hang_detection_statistics,
    hang_protected_operation,
    start_hang_monitoring,
    stop_hang_monitoring,
    with_hang_detection,
)

__all__ = [
    "HangDetector",
    "with_hang_detection",
    "hang_protected_operation",
    "get_hang_detection_statistics",
    "start_hang_monitoring",
    "stop_hang_monitoring",
]
