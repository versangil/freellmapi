param([Switch]$Dev)

$hermesNode = "C:\Users\Ver\AppData\Local\hermes\node"
$env:PATH = "$hermesNode;$env:PATH"

if ($Dev) {
  Write-Host "Starting in DEV mode (HMR on port 5173)..." -ForegroundColor Cyan
  & "$hermesNode\npm.cmd" run dev
} else {
  Write-Host "Starting in PRODUCTION mode (port 3001)..." -ForegroundColor Green
  $env:NODE_ENV = "production"
  $log = "D:\AiTools\freellmapi\prod.log"
  $errLog = "D:\AiTools\freellmapi\prod.err.log"
  $psi = Start-Process -NoNewWindow -PassThru -FilePath "$hermesNode\npm.cmd" `
    -ArgumentList "run start -w server" `
    -WorkingDirectory "D:\AiTools\freellmapi" `
    -RedirectStandardOutput $log -RedirectStandardError $errLog
  Start-Sleep -Seconds 3
  Write-Host "Server PID: $($psi.Id)" -ForegroundColor Yellow
  Write-Host "Dashboard: http://localhost:3001" -ForegroundColor Green
  Write-Host "API:       http://localhost:3001/v1/chat/completions" -ForegroundColor Green
  Write-Host "Logs:      $log" -ForegroundColor Gray
}
