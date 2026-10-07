const { execSync } = require('child_process');
const path = require('path');

exports.default = async function(context) {
  if (context.electronPlatformName === 'darwin') {
    const appName = `${context.packager.appInfo.productFilename}.app`;
    const appPath = path.join(context.appOutDir, appName);
    console.log(`[afterPack] Force re-signing with valid ad-hoc signature: ${appPath}`);
    try {
      execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
      console.log(`[afterPack] Code signing completed successfully.`);
    } catch (err) {
      console.error(`[afterPack] Code signing failed:`, err);
    }
  }
};
