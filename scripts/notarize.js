const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;  
  
  // Notarization is ONLY applicable to macOS
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  // Bypass if explicitly requested
  if (process.env.SKIP_NOTARIZATION === 'true') {
    console.log('  • skipping macOS notarization (SKIP_NOTARIZATION is true)');
    return;
  }

  // Get credentials from environment variables
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  // Gracefully skip if credentials are not provided (e.g. during local offline development)
  if (!appleId || !appleIdPassword || !teamId) {
    console.warn('  • skipping macOS notarization: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID environment variables are missing');
    return;
  }

  console.log(`  • submitting ${appName} for Apple Notarization at ${appPath}...`);

  try {
    await notarize({
      appPath,
      appleId,
      appleIdPassword,
      teamId,
    });
    console.log(`  • notarization successful! Your app is officially approved by Apple.`);
  } catch (error) {
    console.error('  • notarization failed! Please check your Apple Developer credentials:');
    console.error(error);
    throw error; // Fail the build if notarization fails when credentials are provided
  }
};
