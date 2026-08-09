#Requires AutoHotkey v2.0

; Synthetic global hotkeys for the reproducible demo.
^!t::Run "wt.exe"
#l::MsgBox "This collides with the Windows lock shortcut."

#HotIf WinActive("ahk_exe Code.exe")
^+l::Send "^+p"
#HotIf
