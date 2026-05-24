@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

where docker >nul 2>nul
if errorlevel 1 (
  echo Missing required command: docker
  exit /b 1
)

where curl >nul 2>nul
if errorlevel 1 (
  echo Missing required command: curl
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo Docker daemon is not running.
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo Docker Compose plugin is not available.
  exit /b 1
)

echo Starting full system with Docker Compose...
docker compose up -d --build
if errorlevel 1 exit /b 1

call :wait_for_http "Student Portal API" "http://localhost:8000/" 60 || exit /b 1
call :wait_for_http "Student Portal frontend" "http://localhost:8080/" 60 || exit /b 1
call :wait_for_http "Timetable API" "http://localhost:8001/" 60 || exit /b 1
call :wait_for_http "Timetable frontend" "http://localhost:5174/" 60 || exit /b 1
call :wait_for_bootstrap 60 || exit /b 1

echo.
echo System is ready.
echo.
echo Student Portal frontend: http://localhost:8080
echo Student Portal API:      http://localhost:8000
echo Timetable frontend:      http://localhost:5174
echo Timetable API:           http://localhost:8001
echo.
echo Demo accounts:
echo - Admin: admin / admin
echo - Teacher: gvungdung / gvungdung
echo - Teacher: gvaiml / gvaiml
echo - Student: 23630781 / 23630781
echo - Student: 23630761 / 23630761
exit /b 0

:wait_for_http
set "SERVICE_NAME=%~1"
set "SERVICE_URL=%~2"
set "MAX_ATTEMPTS=%~3"

for /L %%I in (1,1,%MAX_ATTEMPTS%) do (
  curl -fsS "%SERVICE_URL%" >nul 2>nul
  if not errorlevel 1 (
    echo %SERVICE_NAME% is ready: %SERVICE_URL%
    exit /b 0
  )
  echo Waiting for %SERVICE_NAME% ^(%%I/%MAX_ATTEMPTS%%^)...
  timeout /t 5 /nobreak >nul
)

echo %SERVICE_NAME% did not become ready: %SERVICE_URL%
exit /b 1

:wait_for_bootstrap
set "MAX_ATTEMPTS=%~1"

for /L %%I in (1,1,%MAX_ATTEMPTS%) do (
  docker inspect bootstrap-demo >nul 2>nul
  if errorlevel 1 (
    echo Waiting for bootstrap-demo container ^(%%I/%MAX_ATTEMPTS%%^)...
    timeout /t 5 /nobreak >nul
  ) else (
    for /f "usebackq tokens=1,2" %%A in (`docker inspect -f "{{.State.Status}} {{.State.ExitCode}}" bootstrap-demo`) do (
      if "%%A %%B"=="exited 0" (
        echo Demo data bootstrap completed.
        exit /b 0
      )
      if "%%A"=="exited" (
        echo bootstrap-demo failed with state: %%A %%B
        docker logs bootstrap-demo
        exit /b 1
      )
    )
    echo Waiting for bootstrap-demo to finish ^(%%I/%MAX_ATTEMPTS%%^)...
    timeout /t 5 /nobreak >nul
  )
)

echo bootstrap-demo did not finish in time.
docker logs bootstrap-demo
exit /b 1
