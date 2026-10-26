@echo off
rem Build Margin on Windows. Requires only Go 1.21+ (https://go.dev/dl/ - BSD licensed).
rem
rem   build.bat          build margin.exe for this computer
rem   build.bat all      cross-build Windows, Linux and macOS binaries into dist\
setlocal
cd /d "%~dp0"
set CGO_ENABLED=0

where go >nul 2>nul
if errorlevel 1 (
  echo Go was not found. Install it from https://go.dev/dl/ and open a new terminal.
  exit /b 1
)

if /i "%1"=="all" goto all

go build -trimpath -ldflags="-s -w" -o margin.exe .
if errorlevel 1 exit /b 1
echo Built margin.exe - run it with:  margin.exe C:\path\to\your\notes
exit /b 0

:all
if not exist dist mkdir dist
for %%T in (windows/amd64 windows/arm64 linux/amd64 linux/arm64 darwin/amd64 darwin/arm64) do call :one %%T
exit /b 0

:one
for /f "tokens=1,2 delims=/" %%a in ("%1") do (set GOOS=%%a& set GOARCH=%%b)
set OUT=dist\margin-%GOOS%-%GOARCH%
if "%GOOS%"=="windows" set OUT=%OUT%.exe
echo building %OUT%
go build -trimpath -ldflags="-s -w" -o %OUT% .
exit /b 0
