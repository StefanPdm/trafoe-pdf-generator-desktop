@echo off
chcp 65001 >nul
title TRAFOE Katalog Generator - wird gestartet
echo.
echo   TRAFOE Katalog Generator wird gestartet...
echo.
echo   Der erste Start vom Netzlaufwerk kann bis zu einer Minute dauern,
echo   da das Programm komplett uebertragen und geprueft werden muss.
echo.
echo   Bitte NICHT mehrfach klicken und dieses Fenster nicht schliessen.
echo   Es schliesst sich automatisch, sobald das Programm bereit ist.
echo.
start "" "%~dp0TRAFOE-Katalog-Generator.exe"
