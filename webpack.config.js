var path = require('path');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var os = require('os');

module.exports = {
    target: 'electron11-renderer',
    node: {
        __dirname: false,
    },
    entry: {
        react: './src/index.tsx',
    },
    devtool: 'inline-source-map',
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
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
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                            outputPath: 'fonts/'
                        }
                    }
                ]
            }
        ]
    },
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
