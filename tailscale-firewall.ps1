# Tailscale Firewall Rules — allow all outbound traffic for Tailscale
# Run as Administrator: right-click Start -> Windows Terminal (Admin), then:
#   cd D:\AiTools\freellmapi
#   powershell -ExecutionPolicy Bypass -File .\tailscale-firewall.ps1

$ruleNameOut = 'Tailscale - Allow Outbound'

$tailscalePaths = @(
    "$env:ProgramFiles\Tailscale\tailscale.exe"
    "$env:ProgramFiles\Tailscale\tailscaled.exe"
    "$env:LocalAppData\Tailscale\tailscale.exe"
    "$env:LocalAppData\Tailscale\tailscaled.exe"
)

$foundPath = $null
foreach ($p in $tailscalePaths) {
    if (Test-Path $p) {
        $foundPath = $p
        break
    }
}

if (-not $foundPath) {
    try {
        $foundPath = (Get-Command tailscale -ErrorAction Stop).Source
    } catch {
        Write-Host 'Tailscale binary not found — using program name only.' -ForegroundColor Yellow
        $foundPath = 'tailscale.exe'
    }
}

Write-Host "Using Tailscale binary: $foundPath" -ForegroundColor Cyan

# Remove existing outbound rule (if any)
$existing = Get-NetFirewallRule -DisplayName "$ruleNameOut*" -ErrorAction SilentlyContinue
if ($existing) { $existing | Remove-NetFirewallRule }

# Outbound rule — allow all traffic for Tailscale
New-NetFirewallRule -DisplayName $ruleNameOut `
    -Direction Outbound `
    -Program "$foundPath" `
    -Action Allow `
    -Profile Any `
    -Protocol Any `
    -LocalAddress Any `
    -RemoteAddress Any `
    -Description 'Allow all outbound traffic for Tailscale'

Write-Host "Created outbound rule: $ruleNameOut" -ForegroundColor Green
Write-Host 'Done.' -ForegroundColor Green