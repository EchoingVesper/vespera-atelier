"""
CORS Middleware Configuration

Cross-Origin Resource Sharing configuration for plugin integration.
Allows VS Code and Obsidian plugins to access the API from different origins.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List


def setup_cors_middleware(app: FastAPI) -> None:
    """
    Configure CORS middleware for plugin integration.
    
    Allows plugins running in different contexts (VS Code, Obsidian)
    to access the API from various origins.
    """
    
    # Allowed origins for plugin access
    allowed_origins = [
        # VS Code plugin origins
        "vscode-webview://",
        "vscode-file://",
        "https://vscode.dev",
        "https://github.dev",
        
        # Obsidian plugin origins
        "app://obsidian.md",
        "capacitor://localhost",
        "http://localhost",
        "https://obsidian.md",
        
        # Development origins
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8080",
        
        # Production origins (would be configured based on deployment)
        "https://api.vespera.dev",
        "https://plugins.vespera.dev",
    ]
    
    # Allowed headers for plugin requests
    allowed_headers = [
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Plugin-ID",
        "X-Plugin-Version",
        "X-Request-ID",
        "X-Correlation-ID",
        "X-Source-File",
        "X-Source-Line",
        "X-Note-Path",
        "X-Vault-Name",
        "Cache-Control",
        "Pragma",
    ]
    
    # Allowed methods
    allowed_methods = [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
        "HEAD"
    ]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=allowed_methods,
        allow_headers=allowed_headers,
        expose_headers=[
            "X-Total-Count",
            "X-Page-Count", 
            "X-Per-Page",
            "X-Current-Page",
            "X-Rate-Limit-Remaining",
            "X-Rate-Limit-Reset",
            "X-Response-Time",
            "X-Request-ID"
        ],
        max_age=3600,  # Cache preflight requests for 1 hour
    )


def setup_development_cors(app: FastAPI) -> None:
    """
    Configure permissive CORS for development environments.
    
    WARNING: Only use in development! This allows all origins.
    """
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allow all origins
        allow_credentials=True,
        allow_methods=["*"],  # Allow all methods
        allow_headers=["*"],  # Allow all headers
        expose_headers=["*"],
        max_age=3600,
    )