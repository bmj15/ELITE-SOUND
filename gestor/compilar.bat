@echo off
rem Compila o BXB Gestor com o compilador C# que ja vem com o Windows (.NET Framework 4).
rem O resultado fica na pasta do repositorio: "BXB Gestor.exe" (fora do git).
setlocal
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo Nao encontrei o compilador C# do .NET Framework 4 neste Windows.
  if "%~1"=="" pause
  exit /b 1
)
cd /d "%~dp0"
"%CSC%" /nologo /target:winexe /optimize+ /codepage:65001 /win32icon:bxb.ico /out:"..\BXB Gestor.exe" /r:System.Web.Extensions.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll BXBGestor.cs
if errorlevel 1 (
  echo.
  echo A compilacao falhou. Se o BXB Gestor estiver aberto, feche-o ^(Sair, na bandeja^) e tente de novo.
  if "%~1"=="" pause
  exit /b 1
)
echo BXB Gestor.exe criado na pasta do repositorio.
if "%~1"=="" pause
