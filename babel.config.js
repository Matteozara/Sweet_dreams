module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo also wires up the react-native-worklets plugin that
  // Reanimated 4 needs. Nothing else should be added after it.
  return { presets: ['babel-preset-expo'] };
};
