!macro customInit
  nsExec::Exec 'taskkill /F /IM "MarketPulseClock.exe" /T'
  Pop $0
!macroend

!macro customUnInit
  nsExec::Exec 'taskkill /F /IM "MarketPulseClock.exe" /T'
  Pop $0
!macroend
