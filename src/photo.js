import React, { useRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { initUniform } from './glsl-structures.js';
import { loadRaw } from './libraw';
const fs = require('fs');

const vertexShaderSource = fs.readFileSync('./src/vs.glsl');
const fragmentShaderSource = fs.readFileSync('./src/fs.glsl');

const spectrumData = JSON.parse(fs.readFileSync('./data/spectrum-d55-4.json'));
const profileData = JSON.parse(fs.readFileSync('./data/b29-50d.json'));

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

export function Photo() {
    const ref = useRef(null);
    const imagePath = useSelector(state => state.imagePath);
    const userOptions = useSelector(state => state.userOptions);
    const [program, setProgram] = useState();

    useEffect(() => {
        console.log('Effect1');
        const canvas = ref.current;
        const gl = canvas.getContext('webgl2');

        var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        var vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        var renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

        console.log(vendor);
        console.log(renderer);

        console.log(gl.getExtension('OES_texture_float_linear'));

        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
        const _program = createProgram(gl, vertexShader, fragmentShader);
        setProgram(_program);
        gl.useProgram(_program);

        // vertex data
        const positionAttributeLocation = gl.getAttribLocation(_program, "a_position");
        const texCoordAttributeLocation = gl.getAttribLocation(_program, "a_texCoord");
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        
        // three 2d points
        var positions = [
          -1, -1,
          -1, 1,
          1, 1,
          -1, -1,
          1, -1,
          1, 1,
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        gl.enableVertexAttribArray(positionAttributeLocation);
        const size = 2;          // 2 components per iteration
        const type = gl.FLOAT;   // the data is 32bit floats
        const normalize = false; // don't normalize the data
        const stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
        const offset = 0;        // start at the beginning of the buffer
        gl.vertexAttribPointer(
            positionAttributeLocation, size, type, normalize, stride, offset);

        // provide texture coordinates for the rectangle.
        var texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0, 1,
            0, 0,
            1, 0,
            0, 1,
            1, 1,
            1, 0,
        ]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(texCoordAttributeLocation);
        gl.vertexAttribPointer(
            texCoordAttributeLocation, size, type, normalize, stride, offset);

        initUniform(gl, _program, spectrumData, 'u_spectrumData');
        initUniform(gl, _program, profileData, 'u_profileData');
        initUniform(gl, _program, {
            color_corr: userOptions.color_corr,
            film_exposure: userOptions.film_exposure,
            paper_exposure: 0.0,
            paper_contrast: userOptions.paper_contrast,
            curve_smoo: userOptions.curve_smoo,
            mode: '#0',
        }, 'u_userOptions');
        const resizeObserver = new ResizeObserver(() => { draw(ref.current); });
        resizeObserver.observe(canvas, {box: 'content-box'});
    }, []);

    useEffect(() => {
        console.log('Effect2');
        if (!imagePath) {
            return;
        }
        const img = loadRaw(imagePath, { colorSpace: "xyz", halfSize: false });

        const canvas = ref.current;
        const gl = canvas.getContext('webgl2');
        
        const imageLocation = gl.getUniformLocation(program, "u_image");

        // Create a texture.
        const texture = gl.createTexture();

        // make unit 0 the active texture uint
        // (ie, the unit all other texture commands will affect
        gl.activeTexture(gl.TEXTURE0 + 0);

        // Bind it to texture unit 0' 2D bind point
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Set the parameters so we don't need mips and so we're not filtering
        // and we don't repeat
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Upload the image into the texture.
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGB32F,
            img.width,
            img.height,
            0,
            gl.RGB,
            gl.FLOAT,
            new Float32Array(img.image.buffer)
        );
        // Tell the shader to get the texture from texture unit 0
        gl.uniform1i(imageLocation, 0);
    }, [imagePath]);

    useEffect(() => {
        console.log('Effect3');
        const canvas = ref.current;
        const gl = canvas.getContext('webgl2');
        if (program) {
            initUniform(gl, program, {
                color_corr: userOptions.color_corr,
                film_exposure: userOptions.film_exposure,
                paper_exposure: 0.0,
                paper_contrast: userOptions.paper_contrast,
                curve_smoo: userOptions.curve_smoo,
                mode: '#0',
            }, 'u_userOptions');
        }

        draw(ref.current);
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

