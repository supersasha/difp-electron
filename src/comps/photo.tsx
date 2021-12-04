import * as React from 'react';
import { useRef, useEffect, useState, useMemo } from 'react';
//import { useSelector } from 'react-redux';
import { Program, Texture, Framebuffer, initExtensions, integer, Integer } from '../glw';
import { loadRaw } from '../libraw';
import { State, UserOptions } from '../store';
import { inscribedRect } from '../math';

import * as fs from 'fs';
import erf from 'math-erf';

const vertexShaderSource = fs.readFileSync('./shaders/main.vert', { encoding: 'utf8' });
const fragmentShaderSource = fs.readFileSync('./shaders/main2.frag', { encoding: 'utf8' });

const blurVertexShader = fs.readFileSync('./shaders/blur.vert', { encoding: 'utf8' });
const blurFragmentShader = fs.readFileSync('./shaders/blur.frag', { encoding: 'utf8' });

const noiseVertexShader = fs.readFileSync('./shaders/noise.vert', { encoding: 'utf8' });
const noiseFragmentShader = fs.readFileSync('./shaders/noise.frag', { encoding: 'utf8' });

const spectrumData = JSON.parse(fs.readFileSync('./data/spectrum-d55-4.json', { encoding: 'utf8' }));
const profileData = JSON.parse(fs.readFileSync('./data/new-profile.json', { encoding: 'utf8' }));
//const profileData = JSON.parse(fs.readFileSync('./data/b29-50d.json', { encoding: 'utf8' }));
//const profileData = JSON.parse(fs.readFileSync('./data/prof1.json', { encoding: 'utf8' }));

function blurKernel(rr: number, w: number, h: number): { data: number[], size: Integer } {
    if (rr === 0) {
        return {
            data: [1],
            size: integer(1), //'#1',
        };
    }
    const s = rr * Math.min(w, h) / 100;
    const r = Math.min(Math.ceil(3 * s), 255);
    let d = [];
    const q = 1 / (Math.SQRT2 * s);

    for (let x = -r; x <= r; x++) {
        const v = 0.5 * (erf((x + 0.5) * q) - erf((x - 0.5) * q));
        d.push(v);
    }
    return {
        data: d,
        size: integer(2*r+1), //'#' + (2*r+1),
    };
}

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): boolean {
    // Lookup the size the browser is displaying the canvas in CSS pixels.
    const displayWidth  = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    // Check if the canvas is not the same size.
    const needResize = canvas.width  !== displayWidth ||
                       canvas.height !== displayHeight;

    if (needResize) {
        // Make the canvas the same size
        canvas.width  = displayWidth;
        canvas.height = displayHeight; //displayWidth * 3 / 4; //displayHeight;
    }

    return needResize;
}

interface Darkroom {
    mainProg?: Program;
    blurProg?: Program;
    noiseProg?: Program;
    image?: Texture;
}

export interface PhotoProps {
    path: string;
    options: UserOptions;
}

function initPhoto(gl: WebGL2RenderingContext, imgPath: string, darkroom: Darkroom): void {
    console.log('Running init');
    const img = loadRaw(imgPath, { colorSpace: "xyz", halfSize: false });
    initExtensions(gl);
    const position = [[-1, -1], [-1,  1], [ 1,  1], [-1, -1], [ 1, -1], [ 1,  1]];
    const texCoord = [[0, 1], [0, 0], [1, 0], [0, 1], [1, 1], [1, 0]];

    darkroom.mainProg = new Program(gl, vertexShaderSource, fragmentShaderSource);
    darkroom.mainProg.setAttribute('a_position', position);
    darkroom.mainProg.setAttribute('a_texCoord', texCoord);
    darkroom.mainProg.setUniform('u_spectrumData', spectrumData);
    darkroom.mainProg.setUniform('u_profileData', profileData);
    //mainProg.setUniform('u_userOptions', userOpts);

    darkroom.image = new Texture(gl, 0);
    darkroom.image.setData(img.width, img.height, new Float32Array(img.image.buffer), {
        minFilter: gl.LINEAR,
        magFilter: gl.LINEAR,
        alpha: false,
    });
    darkroom.mainProg.setUniform('u_image', darkroom.image);

    darkroom.blurProg = new Program(gl, blurVertexShader, blurFragmentShader);
    darkroom.blurProg.setAttribute('a_position', position);
    darkroom.blurProg.setAttribute('a_texCoord', texCoord);

    darkroom.noiseProg = new Program(gl, noiseVertexShader, noiseFragmentShader);
    darkroom.noiseProg.setAttribute('a_position', position);
    darkroom.noiseProg.setAttribute('a_texCoord', texCoord);
}

