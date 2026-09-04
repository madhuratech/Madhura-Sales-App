module.exports = function (api) {
  const isWeb = api.caller((caller) => caller && (caller.name === 'metro' ? false : caller.name === 'babel-loader'));
  
  const plugins = [];
  if (process.env.EXPO_OS !== 'web' && !isWeb) {
    plugins.push('react-native-reanimated/plugin');
  }

  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins,
  };
};