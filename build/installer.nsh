; electron-builder NSIS include.
;
; customInit runs in .onInit after $INSTDIR was resolved from the registry
; (initMultiUser) and before the directory page is shown.
; customCheckAppRunning replaces electron-builder's built-in close/retry
; MessageBox loop (issue #4: it dead-ends in a "cannot close the app"
; dialog even when no matching process exists).

!macro customInit
  ; Kill still-running instances first. Windows file locks otherwise make the
  ; old-version uninstall fail with "Failed to uninstall old application
  ; files". /F is force, /T takes the dsh web child process tree along.
  nsExec::Exec 'taskkill /F /T /IM "DeepSeek Harness.exe"'
  nsExec::Exec 'taskkill /F /T /IM "DSH Desktop.exe"'
!macroend

; Dialog-free replacement for the built-in CHECK_APP_RUNNING: wait (up to
; ~10s) until no current/legacy app exe is alive, then continue regardless.
; Force-kill was already attempted in customInit; if something survives
; (elevated instance), proceeding still lets the silent path work and never
; traps the user in a retry MessageBox loop.
!macro customCheckAppRunning
  StrCpy $1 0
  dshWaitLoop:
    IntOp $1 $1 + 1
    ${If} $1 > 20
      DetailPrint "App process did not exit; continuing anyway"
      Goto dshWaitDone
    ${EndIf}

    StrCpy $2 0

    nsExec::Exec 'cmd /C tasklist /FI "IMAGENAME eq DeepSeek Harness.exe" /NH | find /I "DeepSeek Harness.exe"'
    Pop $0
    ${If} $0 == 0
      StrCpy $2 1
    ${EndIf}

    ${If} $2 == 1
      Sleep 500
      Goto dshWaitLoop
    ${EndIf}
  dshWaitDone:
!macroend
