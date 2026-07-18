@echo off
title TRAFOE Katalog Generator - wird gestartet

set "APP_DIR=%~dp0"

rem Shortcut creation, the local icon copy, and forcing Explorer to redraw
rem it are all done in create-shortcut.ps1, not as an inline -Command here:
rem batch's own quoting rules made an equivalent one-liner too fragile to
rem maintain (a single em-dash in an unrelated comment once broke cmd.exe's
rem parser for the rest of this file).
rem
rem Kept plain ASCII throughout this file on purpose, same reason.
rem
rem No -AppDir argument passed: %~dp0 always ends with a trailing
rem backslash, and a quoted argument ending in \" is a well-known Windows
rem argument-parsing trap - it silently produced a wrong path inside the
rem script instead of an obvious failure. create-shortcut.ps1 finds its
rem own directory via $PSScriptRoot instead.
powershell -NoProfile -ExecutionPolicy Bypass -File "%APP_DIR%create-shortcut.ps1" >nul 2>&1
ie4uinit.exe -ClearIconCache >nul 2>&1

echo.
echo   TRAFOE Katalog Generator wird gestartet...
echo.
echo   Der Start vom Netzlaufwerk kann bis zu einer Minute dauern,
echo   da das Programm komplett uebertragen und geprueft werden muss.
echo.
echo   Bitte NICHT mehrfach klicken und dieses Fenster nicht schliessen.
echo   Es schliesst sich automatisch, sobald das Programm bereit ist.
echo.
echo   Tipp: Auf dem Desktop wurde eine Verknuepfung mit Icon angelegt -
echo   die kann fuer zukuenftige Starts verwendet werden.
echo.
start "" "%APP_DIR%TRAFOE-Katalog-Generator.exe"
