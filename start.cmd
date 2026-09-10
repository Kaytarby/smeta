@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Оперплан
where node >nul 2>&1
if errorlevel 1 (
  echo Нужен Node.js 22 или новее: https://nodejs.org
  echo Установите LTS и снова запустите этот файл.
  pause
  exit /b 1
)
echo Запускаю Оперплан. Это окно не закрывайте, пока работают коллеги.
echo.
node server.js
echo.
echo Сервер остановлен.
pause
