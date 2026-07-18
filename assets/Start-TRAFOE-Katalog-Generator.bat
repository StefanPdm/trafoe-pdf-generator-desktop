@echo off
title TRAFOE Katalog Generator - wird gestartet

set "APP_DIR=%~dp0"
set "SHORTCUT=%USERPROFILE%\Desktop\TRAFOE Katalog Generator.lnk"

rem Refreshed on every run (not just if missing): a .lnk stores an absolute
rem path, so if this folder ever gets moved or re-shared, an old shortcut
rem would silently point nowhere. Icon comes from the small standalone
rem .ico file, not the .exe's own embedded icon (unreliable to extract from
rem a 245MB file while it's still being read/AV-scanned off a network drive).
rem
rem Deleted before recreating, not just overwritten in place: Windows caches
rem shortcut icons per-file, and an earlier broken version of this script
rem could have already written a blank-icon shortcut at this exact path -
rem overwriting the same file sometimes leaves the stale blank icon cached
rem even once the underlying .lnk is correct. A genuinely new file plus an
rem explicit icon cache clear avoids that.
rem
rem Kept plain ASCII throughout this file on purpose: umlauts and even
rem punctuation like em-dashes caused cmd.exe's parser to desync mid-script
rem and misread later lines as garbled commands, even under chcp 65001 -
rem not worth the fragility for a launcher script.
if exist "%SHORTCUT%" del /f /q "%SHORTCUT%"
powershell -NoProfile -Command "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%APP_DIR%Start-TRAFOE-Katalog-Generator.bat'; $s.WorkingDirectory = '%APP_DIR%'; $s.IconLocation = '%APP_DIR%Trafoe-Logo-small.ico'; $s.Save()" >nul 2>&1
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
