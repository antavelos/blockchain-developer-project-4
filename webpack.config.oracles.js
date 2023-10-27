const path = require("path");
const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');

module.exports = {
    entry: "./src/oracles/oracles.js",
    output: {
      filename: "oracles.js",
      path: path.resolve(__dirname, "dist/oracles"),
    },
    externalsPresets: {
        node: true
    },
    externals: [
        nodeExternals()
    ],
  plugins: [
    new RunScriptWebpackPlugin({
      name: 'oracles.js',
    }),
  ],
};