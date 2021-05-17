import React, { useRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Program, Texture, Framebuffer } from './glw';
import { loadRaw } from './libraw';
const fs = require('fs');
const erf = require('math-erf');

const vertexShaderSource = fs.readFileSync('./shaders/main.vert');
const fragmentShaderSource = fs.readFileSync('./shaders/main.frag');

const blurVertexShader = fs.readFileSync('./shaders/blur.vert');
const blurFragmentShader = fs.readFileSync('./shaders/blur.frag');

const spectrumData = JSON.parse(fs.readFileSync('./data/spectrum-d55-4.json'));
const profileData = JSON.parse(fs.readFileSync('./data/b29-50d.json'));

/*
function blurKernel(rr, w, h) {
    if (rr === 0) {
        return {
            data: [1],
            size: '#1',
        };
    }
    const s = rr * Math.min(w, h) / 100;
    const r = Math.ceil(3 * s);
    let d = [];
    const a = 1 / (s * Math.sqrt(2*Math.PI));
    if (a > 0.75) {
        return {
            data: [1],
            size: '#1',
        };
    }
    for (let x = -r; x <= r; x++) {
        const y = x / s; 
        d.push(a * Math.exp(-y*y/2));
    }
    return {
        data: d,
        size: '#' + (2*r+1),
    };
}
*/

function blurKernel(rr, w, h) {
    if (rr === 0) {
        return {
            data: [1],
            size: '#1',
        };
    }
    const s = rr * Math.min(w, h) / 100;
    const r = Math.ceil(3 * s);
    let d = [];
    const q = 1 / (Math.SQRT2 * s);

    for (let x = -r; x <= r; x++) {
        const v = 0.5 * (erf((x + 0.5) * q) - erf((x - 0.5) * q));
        d.push(v);
    }
    return {
        data: d,
        size: '#' + (2*r+1),
    };
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

export function Photo() {
    const ref = useRef(null);
    const imagePath = useSelector(state => state.imagePath);
    const userOptions = useSelector(state => state.userOptions);
    const blurRadius = useSelector(state => state.blurRadius);
    const maskThreshold = useSelector(state => state.maskThreshold);
    const maskDensity = useSelector(state => state.maskDensity);

    const [darkroom, setDarkroom] = useState();

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

        const ext1 = gl.getExtension('OES_texture_float_linear');
        const ext2 = gl.getExtension('EXT_color_buffer_float');

        const mainProg = new Program(gl, vertexShaderSource, fragmentShaderSource);
        mainProg.setAttribute('a_position', [
            [-1, -1],
            [-1,  1],
            [ 1,  1],
            [-1, -1],
            [ 1, -1],
            [ 1,  1],
        ]);
        mainProg.setAttribute('a_texCoord', [
            [0, 1],
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
            [1, 0],
        ]);
        mainProg.setUniform('u_spectrumData', spectrumData);
        mainProg.setUniform('u_profileData', profileData);
        mainProg.setUniform('u_userOptions', userOpts);

        const image = new Texture(gl, 0);
        mainProg.setUniform('u_image', image);

        const blurProg = new Program(gl, blurVertexShader, blurFragmentShader);
        blurProg.setAttribute('a_position', [
            [-1, -1],
            [-1,  1],
            [ 1,  1],
            [-1, -1],
            [ 1, -1],
            [ 1,  1],
        ]);
        blurProg.setAttribute('a_texCoord', [
            [0, 1],
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
            [1, 0],
        ]);
        blurProg.setUniform('u_kernel', blurKernel(blurRadius, gl.canvas.width, gl.canvas.height));

        const _darkroom = {
            gl,
            mainProg,
            blurProg,
            image,
            run: function() {
                const tex = new Texture(gl, 1);
                tex.setData(gl.canvas.width, gl.canvas.height);
                const fb = new Framebuffer(gl, tex);

                this.mainProg.setUniform('u_userOptions.mode', '#9');
                this.mainProg.run(fb);

                const tex2 = new Texture(gl, 2);
                tex2.setData(gl.canvas.width, gl.canvas.height);
                const fb2 = new Framebuffer(gl, tex2);

                this.blurProg.setUniform('u_vert', false);
                this.blurProg.setUniform('u_image', tex);
                this.blurProg.run(fb2);

                const tex3 = new Texture(gl, 3);
                tex3.setData(gl.canvas.width, gl.canvas.height);
                const fb3 = new Framebuffer(gl, tex3);

                this.blurProg.setUniform('u_vert', true);
                this.blurProg.setUniform('u_image', tex2);
                this.blurProg.run(/*fb3*/);

                /*
                this.mainProg.setUniform('u_mask', tex3);
                this.mainProg.setUniform('u_userOptions.mode', '#10');
                this.mainProg.run();
                */
            }
        };

        setDarkroom(_darkroom);

        const _resizeObserver = new ResizeObserver(() => {
            resizeCanvasToDisplaySize(canvas);
            _darkroom.run();
        });
        _resizeObserver.observe(canvas, {box: 'content-box'});
    }, []);

    useEffect(() => {
        if (!imagePath) {
            return;
        }
        const img = loadRaw(imagePath, { colorSpace: "xyz", halfSize: false });
        const texture = darkroom.image;
        texture.setData(img.width, img.height, new Float32Array(img.image.buffer), {
            minFilter: texture.gl.LINEAR,
            magFilter: texture.gl.LINEAR,
            alpha: false,
        });
    }, [imagePath]);

    useEffect(() => {
        if (darkroom) {
            darkroom.mainProg.setUniform('u_userOptions', userOpts);
            darkroom.mainProg.setUniform('u_maskThreshold', maskThreshold);
            darkroom.mainProg.setUniform('u_maskDensity', maskDensity);
            const kernel = blurKernel(
                blurRadius, darkroom.gl.canvas.width, darkroom.gl.canvas.height
            );
            darkroom.blurProg.setUniform('u_kernel', kernel);
            darkroom.run();
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