function drawPhoto(gl: WebGL2RenderingContext, darkroom: Darkroom, userOptions: UserOptions): void {
    const width = gl.canvas.width;
    const height = gl.canvas.height;

    const { mainProg, noiseProg, blurProg } = darkroom;
    console.log('Running draw', mainProg.gl === gl);
    mainProg.setUniform('u_userOptions', {
        color_corr: userOptions.colorCorr,
        film_exposure: userOptions.filmExposure,
        paper_exposure: userOptions.paperExposure,
        paper_contrast: userOptions.paperContrast,
        curve_smoo: userOptions.curveSmoo,
    });
    mainProg.setUniform('u_maskThreshold', userOptions.maskThreshold);
    mainProg.setUniform('u_maskDensity', userOptions.maskDensity);
    mainProg.setUniform('u_mask', integer(0));
    mainProg.setUniform('u_noise', integer(0));
    
    //noiseProg.setUniform('u_seed', '#0');
    noiseProg.setUniform('u_sigma', userOptions.noiseSigma);

    // Create necessary buffers
    const fbNoise = new Framebuffer(gl, 1, width, height);
    const fbMask = new Framebuffer(gl, 2, width, height);
    const fbTmp = new Framebuffer(gl, 3, width, height);

    // Produce noise
    noiseProg.run(fbNoise);

    let kernel = blurKernel(
        userOptions.noiseBlur, gl.canvas.width, gl.canvas.height
    );
    blurProg.setUniform('u_kernel', kernel);
    blurProg.setUniform('u_vert', false);
    blurProg.setUniform('u_image', fbNoise.texture);
    blurProg.run(fbTmp);

    blurProg.setUniform('u_vert', true);
    blurProg.setUniform('u_image', fbTmp.texture);
    blurProg.run(fbNoise);

    // Produce mask
    mainProg.setUniform('u_userOptions.mode', integer(9));
    mainProg.run(fbMask);

    kernel = blurKernel(
        userOptions.maskBlur, gl.canvas.width, gl.canvas.height
    );
    blurProg.setUniform('u_kernel', kernel);

    blurProg.setUniform('u_vert', false);
    blurProg.setUniform('u_image', fbMask.texture);
    blurProg.run(fbTmp);

    blurProg.setUniform('u_vert', true);
    blurProg.setUniform('u_image', fbTmp.texture);
    blurProg.run(fbMask);

    mainProg.setUniform('u_mask', fbMask.texture);
    mainProg.setUniform('u_noise', fbNoise.texture);
    mainProg.setUniform('u_userOptions.mode', integer(10));
    mainProg.run();

    fbTmp.dispose();
    fbNoise.dispose();
    fbMask.dispose();
    gl.finish();
}

function makeThrottle(opts: any = {}) {
    console.error(`NEW THROTTLE!`);
    const { deltaMs = 1000 } = opts;
    let lastTs = undefined;
    let handle = undefined;
    return (f) => {
        const now = Date.now();
        if (handle) {
            //console.log(`clearing handle ${handle}`);
            clearTimeout(handle);
            handle = undefined;
        }
        if (!lastTs || now - lastTs > deltaMs) {
            /*
            if (lastTs) {
                console.log(`thottling1 after ${now-lastTs} ms`);
            }
             */
            f();
            lastTs = now;
        } else {
            handle = setTimeout(() => {
                /*
                if (lastTs) {
                    console.log(`thottling2 after ${Date.now()-lastTs} ms, handle: ${handle}`);
                }
                 */
                f();
                handle = undefined;
                lastTs = Date.now();
            }, deltaMs - (now - lastTs));
        }
    };
}

