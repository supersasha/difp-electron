#!/bin/bash

HOME=~/.electron-gyp node-gyp rebuild --target=11.4.2 --arch=x64 --dist-url=https://electronjs.org/headers
