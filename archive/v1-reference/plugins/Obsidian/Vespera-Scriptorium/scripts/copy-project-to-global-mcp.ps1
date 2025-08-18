# PowerShell script to copy MCP configurations from project-specific to global settings
# Without displaying any secrets or API keys

# Configuration paths
$projectConfigPath = "$PSScriptRoot\..\.windsurf\mcp_config.json"
$globalConfigPath = "$env:USERPROFILE\.codeium\windsurf\mcp_config.json"

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
    
    # Move specified servers or prompt for selection
    if (-not $serversToMove -or $serversToMove.Count -eq 0) {
        Write-Host "Available MCP servers in project config:"
        $serverIndex = 1
        $serverOptions = @{}
        
        foreach ($serverName in $sourceConfig.mcpServers.PSObject.Properties.Name) {
            Write-Host "$serverIndex. $serverName"
            $serverOptions[$serverIndex] = $serverName
            $serverIndex++
        }
        
        Write-Host "Enter the numbers of servers to move (comma-separated), or 'all' for all servers:"
        $selection = Read-Host
        
        if ($selection -eq "all") {
            $serversToMove = $sourceConfig.mcpServers.PSObject.Properties.Name
        } else {
            $selectedIndices = $selection -split ',' | ForEach-Object { $_.Trim() }
            $serversToMove = $selectedIndices | ForEach-Object { $serverOptions[$_] }
        }
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
    Write-Host "Moving MCP configurations from project-specific to global settings..."
    Merge-McpConfigs -sourceConfigPath $projectConfigPath -targetConfigPath $globalConfigPath
    Write-Host "Done!" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}