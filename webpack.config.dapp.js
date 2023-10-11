const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: 'development',
  entry: "./src/dapp/index.js",
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "dist/dapp"),
  },
  plugins: [
    new CopyWebpackPlugin({patterns: [
      { from: "./src/dapp/images", to: "images" },
      { from: "./src/dapp/index.html", to: "index.html" }
    ]}),
  ],
  devServer: { static: {directory: path.join(__dirname, "dist/dapp")}, compress: true },
};
