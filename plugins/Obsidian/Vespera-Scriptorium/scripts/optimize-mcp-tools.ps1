# PowerShell script to add and optimize MCP server configurations
# Helps stay within the 100 tools maximum limit by disabling unnecessary tools

# Configuration paths
$projectConfigPath = "$PSScriptRoot\..\.windsurf\mcp_config.json"
$globalConfigPath = "$env:USERPROFILE\.codeium\windsurf\mcp_config.json"

# Define server configurations with optimized tool sets
$serverConfigurations = @{
    # NATS MCP Server - essential for A2A messaging architecture
    "nats-mcp-server" = @{
        command = "npx"
        args = @("-y", "@modelcontextprotocol/nats-mcp-server")
        env = @{}
        # Keep only NATS-specific tools that are relevant to the A2A messaging
        disabledTools = @(
            "nats_monitor_general",
            "nats_get_server_info"
        )
    }
    
    # GitHub MCP Server - optimized for code search and repository access
    "github-mcp-server" = @{
        command = "docker"
        args = @(
            "run",
            "-i",
            "--rm",
            "-e",
            "GITHUB_PERSONAL_ACCESS_TOKEN",
            "ghcr.io/github/github-mcp-server"
        )
        env = @{
            # Environment variable will be copied from existing config
        }
        # Disable tools not needed for A2A messaging development
        disabledTools = @(
            "create_or_update_file",
            "create_pull_request_review",
            "create_pull_request",
            "create_repository",
            "delete_file",
            "fork_repository",
            "merge_pull_request",
            "search_users",
            "update_pull_request",
            "update_pull_request_branch",
            "get_code_scanning_alert",
            "get_pull_request",
            "get_pull_request_comments",
            "get_pull_request_files",
            "get_pull_request_reviews",
            "get_pull_request_status",
            "get_secret_scanning_alert",
            "list_pull_requests",
            "list_secret_scanning_alerts"
        )
    }
    
    # Memory MCP - essential for tracking A2A architecture relationships
    "memory" = @{
        command = "npx"
        args = @("-y", "@modelcontextprotocol/server-memory")
        env = @{
            # Environment variable will be copied from existing config
        }
        # No disabled tools - all Memory tools are useful for A2A architecture
        disabledTools = @()
    }
    
    # Puppeteer - optimized for web testing
    "Puppeteer" = @{
        command = "npx"
        args = @("-y", "@modelcontextprotocol/server-puppeteer")
        env = @{}
        # Disable less commonly used tools to save on the tool count
        disabledTools = @(
            "puppeteer_pdf",
            "puppeteer_type",
            "puppeteer_press",
            "puppeteer_focus"
        )
    }
    
    # Brave Search - optimized for research
    "brave-search" = @{
        command = "npx"
        args = @("-y", "@modelcontextprotocol/server-brave-search")
        env = @{
            # Environment variable will be copied from existing config
        }
        disabledTools = @(
            "brave_local_search"
        )
    }
    
    # Desktop Commander - optimized for file operations
    "desktop-commander" = @{
        command = "npx.cmd"
        args = @("@wonderwhy-er/desktop-commander@latest")
        disabledTools = @(
            "set_config_value",
            "get_config",
            "get_file_info",
            "list_processes"
        )
    }
}

