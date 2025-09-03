/* Task Dashboard JavaScript - Interactive functionality */

// This file is injected into the webview and provides interactive functionality
// It's intentionally kept minimal and lightweight

(function() {
    'use strict';
    
    // Initialize dashboard when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        initializeDashboard();
    });
    
    function initializeDashboard() {
        // Set up event listeners that aren't set up in the HTML template
        setupGlobalEventListeners();
        
        // Initialize any dynamic UI elements
        updateRelativeTimes();
        
        // Set up periodic updates
        setInterval(updateRelativeTimes, 60000); // Update every minute
    }
    
    function setupGlobalEventListeners() {
        // Handle keyboard navigation
        document.addEventListener('keydown', function(e) {
            if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                refreshDashboard();
            }
        });
        
        // Handle focus management for accessibility
        document.addEventListener('focusin', function(e) {
            if (e.target.classList.contains('task-item')) {
                e.target.style.outline = '2px solid var(--vscode-focusBorder)';
                e.target.style.outlineOffset = '2px';
            }
        });
        
        document.addEventListener('focusout', function(e) {
            if (e.target.classList.contains('task-item')) {
                e.target.style.outline = '';
                e.target.style.outlineOffset = '';
            }
        });
    }
    
    function updateRelativeTimes() {
        const timeElements = document.querySelectorAll('.task-date, .task-due-date');
        timeElements.forEach(function(element) {
            const dateStr = element.textContent;
            if (dateStr && dateStr.includes('/')) {
                // Could add relative time formatting here
                // For now, keep the simple date format
            }
        });
    }
    
    function refreshDashboard() {
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ type: 'refresh' });
        
        // Show loading indicator
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            const originalContent = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="spinning"><path d="M13.651 4.737A6.991 6.991 0 0 0 8 2C4.69 2 2 4.691 2 8s2.69 6 6 6a6.97 6.97 0 0 0 5.651-2.737l-1.141-1.141A5.505 5.505 0 0 1 8 12.5a4.5 4.5 0 1 1 0-9 5.505 5.505 0 0 1 4.51 2.359L11 7h4V3l-1.349 1.737z"/></svg>';
            refreshBtn.disabled = true;
            
            // Reset after 2 seconds
            setTimeout(function() {
                refreshBtn.innerHTML = originalContent;
                refreshBtn.disabled = false;
            }, 2000);
        }
    }
    
    // Global functions that can be called from the HTML
    window.createNewTask = function() {
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ type: 'createTask', title: 'New Task', priority: 'normal' });
    };
    
    window.openTask = function(taskId) {
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ type: 'openTask', taskId: taskId });
    };
    
    window.openTaskTree = function() {
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ type: 'openTaskTree' });
    };
    
    window.openSettings = function() {
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ type: 'openSettings' });
    };
    
    window.initializeBindery = function() {
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ type: 'initializeBindery' });
    };
    
    // Add some CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        .spinning {
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        .task-item {
            transition: transform 0.1s ease;
        }
        
        .task-item:active {
            transform: scale(0.98);
        }
        
        .fade-in {
            animation: fadeIn 0.3s ease-in;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
    
    // Add fade-in animation to dashboard content when it loads
    setTimeout(function() {
        const dashboardContent = document.querySelector('.dashboard-content');
        if (dashboardContent) {
            dashboardContent.classList.add('fade-in');
        }
    }, 100);
    
})();