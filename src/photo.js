import React, { useRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Program, Texture, Framebuffer } from './glw';
import { loadRaw } from './libraw';
import { A_1931_64_400_700_10nm } from './profiler';

const fs = require('fs');
const erf = require('math-erf');

const vertexShaderSource = fs.readFileSync('./shaders/main.vert');
const fragmentShaderSource = fs.readFileSync('./shaders/main.frag');

const blurVertexShader = fs.readFileSync('./shaders/blur.vert');
const blurFragmentShader = fs.readFileSync('./shaders/blur.frag');

const noiseVertexShader = fs.readFileSync('./shaders/noise.vert');
const noiseFragmentShader = fs.readFileSync('./shaders/noise.frag');

const spectrumData = JSON.parse(fs.readFileSync('./data/spectrum-d55-4.json'));
const profileData = JSON.parse(fs.readFileSync('./data/b29-50d.json'));
//const profileData = JSON.parse(fs.readFileSync('./data/prof1.json'));

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
    //return <div>No photo (A. Ovchinnikov)</div>;
    const ref = useRef(null);
    const imagePath = useSelector(state => state.imagePath);
    const userOptions = useSelector(state => state.userOptions);

    const [darkroom, setDarkroom] = useState();

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
        //mainProg.setUniform('u_userOptions', userOpts);

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

        const noiseProg = new Program(gl, noiseVertexShader, noiseFragmentShader);
        noiseProg.setAttribute('a_position', [
            [-1, -1],
            [-1,  1],
            [ 1,  1],
            [-1, -1],
            [ 1, -1],
            [ 1,  1],
        ]);
        noiseProg.setAttribute('a_texCoord', [
            [0, 1],
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
            [1, 0],
        ]);

        const _darkroom = {
            gl,
            mainProg,
            blurProg,
            noiseProg,
            image,
            run: function(uo) {
                this.mainProg.setUniform('u_userOptions', {
                    color_corr: uo.colorCorr,
                    film_exposure: uo.filmExposure,
                    paper_contrast: uo.paperContrast,
                    curve_smoo: uo.curveSmoo,
                });
                this.mainProg.setUniform('u_maskThreshold', uo.maskThreshold);
                this.mainProg.setUniform('u_maskDensity', uo.maskDensity);
                //this.noiseProg.setUniform('u_seed', '#0');
                this.noiseProg.setUniform('u_sigma', uo.noiseSigma);

                const texNoise = new Texture(gl, 1);
                texNoise.setData(gl.canvas.width, gl.canvas.height);
                const fbNoise = new Framebuffer(gl, texNoise);

                this.noiseProg.run(fbNoise);

                const texMask = new Texture(gl, 2);
                texMask.setData(gl.canvas.width, gl.canvas.height);
                const fbMask = new Framebuffer(gl, texMask);

                this.mainProg.setUniform('u_userOptions.mode', '#9');
                this.mainProg.run(fbMask);

                const texHorzBlurMask = new Texture(gl, 3);
                texHorzBlurMask.setData(gl.canvas.width, gl.canvas.height);
                const fbHorzBlurMask = new Framebuffer(gl, texHorzBlurMask);
                
                let kernel = blurKernel(
                    uo.maskBlur, this.gl.canvas.width, this.gl.canvas.height
                );
                this.blurProg.setUniform('u_kernel', kernel);

                this.blurProg.setUniform('u_vert', false);
                this.blurProg.setUniform('u_image', texMask);
                this.blurProg.run(fbHorzBlurMask);

                const texVertBlurMask = new Texture(gl, 4);
                texVertBlurMask.setData(gl.canvas.width, gl.canvas.height);
                const fbVertBlurMask = new Framebuffer(gl, texVertBlurMask);

                this.blurProg.setUniform('u_vert', true);
                this.blurProg.setUniform('u_image', texHorzBlurMask);
                this.blurProg.run(fbVertBlurMask);

                kernel = blurKernel(
                    uo.noiseBlur, this.gl.canvas.width, this.gl.canvas.height
                );
                this.blurProg.setUniform('u_kernel', kernel);

                const texHorzBlurNoise = new Texture(gl, 5);
                texHorzBlurNoise.setData(gl.canvas.width, gl.canvas.height);
                const fbHorzBlurNoise = new Framebuffer(gl, texHorzBlurNoise);
                this.blurProg.setUniform('u_vert', false);
                this.blurProg.setUniform('u_image', texNoise);
                this.blurProg.run(fbHorzBlurNoise);

                const texVertBlurNoise = new Texture(gl, 6);
                texVertBlurNoise.setData(gl.canvas.width, gl.canvas.height);
                const fbVertBlurNoise = new Framebuffer(gl, texVertBlurNoise);
                this.blurProg.setUniform('u_vert', true);
                this.blurProg.setUniform('u_image', texHorzBlurNoise);
                this.blurProg.run(fbVertBlurNoise);

                this.mainProg.setUniform('u_mask', texVertBlurMask);
                this.mainProg.setUniform('u_noise', texVertBlurNoise);
                this.mainProg.setUniform('u_userOptions.mode', '#10');
                this.mainProg.run();
            }
        };

        setDarkroom(_darkroom);
    }, []);

    useEffect(() => {
        if (!imagePath) {
            return;
        }
        const img = loadRaw(imagePath, { colorSpace: "xyz", halfSize: false });
        const texture = darkroom.image;
        console.log(img);
        texture.setData(img.width, img.height, new Float32Array(img.image.buffer), {
            minFilter: texture.gl.LINEAR,
            magFilter: texture.gl.LINEAR,
            alpha: false,
        });
    }, [imagePath]);

    useEffect(() => {
        if (darkroom) {
            /*
            darkroom.mainProg.setUniform('u_userOptions', userOpts);
            darkroom.mainProg.setUniform('u_maskThreshold', maskThreshold);
            darkroom.mainProg.setUniform('u_maskDensity', maskDensity);
            //darkroom.noiseProg.setUniform('u_seed', '#0');
            darkroom.noiseProg.setUniform('u_sigma', noiseSigma);
            darkroom.maskBlur = blurRadius;
            darkroom.noiseBlur = noiseBlur;
            */
            darkroom.run(userOptions);
        }
    });

    useEffect(() => {
        if (darkroom) {
            const canvas = ref.current;
            const resizeObserver = new ResizeObserver(() => {
                resizeCanvasToDisplaySize(canvas);
                darkroom.run(userOptions);
            });
            resizeObserver.observe(canvas, {box: 'content-box'});
            return () => {
                resizeObserver.unobserve(canvas);
            };
        }
    });

    return (
        <canvas ref={ref} style={{
            backgroundColor: '#000',
            width: '74.5%',
            height: '100%',
            margin: '20px',
        }} />
    );
}

