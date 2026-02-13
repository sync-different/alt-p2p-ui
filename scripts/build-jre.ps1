# Build a minimal JRE for bundling with the Tauri app (Windows).
# Uses jdeps to detect required modules, then jlink to create a stripped runtime.
# Output: src-tauri\resources\jre\

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$JarPath = Join-Path (Split-Path -Parent $ProjectDir) "alt-p2p\target\alt-p2p-0.1.0-SNAPSHOT.jar"
$OutputDir = Join-Path $ProjectDir "src-tauri\resources\jre"

# Resolve JDK tools (jdeps, jlink) via JAVA_HOME or PATH
$JdkBin = $null
if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\jdeps.exe")) {
    $JdkBin = "$env:JAVA_HOME\bin"
} elseif (Get-Command jdeps -ErrorAction SilentlyContinue) {
    $JdkBin = Split-Path (Get-Command jdeps).Source
} else {
    Write-Error "Cannot find JDK tools (jdeps/jlink). Set JAVA_HOME or add JDK bin/ to PATH."
    exit 1
}

$Jdeps = Join-Path $JdkBin "jdeps.exe"
$Jlink = Join-Path $JdkBin "jlink.exe"
Write-Host "Using JDK at: $JdkBin"

# Validate fat JAR exists
if (-not (Test-Path $JarPath)) {
    Write-Error "Fat JAR not found at $JarPath`nRun 'mvn package' in ..\alt-p2p\ first."
    exit 1
}

# Detect required JDK modules
Write-Host "Analyzing module dependencies..."
$Modules = & $Jdeps --print-module-deps --ignore-missing-deps $JarPath 2>$null
Write-Host "Detected modules: $Modules"

# Add jdk.crypto.ec for TLS cipher suite support (BouncyCastle may delegate some ops)
$Modules = "$Modules,jdk.crypto.ec"
Write-Host "Final modules:    $Modules"

# Remove old JRE if present
if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}

# Build minimal JRE
Write-Host "Building custom JRE..."
& $Jlink `
    --add-modules $Modules `
    --output $OutputDir `
    --strip-debug `
    --no-man-pages `
    --no-header-files `
    --compress=2

Write-Host ""
Write-Host "Custom JRE built at: $OutputDir"

$Size = (Get-ChildItem -Recurse $OutputDir | Measure-Object -Property Length -Sum).Sum
Write-Host ("Size: {0:N0} MB" -f ($Size / 1MB))

$JavaVersion = & "$OutputDir\bin\java.exe" -version 2>&1 | Select-Object -First 1
Write-Host "Java: $JavaVersion"
