import React, { useRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { /*initUniform*/ Program, Texture } from './glw';
import { loadRaw } from './libraw';
const fs = require('fs');

const vertexShaderSource = fs.readFileSync('./src/vs.glsl');
const fragmentShaderSource = fs.readFileSync('./src/fs.glsl');

const spectrumData = JSON.parse(fs.readFileSync('./data/spectrum-d55-4.json'));
const profileData = JSON.parse(fs.readFileSync('./data/b29-50d.json'));

/*
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

function draw(canvas) {
    const gl = canvas.getContext('webgl2');

    const t0 = Date.now();
    resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear the canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Tell it to use our program (pair of shaders)
    //gl.useProgram(program);

    // Bind the attribute/buffer set we want.
    //gl.bindVertexArray(vao);

    const primitiveType = gl.TRIANGLES;
    const drawOffset = 0;
    const count = 6;
    gl.drawArrays(primitiveType, drawOffset, count);
    console.log('dT =', Date.now() - t0);
}
*/

function resizeCanvasToDisplaySize(canvas) {
    // Lookup the size the browser is displaying the canvas in CSS pixels.
    const displayWidth  = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    // Check if the canvas is not the same size.
    const needResize = canvas.width  !== displayWidth ||
        canvas.height !== displayHeight;

    if (needResize) {
        // Make the canvas the same size
        canvas.width  = displayWidth;
        canvas.height = displayWidth * 3 / 4; //displayHeight;
    }

    return needResize;
}

export function Photo() {
    const ref = useRef(null);
    const imagePath = useSelector(state => state.imagePath);
    const userOptions = useSelector(state => state.userOptions);
    const [program, setProgram] = useState();
    const [texture, setTexture] = useState();

    const userOpts = {
        color_corr: userOptions.color_corr,
        film_exposure: userOptions.film_exposure,
        paper_exposure: 0.0,
        paper_contrast: userOptions.paper_contrast,
        curve_smoo: userOptions.curve_smoo,
        mode: '#0',
    };

    useEffect(() => {
        const canvas = ref.current;
        const gl = canvas.getContext('webgl2');

        const _program = new Program(gl, vertexShaderSource, fragmentShaderSource);
        _program.setAttribute('a_position', [
            [-1, -1],
            [-1,  1],
            [ 1,  1],
            [-1, -1],
            [ 1, -1],
            [ 1,  1],
        ]);
        _program.setAttribute('a_texCoord', [
            [0, 1],
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
            [1, 0],
        ]);
        _program.setUniform('u_spectrumData', spectrumData);
        _program.setUniform('u_profileData', profileData);
        _program.setUniform('u_userOptions', userOpts);

        const _texture = new Texture(gl, 0);
        setTexture(_texture);

        _program.setUniform('u_image', _texture);
        setProgram(_program);

        const _resizeObserver = new ResizeObserver(() => {
            resizeCanvasToDisplaySize(canvas);
            _program.run();
        });
        _resizeObserver.observe(canvas, {box: 'content-box'});
    }, []);

    useEffect(() => {
        if (!imagePath) {
            return;
        }
        const img = loadRaw(imagePath, { colorSpace: "xyz", halfSize: false });
        texture.setData(img.width, img.height, new Float32Array(img.image.buffer), {
            minFilter: texture.gl.LINEAR,
            magFilter: texture.gl.LINEAR,
        });
    }, [imagePath]);

    useEffect(() => {
        if (program) {
            program.setUniform('u_userOptions', userOpts);
            program.run();
        }
    });

    return (
        <canvas ref={ref} style={{
            backgroundColor: '#000',
            width: '70%',
            height: '100%',
            margin: '20px',
        }} />
    );
}

