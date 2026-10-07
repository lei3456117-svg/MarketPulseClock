!macro customInit
  nsExec::Exec 'taskkill /F /IM "像素时钟.exe" /T'
  Pop $0
  nsExec::Exec 'taskkill /F /IM "MarketPulseClock.exe" /T'
  Pop $0
!macroend

!macro customUnInit
  nsExec::Exec 'taskkill /F /IM "像素时钟.exe" /T'
  Pop $0
  nsExec::Exec 'taskkill /F /IM "MarketPulseClock.exe" /T'
  Pop $0
!macroend
