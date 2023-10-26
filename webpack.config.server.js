const path = require("path");
const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');

module.exports = {
    entry: "./src/server/server.js",
    output: {
      filename: "server.js",
      path: path.resolve(__dirname, "dist/server"),
    },
    externalsPresets: {
        node: true
    },
    externals: [
        nodeExternals()
    ],
  plugins: [
    new RunScriptWebpackPlugin({
      name: 'server.js',
    }),
  ],
};