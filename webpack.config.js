const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const webpack        = require('webpack');
const path           = require('path');
const commonConfig = {
  mode : 'development',
  entry  : './src/index.ts',
  output : {
    filename     : 'index.js',
    path         : __dirname + '/dist/browser',
    libraryTarget: 'umd'
  },
  module : {
    rules: [
      {
        test   : /\.tsx?$/,
        loader : 'ts-loader',
        options: {
          transpileOnly: true
        },
        exclude: /node_modules/,
      }
    ]
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias     : {
    }
  },
  externals: {
    '@ledgerhq/hw-transport-node-hid': 'hw-transport-node-hid'
  },
  plugins: [
    new UglifyJSPlugin(),
  ]
};
module.exports     = [
  commonConfig
  // Object.assign({}, commonConfig, { output: Object.assign({}, commonConfig.output, { path: commonConfig.output.path + '/browser' }) }),
];