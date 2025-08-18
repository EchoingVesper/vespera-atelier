# PowerShell script to consolidate duplicate GitHub MCP servers
# This script merges the 'github' and 'github-mcp-server' configurations

# Configuration path
$configPath = "$PSScriptRoot\..\.windsurf\mcp_config.json"

# Function to consolidate GitHub MCP servers
function Consolidate-GitHubServers {
    param (
        [string]$configPath
    )

    # Read configuration
    if (-not (Test-Path $configPath)) {
        Write-Host "Configuration file not found: $configPath" -ForegroundColor Red
        return
    }
    
    $config = Get-Content -Path $configPath -Raw | ConvertFrom-Json
    
    # Check if both GitHub servers exist
    $hasGithub = $config.mcpServers.PSObject.Properties["github"] -ne $null
    $hasGithubMcp = $config.mcpServers.PSObject.Properties["github-mcp-server"] -ne $null
    
    if (-not ($hasGithub -and $hasGithubMcp)) {
        Write-Host "Both 'github' and 'github-mcp-server' configurations are not present. No consolidation needed."
        return
    }
    
    # Get both configurations
    $githubConfig = $config.mcpServers.PSObject.Properties["github"].Value
    $githubMcpConfig = $config.mcpServers.PSObject.Properties["github-mcp-server"].Value
    
    Write-Host "Found both GitHub configurations. Analyzing..."
    
    # Compare implementations to determine which is better
    $useDocker = $githubMcpConfig.command -eq "docker"
    
    # Create consolidated configuration
    $consolidatedConfig = if ($useDocker) {
        # Use the docker-based implementation as it's typically more robust
        $githubMcpConfig
    } else {
        # Use the npm-based implementation
        $githubConfig
    }
    
    # Merge disabled tools
    $disabledTools = @()
    if ($githubConfig.disabledTools) {
        if ($githubConfig.disabledTools -is [array]) {
            $disabledTools += $githubConfig.disabledTools
        } else {
            $disabledTools += @($githubConfig.disabledTools)
        }
    }
    
    if ($githubMcpConfig.disabledTools) {
        if ($githubMcpConfig.disabledTools -is [array]) {
            $disabledTools += $githubMcpConfig.disabledTools
        } else {
            $disabledTools += @($githubMcpConfig.disabledTools)
        }
    }
    
    # Remove duplicates
    $disabledTools = $disabledTools | Select-Object -Unique
    
    # Update consolidated config with merged disabled tools
    $consolidatedConfig | Add-Member -MemberType NoteProperty -Name "disabledTools" -Value $disabledTools -Force
    
    # Ensure we preserve the GitHub token
    if ($githubConfig.env -and $githubConfig.env.PSObject.Properties["GITHUB_PERSONAL_ACCESS_TOKEN"]) {
        $token = $githubConfig.env.GITHUB_PERSONAL_ACCESS_TOKEN
        
        if (-not $consolidatedConfig.env) {
            $consolidatedConfig | Add-Member -MemberType NoteProperty -Name "env" -Value ([PSCustomObject]@{}) -Force
        }
        
        $consolidatedConfig.env | Add-Member -MemberType NoteProperty -Name "GITHUB_PERSONAL_ACCESS_TOKEN" -Value $token -Force
    }
    
    # Update the configuration with the consolidated server
    # Keep only one GitHub configuration (github-mcp-server) and remove the other
    $newMcpServers = [PSCustomObject]@{}
    
    foreach ($prop in $config.mcpServers.PSObject.Properties) {
        if ($prop.Name -ne "github" -and $prop.Name -ne "github-mcp-server") {
            # Copy all non-GitHub configurations as is
            $newMcpServers | Add-Member -MemberType NoteProperty -Name $prop.Name -Value $prop.Value
        }
    }
    
    # Add the consolidated GitHub configuration
    $newMcpServers | Add-Member -MemberType NoteProperty -Name "github" -Value $consolidatedConfig
    
    # Replace the mcpServers object
    $config.mcpServers = $newMcpServers
    
    # Save the updated configuration
    $config | ConvertTo-Json -Depth 10 | Set-Content -Path $configPath
    
    Write-Host "Successfully consolidated GitHub MCP servers into a single configuration."
    Write-Host "The consolidated configuration uses the $(if ($useDocker) { 'Docker' } else { 'NPM' }) implementation."
    Write-Host "Disabled tools have been merged from both configurations."
    
    # Calculate tool count reduction
    $toolReduction = 10  # Approximate number of tools in a GitHub MCP server
    Write-Host "Estimated tool count reduction: $toolReduction tools"
}

# Execute the function
try {
    Write-Host "Consolidating GitHub MCP servers..."
    Consolidate-GitHubServers -configPath $configPath
    Write-Host "Done!" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}