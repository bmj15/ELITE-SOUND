@echo off
rem Corre a partir de uma copia temporaria: assim a atualizacao pelo git pode
rem substituir este ficheiro sem baralhar a execucao.
if not "%~1"=="--copia" (
  copy /y "%~f0" "%TEMP%\abrir-sistema-bxb.bat" >nul
  "%TEMP%\abrir-sistema-bxb.bat" --copia "%~dp0"
  exit /b
)
chcp 65001 >nul
title Grupo BXB - Sistemas de Gestao
set "RAIZ=%~2"
cd /d "%RAIZ%"
echo A obter a versao mais recente do codigo no GitHub...
where git >nul 2>nul
if errorlevel 1 (
  echo [aviso] Git nao encontrado: abre a versao que ja esta neste computador.
) else (
  git fetch --quiet origin master && git checkout --quiet master && git merge --ff-only --quiet origin/master
  if errorlevel 1 (
    echo [aviso] Nao foi possivel atualizar ^(sem internet ou alteracoes locais^). Abre a versao local.
  ) else (
    for /f "delims=" %%v in ('git log -1 --format^="%%h %%cd" --date^=format:"%%d/%%m/%%Y %%H:%%M"') do echo Versao: %%v
  )
)
rem Abre o sistema no Chrome (os dados ficam guardados no browser)
set "BROWSER="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"

rem Servidor local: http://localhost:8080 (precisa do Node.js)
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo O Node.js nao esta instalado. E preciso para o servidor local.
  echo Vou abrir a pagina de download: instale a versao LTS e volte a abrir este ficheiro.
  start "" https://nodejs.org
  pause
  exit /b 1
)
echo.
echo A arrancar o servidor local...
node "%RAIZ%servidor.js"
echo.
echo O servidor parou. Se apareceu um erro acima, envie-o ao suporte.
pause
