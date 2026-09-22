const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 360,
    height: 278,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  });

  win.webContents.on('console-message', (e, level, msg, line, sourceId) => {
    console.log('CONSOLE:', msg, 'at line', line);
  });

  win.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('LOAD ERROR:', code, desc);
  });

  await win.loadFile(path.join(__dirname, '../src/index.html'));
  await new Promise(r => setTimeout(r, 600));
  const image = await win.capturePage();
  fs.writeFileSync('/tmp/clock_test.png', image.toPNG());
  console.log('SAVED SCREENSHOT TO /tmp/clock_test.png');
  app.quit();
});
