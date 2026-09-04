module.exports = function (api) {
  api.cache(true);
  const plugins = [];
  
  // Only apply Reanimated plugin for native builds to prevent Web build (Vercel) crash
  if (process.env.EXPO_OS !== 'web') {
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