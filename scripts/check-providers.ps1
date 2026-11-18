# Vayu - provider credential check
#
# Verifies the optional server-side providers without ever printing a key.
# Everything here is optional: Vayu degrades to labelled deterministic behaviour
# without any of it, so a FAIL on an unconfigured provider is informational.
#
# Usage:
#   pwsh -File scripts/check-providers.ps1
#   pwsh -File scripts/check-providers.ps1 -City "New Delhi"
#   npm run check:providers
#
# Note: `npm run dev` (Vite) does NOT serve /api/*. Use `vercel dev` to exercise
# the app's own handlers; this script only tests the upstream providers.

[CmdletBinding()]
param(
  [string]$City = 'New Delhi',
  [string]$EnvFile = '.env'
)

$ErrorActionPreference = 'Stop'
$results = [System.Collections.Generic.List[object]]::new()

function Add-Result {
  param([string]$Provider, [string]$Check, [string]$Status, [string]$Detail)
  $results.Add([pscustomobject]@{ Provider = $Provider; Check = $Check; Status = $Status; Detail = $Detail })
}

function Write-Section {
  param([string]$Text)
  Write-Host ''
  Write-Host "== $Text ==" -ForegroundColor Cyan
}

# ---------------------------------------------------------------------------
# Load .env without exporting secrets to the console
# ---------------------------------------------------------------------------
if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      $name = $matches[1]
      $value = $matches[2].Trim().Trim('"').Trim("'")
      if ($value -and -not (Get-Item "env:$name" -ErrorAction SilentlyContinue)) {
        Set-Item "env:$name" $value
      }
    }
  }
  Write-Host "Loaded $EnvFile" -ForegroundColor DarkGray
} else {
  Write-Host "No $EnvFile found; using the current process environment." -ForegroundColor Yellow
}

function Show-KeyShape {
  param([string]$Name, [string]$Value)
  if (-not $Value) { return "$Name = <unset>" }
  return "$Name = <set, $($Value.Length) chars>"
}

$geminiKey = $env:GEMINI_API_KEY
$geminiModel = if ($env:GEMINI_MODEL) { $env:GEMINI_MODEL } else { 'gemini-3.5-flash-lite' }
$dataKey = $env:DATA_GOV_IN_API_KEY
$resourceId = if ($env:DATA_GOV_IN_RESOURCE_ID) { $env:DATA_GOV_IN_RESOURCE_ID } else { '3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69' }

# The public data.gov.in sample key is rate-limited and capped at 10 records.
$SAMPLE_DATA_KEY = '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b'

Write-Section 'Configuration'
Show-KeyShape 'GEMINI_API_KEY' $geminiKey
Write-Host "GEMINI_MODEL = $geminiModel"
Show-KeyShape 'DATA_GOV_IN_API_KEY' $dataKey
Write-Host "DATA_GOV_IN_RESOURCE_ID = $resourceId"

$temp = Join-Path ([System.IO.Path]::GetTempPath()) "vayu-provider-check-$PID"
New-Item -ItemType Directory -Path $temp -Force | Out-Null

