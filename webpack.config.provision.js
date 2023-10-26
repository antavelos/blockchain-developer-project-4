const path = require("path");
const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');

module.exports = {
    entry: "./src/provision/provision.js",
    output: {
      filename: "provision.js",
      path: path.resolve(__dirname, "dist/provision"),
    },
    externalsPresets: {
        node: true
    },
    externals: [
        nodeExternals()
    ],
  plugins: [
    new RunScriptWebpackPlugin({
      name: 'provision.js',
    }),
  ],
};