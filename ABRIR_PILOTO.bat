@echo off
chcp 65001 >nul 2>&1
title Piloto — Controle de Produção
color 1F

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   PILOTO — CONTROLE DE PRODUÇÃO  v1.0       ║
echo  ║   Digitalização e Integração                ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ── Verifica onde estão os arquivos ──
if not exist "%~dp0index.html" (
    echo  [ERRO] index.html nao encontrado.
    echo  Execute este arquivo na mesma pasta dos HTMLs.
    pause
    exit /b 1
)

cd /d "%~dp0"

:: ── Tenta Python 3 ──
python --version >nul 2>&1
if %errorlevel%==0 (
    echo  [OK] Python encontrado. Iniciando servidor local...
    echo.
    echo  Acesse: http://localhost:8080
    echo  Para encerrar: feche esta janela ou pressione Ctrl+C
    echo.
    start "" "http://localhost:8080"
    python -m http.server 8080
    goto :fim
)

:: ── Tenta Python3 explícito ──
python3 --version >nul 2>&1
if %errorlevel%==0 (
    echo  [OK] Python3 encontrado. Iniciando servidor local...
    echo.
    echo  Acesse: http://localhost:8080
    echo  Para encerrar: feche esta janela ou pressione Ctrl+C
    echo.
    start "" "http://localhost:8080"
    python3 -m http.server 8080
    goto :fim
)

:: ── Tenta py launcher (Windows) ──
py --version >nul 2>&1
if %errorlevel%==0 (
    echo  [OK] Python (py launcher) encontrado. Iniciando...
    echo.
    echo  Acesse: http://localhost:8080
    echo  Para encerrar: feche esta janela ou pressione Ctrl+C
    echo.
    start "" "http://localhost:8080"
    py -m http.server 8080
    goto :fim
)

:: ── Tenta Node.js / npx serve ──
node --version >nul 2>&1
if %errorlevel%==0 (
    echo  [OK] Node.js encontrado. Tentando npx serve...
    echo.
    echo  Acesse: http://localhost:8080
    echo  Para encerrar: feche esta janela ou pressione Ctrl+C
    echo.
    start "" "http://localhost:8080"
    npx --yes serve -p 8080 .
    goto :fim
)

:: ── Sem servidor disponível — abre direto ──
echo  [AVISO] Python e Node.js nao encontrados.
echo.
echo  Abrindo index.html diretamente no navegador...
echo.
echo  DICA: Para melhor experiencia com sincronizacao entre abas,
echo  instale o Python em: https://www.python.org/downloads/
echo  (marque "Add Python to PATH" durante a instalacao)
echo.
start "" "%~dp0index.html"

:fim
pause
