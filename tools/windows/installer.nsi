; Installatore di Attendance per Windows (per l'utente, senza permessi da amministratore)
Unicode true
!define VERSION "1.0.1"
!include "MUI2.nsh"
Name "Attendance"
OutFile "Attendance-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Attendance"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "Attendance"
!define MUI_ICON "attendance.ico"
!define MUI_UNICON "attendance.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\Attendance.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Apri Attendance"
!define MUI_FINISHPAGE_TEXT "Attendance è installato.$\r$\n$\r$\nLo trovi sul desktop e nel menu Start. Funziona anche senza internet e si aggiorna da solo quando c'è la connessione."
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Italian"
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=${LANG_ITALIAN} "ProductName" "Attendance"
VIAddVersionKey /LANG=${LANG_ITALIAN} "FileDescription" "Installazione di Attendance"
VIAddVersionKey /LANG=${LANG_ITALIAN} "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_ITALIAN} "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_ITALIAN} "LegalCopyright" ""
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Attendance"

; se questa stessa versione è già installata, aprire l'installatore apre direttamente il programma
Function .onInit
  ReadRegStr $0 HKCU "${UNKEY}" "DisplayVersion"
  StrCmp $0 "${VERSION}" 0 done
  IfFileExists "$LOCALAPPDATA\Programs\Attendance\Attendance.exe" 0 done
  Exec '"$LOCALAPPDATA\Programs\Attendance\Attendance.exe"'
  Quit
  done:
FunctionEnd

Section "Attendance"
  nsExec::Exec 'taskkill /IM Attendance.exe /F'      ; se è aperto, lo chiude per poterlo aggiornare
  Sleep 500
  SetOutPath "$INSTDIR"
  File /r "Attendance\*"
  WriteUninstaller "$INSTDIR\Disinstalla Attendance.exe"
  CreateShortcut "$SMPROGRAMS\Attendance.lnk" "$INSTDIR\Attendance.exe" "" "$INSTDIR\Attendance.exe" 0
  CreateShortcut "$DESKTOP\Attendance.lnk" "$INSTDIR\Attendance.exe" "" "$INSTDIR\Attendance.exe" 0
  WriteRegStr HKCU "${UNKEY}" "DisplayName" "Attendance"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" "$INSTDIR\Attendance.exe"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "Attendance"
  WriteRegStr HKCU "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\Disinstalla Attendance.exe"'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM Attendance.exe /F'
  Sleep 500
  Delete "$SMPROGRAMS\Attendance.lnk"
  Delete "$DESKTOP\Attendance.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNKEY}"
  ; i dati salvati (in %APPDATA%\Attendance) restano: reinstallando si ritrovano
SectionEnd
