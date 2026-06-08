@echo off
REM Setup local para Windows (equivalente a "make local")
REM Crea el entorno virtual, instala dependencias, corre migraciones y seed.

setlocal

REM --- 1. Crear el entorno virtual si no existe ---
if not exist ".venv\" (
    echo [1/4] Creando entorno virtual...
    python -m venv .venv
    if errorlevel 1 (
        echo ERROR: no se pudo crear el entorno virtual. Tenes Python instalado?
        exit /b 1
    )
) else (
    echo [1/4] Entorno virtual ya existe, se omite.
)

REM --- Crear .env desde el ejemplo si no existe ---
if not exist ".env" (
    if exist ".env.example" copy ".env.example" ".env" >nul
)

REM --- 2. Instalar dependencias ---
echo [2/4] Instalando dependencias...
call .venv\Scripts\python.exe -m pip install --upgrade pip
call .venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: fallo la instalacion de dependencias.
    exit /b 1
)

REM --- 3. Correr migraciones ---
echo [3/4] Corriendo migraciones...
call .venv\Scripts\alembic.exe upgrade head
if errorlevel 1 (
    echo ERROR: fallaron las migraciones.
    exit /b 1
)

REM --- 4. Poblar la base con datos de demo ---
echo [4/4] Cargando datos de demo (seed)...
call .venv\Scripts\python.exe seed.py
if errorlevel 1 (
    echo ERROR: fallo el seed.
    exit /b 1
)

echo.
echo Entorno listo. Para levantar el API:
echo   .venv\Scripts\uvicorn.exe app.main:app --reload

endlocal