const throttle = makeThrottle({ deltaMs: 100 });

export function Photo(props: PhotoProps): React.ReactElement {
    const { path, options } = props;
    const borderWidth = 20;
    const outerRef = useRef(null);
    const innerRef = useRef(null);
    const darkroomRef = useRef({} as Darkroom);
    //const throttleRef = useRef(makeThrottle({ deltaMs: 1000 }));

    const init = useMemo(() => (gl: WebGL2RenderingContext) => {
        if (!path) {
            return;
        }
        const darkroom = darkroomRef.current;
        initPhoto(gl, path, darkroom);
    }, [ path ]);

    const draw = (gl: WebGL2RenderingContext) => {
        //const throttle = throttleRef.current;
        const darkroom = darkroomRef.current;
        throttle(() => {
            if (!path) {
                return;
            }
            drawPhoto(gl, darkroom, options);
        });
    };
    
    useEffect(() => {
        if (!path) {
            return;
        }
        const darkroom = darkroomRef.current;
        const outer = outerRef.current;
        const inner = innerRef.current;
        let oldWidth: number;
        let oldHeight: number;
        const resizeObserver = new ResizeObserver(() => {
            if (oldWidth !== outer.clientWidth || oldHeight !== outer.clientHeight) {
                const ratio = darkroom.image.width / darkroom.image.height;
                const rect = inscribedRect(outer.clientWidth - 2*borderWidth, outer.clientHeight - 2*borderWidth, ratio);
                inner.style.width = rect.width + `px`;
                inner.style.height = rect.height + `px`;

                oldWidth = outer.clientWidth;
                oldHeight = outer.clientHeight;
            }
        });
        resizeObserver.observe(outer, {box: 'content-box'});
        return () => {
            resizeObserver.disconnect();
        };
    }, [path]);

    return (
        <div ref={outerRef} style={{
            width: '100%',
            height: '100vh',
        }}>
            <div ref={innerRef} style={{
                border: `${borderWidth}px solid white`,
                boxSizing: 'content-box',
                margin: '0 auto',
            }}>
                <CanvasWebGL2 init={init} draw={draw} style={{
                    width: '100%',
                    height: '100%',
                }}/>
            </div>
        </div>
    );
}

let lastAnimationFrameHandle;

function requestAnimationFrameLastOnly(f) {
    if (lastAnimationFrameHandle) {
        console.log(`Cancelling previous animation frame request`);
        cancelAnimationFrame(lastAnimationFrameHandle);
    }
    lastAnimationFrameHandle = requestAnimationFrame(() => {
        f();
        lastAnimationFrameHandle = undefined;
    });
}

export function CanvasWebGL2(props): React.ReactElement {
    const defaultInit = () => {};
    const defaultDraw = () => {};
    const { init = defaultInit, draw = defaultDraw, ...rest } = props;
    const ref = useRef(null);
    useEffect(() => {
        const canvas = ref.current;
        const gl = canvas.getContext('webgl2');
        init(gl);
    }, [init]);
    useEffect(() => {
        const canvas = ref.current;
        const gl = canvas.getContext('webgl2');
        requestAnimationFrameLastOnly(() => {
            draw(gl);
        });
    }, [draw]);
    useEffect(() => {
        const canvas = ref.current;
        const resizeObserver = new ResizeObserver(([cv]) => {
            if(resizeCanvasToDisplaySize(canvas)) {
                console.log(`Re-drawing as canvas size changed:`,
                    cv.contentBoxSize[0].blockSize, cv.contentBoxSize[0].inlineSize);
                const gl = canvas.getContext('webgl2');
                requestAnimationFrameLastOnly(() => {
                    draw(gl);
                });
            }
        });
        resizeObserver.observe(canvas, {box: 'content-box'});
        return () => {
            resizeObserver.disconnect();
        };
    }, [draw]);
    return <canvas ref={ref} {...rest}/>;
}

export function NoPhoto(props) {
    return <p>No photo</p>;
}
