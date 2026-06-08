@echo off
REM Setup local para Windows (equivalente a "make local")
REM Instala Python y Node si faltan, crea el entorno virtual,
REM instala dependencias, corre migraciones y seed.

setlocal enabledelayedexpansion

REM ============================================================
REM  0. Verificar / instalar Python y Node (via winget)
REM ============================================================

REM --- Detectar winget (necesario para instalar automaticamente) ---
where winget >nul 2>&1
if errorlevel 1 (
    set "NO_WINGET=1"
)

REM --- Python ---
REM Buscamos un Python que REALMENTE funcione. Probamos el lanzador "py"
REM (oficial, no lo pisa el alias de la Microsoft Store) y luego "python".
REM Usamos --version para descartar el stub falso de la Store, que figura
REM en el PATH pero no ejecuta nada.
set "PY="
py -3 --version >nul 2>&1 && set "PY=py -3"
if not defined PY (
    python --version >nul 2>&1 && set "PY=python"
)

if not defined PY (
    echo [0/4] Python no encontrado (o es el stub de la Microsoft Store^).
    if defined NO_WINGET (
        echo ERROR: no tenes Python ni winget. Instala Python manualmente desde:
        echo   https://www.python.org/downloads/
        echo IMPORTANTE: tilda "Add Python to PATH" durante la instalacion.
        exit /b 1
    )
    echo        Instalando Python con winget...
    winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
    set "INSTALLED_SOMETHING=1"
) else (
    echo [0/4] Python ya esta instalado ^(!PY!^).
)

REM --- Node (para el frontend) ---
where node >nul 2>&1
if errorlevel 1 (
    echo        Node no encontrado.
    if defined NO_WINGET (
        echo ATENCION: no tenes Node ni winget. El backend va a funcionar igual,
        echo pero para el frontend instala Node desde: https://nodejs.org/
    ) else (
        echo        Instalando Node LTS con winget...
        winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        set "INSTALLED_SOMETHING=1"
    )
) else (
    echo        Node ya esta instalado.
)

REM --- Si recien instalamos algo, el PATH no se refresca en esta consola ---
if defined INSTALLED_SOMETHING (
    echo.
    echo ============================================================
    echo  Se instalo Python y/o Node.
    echo  CERRA esta ventana, abri una NUEVA terminal y volve a
    echo  correr local.bat para terminar el setup.
    echo ============================================================
    exit /b 0
)

REM ============================================================
REM  1. Crear el entorno virtual si no existe
REM ============================================================
if not exist ".venv\" (
    echo [1/4] Creando entorno virtual...
    !PY! -m venv .venv
    if errorlevel 1 (
        echo ERROR: no se pudo crear el entorno virtual.
        exit /b 1
    )
) else (
    echo [1/4] Entorno virtual ya existe, se omite.
)

REM --- Crear .env desde el ejemplo si no existe ---
if not exist ".env" (
    if exist ".env.example" copy ".env.example" ".env" >nul
)

REM ============================================================
REM  2. Instalar dependencias
REM ============================================================
echo [2/4] Instalando dependencias...
call .venv\Scripts\python.exe -m pip install --upgrade pip
call .venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: fallo la instalacion de dependencias.
    exit /b 1
)

REM ============================================================
REM  3. Correr migraciones
REM ============================================================
echo [3/4] Corriendo migraciones...
call .venv\Scripts\alembic.exe upgrade head
if errorlevel 1 (
    echo ERROR: fallaron las migraciones.
    exit /b 1
)

REM ============================================================
REM  4. Poblar la base con datos de demo
REM ============================================================
echo [4/4] Cargando datos de demo (seed)...
call .venv\Scripts\python.exe seed.py
if errorlevel 1 (
    echo ERROR: fallo el seed.
    exit /b 1
)

echo.
echo Entorno listo. Para levantar el API:
echo   .venv\Scripts\uvicorn.exe app.main:app --reload
echo Para el frontend web:
echo   cd frontend ^&^& npm install ^&^& npm run web

endlocal
