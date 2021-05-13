var path = require('path');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var os = require('os');

module.exports = {
    target: 'electron11-renderer',
    node: {
        __dirname: false,
    },
    entry: {
        react: './src/index.js',
        //webgl: './src/webgl.js',
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name]_bundle.js'
    },
    module: {
        rules: [
            { 
                test: /\.(js)$/, 
                use: 'babel-loader' 
            },
            { 
                test: /\.css$/, 
                use: ['style-loader', 'css-loader'] 
            },
            /*
            {
                test: /\.node$/,
                loader: 'node-loader',
                options: {
                    flags: os.constants.dlopen.RTLD_NOW,
                },
            }
            */
        ]
    },
    /*
    resolve: {
        fallback: {
            path: false
        }
    },
    */
/*
    externals: {
        bindings: 'require("bindings")' // fixes warnings during build
    },
    */
    mode: 'development',
    plugins: [
        new HtmlWebpackPlugin({
            template: 'src/index.html'
        })
    ],
    devServer: {
        port: 8033,
    },
}