# Function to update MCP configurations
function Update-McpConfigs {
    param (
        [string]$configPath,
        [hashtable]$serverConfigs
    )

    # Create or read existing config
    if (-not (Test-Path $configPath)) {
        @{ mcpServers = @{} } | ConvertTo-Json -Depth 10 | Set-Content -Path $configPath
        Write-Host "Created new configuration file at: $configPath"
    }
    
    $config = Get-Content -Path $configPath -Raw | ConvertFrom-Json
    
    # Ensure mcpServers exists
    if (-not $config.mcpServers) {
        $config | Add-Member -MemberType NoteProperty -Name "mcpServers" -Value ([PSCustomObject]@{})
    }
    
    # Check for existing server configurations to preserve secrets
    foreach ($serverName in $serverConfigs.Keys) {
        $serverConfig = $serverConfigs[$serverName]
        
        # Check if the server already exists in global config to copy secrets
        if (Test-Path $globalConfigPath) {
            $globalConfig = Get-Content -Path $globalConfigPath -Raw | ConvertFrom-Json
            
            if ($globalConfig.mcpServers.PSObject.Properties[$serverName]) {
                $existingConfig = $globalConfig.mcpServers.PSObject.Properties[$serverName].Value
                
                # Copy environment variables to preserve secrets
                if ($existingConfig.env -and $existingConfig.env.PSObject.Properties) {
                    foreach ($envVar in $existingConfig.env.PSObject.Properties.Name) {
                        if (-not $serverConfig.env.ContainsKey($envVar)) {
                            $serverConfig.env[$envVar] = $existingConfig.env.$envVar
                        }
                    }
                }
            }
        }
        
        # Check if the server already exists in project config to copy secrets
        if ($config.mcpServers.PSObject.Properties[$serverName]) {
            $existingConfig = $config.mcpServers.PSObject.Properties[$serverName].Value
            
            # Copy environment variables to preserve secrets
            if ($existingConfig.env -and $existingConfig.env.PSObject.Properties) {
                foreach ($envVar in $existingConfig.env.PSObject.Properties.Name) {
                    if (-not $serverConfig.env.ContainsKey($envVar)) {
                        $serverConfig.env[$envVar] = $existingConfig.env.$envVar
                    }
                }
            }
        }
        
        # Add or update the server configuration
        $config.mcpServers | Add-Member -MemberType NoteProperty -Name $serverName -Value $serverConfig -Force
        Write-Host "Added/updated server configuration for: $serverName (with optimized tool set)"
    }
    
    # Save the updated config
    $config | ConvertTo-Json -Depth 10 | Set-Content -Path $configPath
    Write-Host "Configuration saved to: $configPath"
    
    # Calculate approximate tool count
    $totalTools = 0
    $toolCounts = @{}
    
    foreach ($serverName in $config.mcpServers.PSObject.Properties.Name) {
        $server = $config.mcpServers.PSObject.Properties[$serverName].Value
        
        # Estimate tool count based on server type
        switch -Wildcard ($serverName) {
            "github-mcp-server" { $baseToolCount = 30 }
            "memory" { $baseToolCount = 8 }
            "nats-mcp-server" { $baseToolCount = 12 }
            "Puppeteer" { $baseToolCount = 10 }
            "brave-search" { $baseToolCount = 2 }
            "desktop-commander" { $baseToolCount = 15 }
            "windows-cli" { $baseToolCount = 5 }
            "mcp-playwright" { $baseToolCount = 20 }
            "sequential-thinking" { $baseToolCount = 1 }
            "context7" { $baseToolCount = 2 }
            default { $baseToolCount = 10 }
        }
        
        # Subtract disabled tools
        $disabledCount = 0
        if ($server.disabledTools) {
            if ($server.disabledTools -is [array]) {
                $disabledCount = $server.disabledTools.Count
            } else {
                # Handle JSON deserialization quirks
                $disabledCount = @($server.disabledTools).Count
            }
        }
        
        $effectiveToolCount = [Math]::Max(1, $baseToolCount - $disabledCount)
        $toolCounts[$serverName] = $effectiveToolCount
        $totalTools += $effectiveToolCount
    }
    
    # Display tool count summary
    Write-Host "`nTool Count Summary:"
    Write-Host "=================="
    foreach ($server in $toolCounts.Keys | Sort-Object) {
        Write-Host "$server : $($toolCounts[$server]) tools"
    }
    Write-Host "----------------"
    Write-Host "Total : $totalTools tools"
    
    if ($totalTools -gt 100) {
        Write-Host "`nWARNING: Estimated tool count exceeds the 100 tool limit!" -ForegroundColor Yellow
        Write-Host "Consider disabling more tools or removing some servers." -ForegroundColor Yellow
    } else {
        Write-Host "`nEstimated tool count is within the 100 tool limit." -ForegroundColor Green
    }
}

# Execute the function
try {
    Write-Host "Optimizing MCP server configurations for A2A messaging architecture..."
    Update-McpConfigs -configPath $projectConfigPath -serverConfigs $serverConfigurations
    Write-Host "Done!" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}