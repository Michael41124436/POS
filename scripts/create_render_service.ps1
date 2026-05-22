<#
Create Render service using Render API.

USAGE (PowerShell):
  # set env var (recommended)
  $env:RENDER_API_KEY = '<your-render-api-key>'
  .\scripts\create_render_service.ps1

  # or pass api key explicitly
  .\scripts\create_render_service.ps1 -ApiKey '<your-key>' -Repo 'https://github.com/you/your-repo.git' -ServiceName 'online-pos'

SECURITY: Do NOT paste your API key into chat. Run this script locally where your key is private.
#>
[CmdletBinding()]
param(
  [string]$ApiKey = $env:RENDER_API_KEY,
  [string]$Repo = 'https://github.com/Michael41124436/POS.git',
  [string]$ServiceName = 'online-pos',
  [string]$Branch = 'main'
)

if (-not $ApiKey) {
  Write-Error "Render API key not provided. Set the RENDER_API_KEY env var or pass -ApiKey '<key>'"
  exit 1
}

$body = @{
  name = $ServiceName
  repo = $Repo
  branch = $Branch
  env = 'node'
  plan = 'free'
  buildCommand = 'npm install'
  startCommand = 'npm start'
  autoDeploy = $true
}

$bodyJson = $body | ConvertTo-Json -Depth 10

Write-Host "Creating Render service '$ServiceName' from repo: $Repo (branch: $Branch)"

try {
  $response = Invoke-RestMethod -Uri 'https://api.render.com/v1/services' -Method Post -Headers @{ Authorization = "Bearer $ApiKey"; 'Content-Type' = 'application/json' } -Body $bodyJson -ErrorAction Stop
  Write-Host "Render service created successfully."
  $response | ConvertTo-Json -Depth 10 | Out-File -FilePath ./render-create-response.json -Encoding utf8
  Write-Host "Response saved to render-create-response.json"
} catch {
  Write-Error "Failed to create service: $_"
  exit 2
}
