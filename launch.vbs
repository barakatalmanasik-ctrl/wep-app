' launch.vbs - server + browser only (watchdog launched by BAT)

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
portFile = scriptDir & "\server.port"
pidFile = scriptDir & "\server.pid"
serverScript = scriptDir & "\server.ps1"

Set ws = CreateObject("WScript.Shell")

KillOrphanedServers ws, fso, pidFile
CleanFile portFile
CleanFile pidFile

serverAlive = False
If IsPortListening(8000) Then
    serverAlive = True
    targetPort = 8000
End If

If Not serverAlive Then
    targetPort = FindAvailablePort(8000)
    ws.CurrentDirectory = scriptDir
    psCmd = "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File """ & serverScript & """ -Port " & targetPort
    ws.Run psCmd, 0, False

    ready = False
    For i = 1 To 200
        WScript.Sleep 100
        If IsPortListening(targetPort) Then
            ready = True
            Exit For
        End If
    Next

    If Not ready Then
        MsgBox "Failed to start server within 20 seconds.", 16, "Error"
        WScript.Quit 1
    End If

    On Error Resume Next
    Set f = fso.CreateTextFile(portFile, True)
    f.Write targetPort
    f.Close
    On Error GoTo 0
End If

RunBrowser ws, fso, targetPort
WScript.Quit

' === Helpers ===

Function IsPortListening(port)
    On Error Resume Next
    Set tcp = CreateObject("System.Net.Sockets.TcpClient")
    tcp.Connect "127.0.0.1", port
    connected = (Err.Number = 0)
    If connected Then tcp.Close
    Set tcp = Nothing
    On Error GoTo 0
    IsPortListening = connected
End Function

Function FindAvailablePort(startPort)
    FindAvailablePort = startPort
    For i = 0 To 49
        testPort = startPort + i
        If Not IsPortListening(testPort) Then
            FindAvailablePort = testPort
            Exit Function
        End If
    Next
End Function

Sub CleanFile(path)
    On Error Resume Next
    If fso.FileExists(path) Then fso.DeleteFile path, True
    On Error GoTo 0
End Sub

Sub KillOrphanedServers(ws, fso, pidFile)
    If fso.FileExists(pidFile) Then
        On Error Resume Next
        pid = Trim(fso.OpenTextFile(pidFile, 1).ReadAll)
        If Len(pid) > 0 Then
            ws.Run "taskkill /F /PID " & pid & " >nul 2>&1", 0, True
        End If
        On Error GoTo 0
    End If
    WScript.Sleep 500
End Sub

Sub RunBrowser(ws, fso, port)
    chromePath = ""
    p1 = ws.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe"
    p2 = ws.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe"
    p3 = ws.ExpandEnvironmentStrings("%LocalAppData%") & "\Google\Chrome\Application\chrome.exe"
    p4 = ws.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
    p5 = ws.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe"

    If fso.FileExists(p1) Then chromePath = p1
    If chromePath = "" And fso.FileExists(p2) Then chromePath = p2
    If chromePath = "" And fso.FileExists(p3) Then chromePath = p3
    If chromePath = "" And fso.FileExists(p4) Then chromePath = p4
    If chromePath = "" And fso.FileExists(p5) Then chromePath = p5

    url = "http://localhost:" & port
    If chromePath = "" Then
        ws.Run "cmd /c start " & url, 0, False
    Else
        ws.Run """" & chromePath & """ --app=" & url & " --window-size=1280,860 --window-position=80,40 --disable-extensions", 0, False
    End If
End Sub