try {
  # -------------------------------------------------------------------------
  # 1. Gemini - is the key valid and is the configured model reachable?
  # -------------------------------------------------------------------------
  Write-Section 'Gemini (generativelanguage.googleapis.com)'

  if (-not $geminiKey) {
    Add-Result 'Gemini' 'model list' 'SKIP' 'GEMINI_API_KEY is not set'
    Add-Result 'Gemini' 'generateContent' 'SKIP' 'GEMINI_API_KEY is not set'
  } else {
    $modelsPath = Join-Path $temp 'models.json'
    $modelsCode = curl.exe -s -o $modelsPath -w '%{http_code}' `
      "https://generativelanguage.googleapis.com/v1beta/models?key=$geminiKey"

    if ($modelsCode -eq '200') {
      $models = (Get-Content $modelsPath -Raw | ConvertFrom-Json).models
      $hit = $models | Where-Object { $_.name -eq "models/$geminiModel" }
      if ($hit) {
        $methods = $hit.supportedGenerationMethods -join ','
        Add-Result 'Gemini' 'model list' 'PASS' "$($models.Count) models; models/$geminiModel present ($methods)"
      } else {
        $flash = ($models | Where-Object { $_.name -match 'flash' } | Select-Object -First 8 | ForEach-Object { $_.name }) -join ', '
        Add-Result 'Gemini' 'model list' 'FAIL' "models/$geminiModel is not available to this key. Flash options: $flash"
      }
    } else {
      $body = Get-Content $modelsPath -Raw
      Add-Result 'Gemini' 'model list' 'FAIL' "HTTP $modelsCode - $($body.Trim() -replace '\s+', ' ' | ForEach-Object { $_.Substring(0, [Math]::Min(240, $_.Length)) })"
    }

    # Write the payload to a file. Passing inline JSON through PowerShell strips
    # the quote characters and produces a 400 INVALID_ARGUMENT.
    $bodyPath = Join-Path $temp 'generate.json'
    $payload = @{
      contents         = @(@{ parts = @(@{ text = 'Reply with exactly the word OK and nothing else.' }) })
      generationConfig = @{ maxOutputTokens = 32 }
    } | ConvertTo-Json -Depth 8 -Compress
    [System.IO.File]::WriteAllText($bodyPath, $payload)

    $genPath = Join-Path $temp 'generate-response.json'
    $genCode = curl.exe -s -o $genPath -w '%{http_code}' -X POST `
      "https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=$geminiKey" `
      -H 'Content-Type: application/json' --data-binary "@$bodyPath"

    if ($genCode -eq '200') {
      $gen = Get-Content $genPath -Raw | ConvertFrom-Json
      $text = ($gen.candidates[0].content.parts | Where-Object { $_.text } | ForEach-Object { $_.text }) -join ''
      $finish = $gen.candidates[0].finishReason
      $version = $gen.modelVersion
      $detail = "replied '$($text.Trim())' (finishReason=$finish, modelVersion=$version, tokens=$($gen.usageMetadata.totalTokenCount))"
      Add-Result 'Gemini' 'generateContent' 'PASS' $detail
    } else {
      $body = Get-Content $genPath -Raw
      Add-Result 'Gemini' 'generateContent' 'FAIL' "HTTP $genCode - $($body.Trim() -replace '\s+', ' ' | ForEach-Object { $_.Substring(0, [Math]::Min(240, $_.Length)) })"
    }
  }

  # -------------------------------------------------------------------------
  # 2. data.gov.in - official CPCB station data
  # -------------------------------------------------------------------------
  Write-Section 'data.gov.in (official CPCB station data)'

  if (-not $dataKey) {
    Add-Result 'data.gov.in' 'records' 'SKIP' 'DATA_GOV_IN_API_KEY is not set'
  } else {
    if ($dataKey -eq $SAMPLE_DATA_KEY) {
      Add-Result 'data.gov.in' 'key type' 'WARN' 'Using the public sample key: capped at 10 records and heavily rate-limited. Generate a personal key at https://data.gov.in'
    }

    $dataPath = Join-Path $temp 'datagov.json'
    $queriedCity = $City
    $retryNote = ''

    $encodedCity = [uri]::EscapeDataString($City)
    $url = "https://api.data.gov.in/resource/$resourceId`?api-key=$dataKey&format=json&limit=10&filters%5Bcity%5D=$encodedCity"
    $dataCode = curl.exe -s -o $dataPath -w '%{http_code}' $url
    $parsed = $null
    if ($dataCode -eq '200') {
      try { $parsed = Get-Content $dataPath -Raw | ConvertFrom-Json } catch { $parsed = $null }
    }

    # The dataset stores "Delhi", not "New Delhi". Mirror the adapter, which
    # retries once with the trailing place name rather than reporting nothing.
    if ($dataCode -eq '200' -and $parsed -and [int]$parsed.count -eq 0) {
      $words = @($City -split '\s+' | Where-Object { $_ })
      if ($words.Count -gt 1) {
        $simpler = $words[$words.Count - 1]
        $encodedSimpler = [uri]::EscapeDataString($simpler)
        $url = "https://api.data.gov.in/resource/$resourceId`?api-key=$dataKey&format=json&limit=10&filters%5Bcity%5D=$encodedSimpler"
        $dataCode = curl.exe -s -o $dataPath -w '%{http_code}' $url
        $parsed = $null
        if ($dataCode -eq '200') {
          try { $parsed = Get-Content $dataPath -Raw | ConvertFrom-Json } catch { $parsed = $null }
        }
        $queriedCity = $simpler
        $retryNote = " (exact city '$City' had 0 rows; retried as '$simpler' exactly like /api/aqi)"
      }
    }

    if ($dataCode -eq '429') {
      Add-Result 'data.gov.in' 'records' 'FAIL' 'Rate-limited (HTTP 429). Wait a minute, or use a personal key.'
    } elseif ($dataCode -ne '200') {
      $body = (Get-Content $dataPath -Raw).Trim() -replace '\s+', ' '
      Add-Result 'data.gov.in' 'records' 'FAIL' "HTTP $dataCode - $($body.Substring(0, [Math]::Min(240, $body.Length)))"
    } elseif (-not $parsed) {
      Add-Result 'data.gov.in' 'records' 'FAIL' 'Response was not valid JSON.'
    } elseif ([int]$parsed.count -gt 0) {
      # Show a row with a real number: placeholders like NA / - must not look
      # like a reading, which is the same rule the adapter follows.
      $usable = $parsed.records | Where-Object { "$($_.avg_value)" -match '^\s*\d+(\.\d+)?\s*$' } | Select-Object -First 1
      if (-not $usable) { $usable = $parsed.records[0] }
      $detail = "city='$queriedCity' count=$($parsed.count) total=$($parsed.total); e.g. $($usable.station) / $($usable.pollutant_id)=$($usable.avg_value) @ $($usable.last_update)$retryNote"
      Add-Result 'data.gov.in' 'records' 'PASS' $detail
    } else {
      Add-Result 'data.gov.in' 'records' 'WARN' "city='$City' returned 0 rows even after the trailing-name retry. This resource may not cover the city."
    }
  }
} finally {
  Remove-Item -Path $temp -Recurse -Force -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Section 'Summary'
$results | Format-Table -AutoSize -Wrap Provider, Check, Status, Detail | Out-String -Width 200 | Write-Host

$failed = @($results | Where-Object { $_.Status -eq 'FAIL' })
$passed = @($results | Where-Object { $_.Status -eq 'PASS' })
Write-Host ''
if ($failed.Count -eq 0) {
  if ($passed.Count -eq 0) {
    Write-Host 'Nothing configured. Vayu will use its labelled deterministic fallbacks.' -ForegroundColor Yellow
    Write-Host 'Add credentials to .env (see .env.example) to enable AI and official CPCB data.' -ForegroundColor DarkGray
  } else {
    Write-Host "All $($passed.Count) configured provider check(s) passed." -ForegroundColor Green
  }
  Write-Host 'Next: `vercel dev` to exercise /api/chat, /api/plan and /api/aqi end to end.' -ForegroundColor DarkGray
  exit 0
}

Write-Host "$($failed.Count) configured provider check(s) failed. The app still runs: it falls back to labelled deterministic behaviour." -ForegroundColor Yellow
exit 1
