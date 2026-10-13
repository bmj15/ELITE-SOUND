@echo off
chcp 65001 >nul
title Grupo BXB - Sistemas de Gestao
cd /d "%~dp0"
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
set "PAGINA=%~dp0SISTEMAS\index.html"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%PAGINA%"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%PAGINA%"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
  start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%PAGINA%"
) else (
  start "" "%PAGINA%"
)
timeout /t 3 >nul
