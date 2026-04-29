$body = @{
  handle = "TestPlayer"
  score = 12345
  level = 1
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri "https://chanclazo-worker.betrnames.workers.dev/score" -Method POST -ContentType "application/json" -Body $body
Write-Output $result
