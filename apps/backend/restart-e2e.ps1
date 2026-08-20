$ErrorActionPreference = 'Stop'
Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21.0.11'
Set-Location 'C:\Users\Plus\traco\apps\backend'
& 'C:\Users\Plus\tools\apache-maven-3.9.9\bin\mvn.cmd' -B -DskipTests package 2>&1 | Select-Object -Last 4
Start-Process -FilePath 'C:\Program Files\Java\jdk-21.0.11\bin\java.exe' `
    -ArgumentList '-jar','target\traco-api-0.1.0.jar' `
    -RedirectStandardOutput 'boot.log' -RedirectStandardError 'boot-err.log' -NoNewWindow
Start-Sleep -Seconds 18
& powershell -ExecutionPolicy Bypass -File 'C:\Users\Plus\traco\apps\backend\e2e-cv2.ps1'