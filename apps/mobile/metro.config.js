const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// Expo configures Metro for the pnpm workspace on its own (watch folders, hoisted modules).
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css' });
