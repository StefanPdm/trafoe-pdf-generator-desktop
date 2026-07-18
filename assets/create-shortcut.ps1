# $AppDir deliberately isn't passed in as a -File script argument: a
# trailing backslash immediately before the closing quote in a quoted
# command-line argument is a well-known Windows argument-parsing trap, and
# passing the batch's %APP_DIR% (which %~dp0 always ends with \) that way
# was silently producing a wrong path here - Copy-Item failed, but
# SilentlyContinue below swallowed the error, so the shortcut still got
# created, just pointing at a local icon file that was never actually
# written. $PSScriptRoot avoids the whole problem: it's how the running
# script finds its own directory, no argument-passing involved.
$AppDir = $PSScriptRoot

$ErrorActionPreference = 'SilentlyContinue'

$shortcutPath = Join-Path $env:USERPROFILE 'Desktop\TRAFOE Katalog Generator.lnk'
$iconDir = Join-Path $env:LOCALAPPDATA 'TRAFOE Katalog Generator'
$localIcon = Join-Path $iconDir 'Trafoe-Logo-small.ico'
$sourceIcon = Join-Path $AppDir 'Trafoe-Logo-small.ico'

# Explorer deliberately avoids resolving shortcut icons that live on a
# network path (stays responsive on slow links), so the icon is copied
# locally first and the shortcut points at that copy, not the one still
# sitting in $AppDir.
if (-not (Test-Path $iconDir)) {
    New-Item -ItemType Directory -Path $iconDir -Force | Out-Null
}
Copy-Item -Path $sourceIcon -Destination $localIcon -Force

# Deleted before recreating, not just overwritten in place: Windows caches
# shortcut icons per-file, and an earlier broken version could have already
# written a blank-icon shortcut at this exact path.
if (Test-Path $shortcutPath) {
    Remove-Item -Path $shortcutPath -Force
}

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $AppDir 'Start-TRAFOE-Katalog-Generator.bat'
$shortcut.WorkingDirectory = $AppDir
$shortcut.IconLocation = $localIcon
$shortcut.Save()

# Force Explorer to specifically re-read this shortcut's icon rather than
# relying on the blunter, global ie4uinit -ClearIconCache alone: this is
# the actual documented Shell API for "this item changed, please redraw
# it", more targeted than a full cache clear.
Add-Type -Namespace Win32Shell -Name NativeMethods -MemberDefinition @'
[DllImport("shell32.dll")]
public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
'@

$SHCNE_UPDATEITEM = 0x00002000
$SHCNF_PATHW = 0x0005
$pathPtr = [System.Runtime.InteropServices.Marshal]::StringToHGlobalUni($shortcutPath)
try {
    [Win32Shell.NativeMethods]::SHChangeNotify($SHCNE_UPDATEITEM, $SHCNF_PATHW, $pathPtr, [IntPtr]::Zero)
} finally {
    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($pathPtr)
}
