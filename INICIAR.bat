@echo off
title Elite Sound
REM Duplo clique neste ficheiro para arrancar o Elite Sound.
REM Funciona a partir de qualquer pasta onde o repositorio esteja clonado.

cd /d "%~dp0backend"
if errorlevel 1 (
  echo Nao encontrei a pasta "backend" ao lado deste ficheiro.
  echo Confirme no GitHub Desktop que esta no ramo claude/fervent-wright-jy1k79 e faca Pull.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo O Node.js nao esta instalado.
  echo Vou abrir a pagina de download: instale a versao LTS e depois volte a abrir este ficheiro.
  start "" https://nodejs.org
  pause
  exit /b 1
)

echo A instalar/atualizar dependencias (a primeira vez demora alguns minutos)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo Erro ao instalar as dependencias. Envie a mensagem acima ao suporte.
  pause
  exit /b 1
)

if not exist ".env" copy ".env.example" ".env" >nul

echo.
echo A arrancar o servidor. NAO feche esta janela enquanto usa o site.
echo O browser vai abrir em http://localhost:5000
echo Login inicial: admin@elitesound.local / admin123
echo.
start "" cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:5000"
call npm start

echo.
echo O servidor parou. Se apareceu um erro acima, envie-o ao suporte.
pause
