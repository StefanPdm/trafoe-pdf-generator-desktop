@echo off
chcp 65001 >nul
title TRAFOE Katalog Generator - wird gestartet

set "APP_DIR=%~dp0"
set "SHORTCUT=%USERPROFILE%\Desktop\TRAFOE Katalog Generator.lnk"

rem Refreshed on every run (not just if missing): a .lnk stores an absolute
rem path, so if this folder ever gets moved/re-shared, an old shortcut would
rem silently point nowhere. Icon comes from the .exe's own embedded icon,
rem not a separate file, via the ",0" resource-index syntax.
powershell -NoProfile -Command "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%APP_DIR%Start-TRAFOE-Katalog-Generator.bat'; $s.WorkingDirectory = '%APP_DIR%'; $s.IconLocation = '%APP_DIR%TRAFOE-Katalog-Generator.exe,0'; $s.Save()" >nul 2>&1

echo.
echo   TRAFOE Katalog Generator wird gestartet...
echo.
echo   Der erste Start vom Netzlaufwerk kann bis zu einer Minute dauern,
echo   da das Programm komplett uebertragen und geprueft werden muss.
echo.
echo   Bitte NICHT mehrfach klicken und dieses Fenster nicht schliessen.
echo   Es schliesst sich automatisch, sobald das Programm bereit ist.
echo.
echo   Tipp: Auf dem Desktop wurde eine Verknuepfung mit Icon angelegt -
echo   die kann fuer zukuenftige Starts verwendet werden.
echo.
start "" "%APP_DIR%TRAFOE-Katalog-Generator.exe"
