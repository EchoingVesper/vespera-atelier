# PowerShell script to copy specific MCP configurations from global to project-specific settings
# Without displaying any secrets or API keys - Non-interactive version

# Configuration paths
$globalConfigPath = "$env:USERPROFILE\.codeium\windsurf\mcp_config.json"
$projectConfigPath = "$PSScriptRoot\..\.windsurf\mcp_config.json"

# Ensure the .windsurf directory exists
$windsurfDir = "$PSScriptRoot\..\.windsurf"
if (-not (Test-Path $windsurfDir)) {
    New-Item -ItemType Directory -Path $windsurfDir -Force | Out-Null
    Write-Host "Created .windsurf directory"
}

# Specific servers to move - optimized for A2A messaging architecture
$serversToMove = @("github-mcp-server", "memory")

# Function to safely merge MCP configurations
function Merge-McpConfigs {
    param (
        [string]$sourceConfigPath,
        [string]$targetConfigPath,
        [string[]]$serversToMove
    )

    # Read configurations
    $sourceConfig = Get-Content -Path $sourceConfigPath -Raw | ConvertFrom-Json
    
    # Create target config if it doesn't exist
    if (-not (Test-Path $targetConfigPath)) {
        @{ mcpServers = @{} } | ConvertTo-Json -Depth 10 | Set-Content -Path $targetConfigPath
        Write-Host "Created new target configuration file"
    }
    
    $targetConfig = Get-Content -Path $targetConfigPath -Raw | ConvertFrom-Json
    
    # Ensure mcpServers exists in target
    if (-not $targetConfig.mcpServers) {
        $targetConfig | Add-Member -MemberType NoteProperty -Name "mcpServers" -Value ([PSCustomObject]@{})
    }
    
    # Copy selected servers
    foreach ($serverName in $serversToMove) {
        if ($sourceConfig.mcpServers.PSObject.Properties[$serverName]) {
            $serverConfig = $sourceConfig.mcpServers.PSObject.Properties[$serverName].Value
            
            # Convert to PSObject to make it mutable
            $targetConfig.mcpServers | Add-Member -MemberType NoteProperty -Name $serverName -Value $serverConfig -Force
            
            Write-Host "Moved server configuration for: $serverName (without displaying secrets)"
        } else {
            Write-Host "Server not found in source config: $serverName" -ForegroundColor Yellow
        }
    }
    
    # Save the updated target config
    $targetConfig | ConvertTo-Json -Depth 10 | Set-Content -Path $targetConfigPath
    Write-Host "Configuration saved to: $targetConfigPath"
}

# Execute the function
try {
    Write-Host "Moving MCP configurations from global to project-specific settings..."
    Write-Host "Selected servers: $($serversToMove -join ', ')"
    Merge-McpConfigs -sourceConfigPath $globalConfigPath -targetConfigPath $projectConfigPath -serversToMove $serversToMove
    Write-Host "Done!" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}