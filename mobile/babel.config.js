module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Required for react-native-reanimated 4 (delegates worklet transforms
    // to react-native-worklets) - must be the last plugin in the list.
    plugins: ["react-native-worklets/plugin"],
  };
};
