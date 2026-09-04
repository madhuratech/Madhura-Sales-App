module.exports = function (api) {
  api.cache(true);
  const plugins = [];
  
  // Robust check to see if we are building for web (Vercel)
  const isWeb = api.caller(caller => (caller && caller.platform === 'web') || (caller && caller.name === 'babel-loader'));
  const isExpoOSWeb = process.env.EXPO_OS === 'web';
  
  // Only apply Reanimated plugin for native builds to prevent Web build (Vercel) crash
  if (!isWeb && !isExpoOSWeb) {
    plugins.push('react-native-reanimated/plugin');
  }

  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins,
  };
};