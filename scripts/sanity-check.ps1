param(
    [string]$WebBase = "http://127.0.0.1:3000",
    [string]$ApiBase = "http://127.0.0.1:8010"
)

$ErrorActionPreference = "Stop"
$publicRoutes = @("/", "/map", "/login", "/register", "/join", "/contact-artisan")
$protectedRoutes = @("/admin", "/dashboard", "/post-job")

foreach ($route in $publicRoutes) {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$WebBase$route" -TimeoutSec 20
    if ($response.StatusCode -ne 200) { throw "$route returned $($response.StatusCode)" }
    if ($response.Content -notmatch "mobile-app-nav") { throw "$route is missing the mobile bottom navigation" }
    Write-Output "PASS public $route"
}

foreach ($route in $protectedRoutes) {
    $headers = curl.exe -s -I "$WebBase$route"
    $status = ($headers | Select-String "^HTTP").Line
    $location = ($headers | Select-String "^location:").Line
    if ($status -notmatch "307" -or $location -notmatch "/login") { throw "$route did not redirect to sign in" }
    Write-Output "PASS protected $route"
}

$health = Invoke-RestMethod "$ApiBase/health" -TimeoutSec 20
if ($health.status -ne "ok") { throw "API health check failed" }

$artisans = Invoke-RestMethod "$ApiBase/v1/artisans" -TimeoutSec 20
if ($artisans.Count -ne 0) { throw "Expected a clean database with no artisans" }

$adminStatus = curl.exe -s -o NUL -w "%{http_code}" "$ApiBase/v1/admin/metrics"
if ($adminStatus -ne "401") { throw "Admin API must reject unauthenticated access" }
Write-Output "PASS API $($health.version), clean database, RBAC enforced"
