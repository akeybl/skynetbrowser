const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
require('dotenv').config();

module.exports = {
  packagerConfig: {
    asar: true,
    // thanks to https://medium.com/ascentic-technology/getting-an-electron-app-ready-for-macos-distribution-2941fce27450
    osxSign: {
      identity: process.env.SIGN_ID,
      "hardened-runtime": true,
      entitlements: "build-scripts/entitlements.plist",
      "entitlements-inherit": "build-scripts/entitlements.plist",
      "signature-flags": "library"
    },
    osxNotarize: {
      tool: 'notarytool',
      "appleApiKey": process.env.API_KEY,
      "appleApiKeyId": process.env.API_KEY_ID,
      "appleApiIssuer": process.env.API_KEY_ISSUER
    }
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
