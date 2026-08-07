# Create Desktop Shortcut
$BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = [System.IO.Path]::Combine($desktop, [char]0x0646 + [char]0x0638 + [char]0x0627 + [char]0x0645 + " " + [char]0x0625 + [char]0x062F + [char]0x0627 + [char]0x0631 + [char]0x0629 + " " + [char]0x0648 + [char]0x0643 + [char]0x0627 + [char]0x0644 + [char]0x0629 + " " + [char]0x0627 + [char]0x0644 + [char]0x0633 + [char]0x0641 + [char]0x0631 + ".lnk")
$vbsPath = Join-Path $BaseDir "launch.vbs"
$iconPath = Join-Path $BaseDir "icons\icon-192.png"

$ws = New-Object -COM WScript.Shell
$shortcut = $ws.CreateShortcut($lnkPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$vbsPath`""
$shortcut.WorkingDirectory = $BaseDir
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = "Barakat Al-Manasek Travel Agency System"
$shortcut.WindowStyle = 7
$shortcut.Save()

if (Test-Path $lnkPath) {
    Write-Host "SUCCESS: Shortcut created on desktop!"
} else {
    Write-Host "FAILED"
}
