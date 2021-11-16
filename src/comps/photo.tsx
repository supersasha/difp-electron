import * as React from 'react';
import { useRef, useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Program, Texture, Framebuffer, initExtensions } from '../glw';
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

function blurKernel(rr: number, w: number, h: number): { data: number[], size: string } {
    if (rr === 0) {
        return {
            data: [1],
            size: '#1',
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
        size: '#' + (2*r+1),
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
    run?: any;
    gl?: any;
}

export interface RawPhotoProps {
    path?: string;
    processor: (props: PhotoProcessorProps) => React.ReactElement;
}

export function RawPhotoFileLoader(props: RawPhotoProps): React.ReactElement {
    const { path, processor } = props;
    const Processor = processor;
    if (path) {
        const img = useMemo(
            () => loadRaw(path, { colorSpace: "xyz", halfSize: false }),
            [path]
        );
        return (<Processor img={img} />);
    } else {
        return (<NoPhoto />);
    }
}

export interface PhotoProcessorProps {
    img: any; // TODO
}

export function FilmProcessor(props: PhotoProcessorProps): React.ReactElement {
    const { img } = props;
    const userOptions = useSelector((state: State) => state.userOptions);
    const darkroomRef = useRef({});
    const outerRef = useRef(null);
    const innerRef = useRef(null);

    const init = useMemo(() => (gl: WebGL2RenderingContext) => {
        console.log('Running init');
        const darkroom: Darkroom = darkroomRef.current;
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
    }, [img]);

    const draw = useMemo(() => (gl: WebGL2RenderingContext) => {
        console.log('Running draw');
        const darkroom: Darkroom = darkroomRef.current;
        const { mainProg, noiseProg, blurProg } = darkroom;
        mainProg.setUniform('u_userOptions', {
            color_corr: userOptions.colorCorr,
            film_exposure: userOptions.filmExposure,
            paper_exposure: userOptions.paperExposure,
            paper_contrast: userOptions.paperContrast,
            curve_smoo: userOptions.curveSmoo,
        });
        mainProg.setUniform('u_maskThreshold', userOptions.maskThreshold);
        mainProg.setUniform('u_maskDensity', userOptions.maskDensity);
        //noiseProg.setUniform('u_seed', '#0');
        noiseProg.setUniform('u_sigma', userOptions.noiseSigma);

        const texNoise = new Texture(gl, 1);
        texNoise.setData(gl.canvas.width, gl.canvas.height);
        const fbNoise = new Framebuffer(gl, texNoise);

        noiseProg.run(fbNoise);

        const texMask = new Texture(gl, 2);
        texMask.setData(gl.canvas.width, gl.canvas.height);
        const fbMask = new Framebuffer(gl, texMask);

        mainProg.setUniform('u_userOptions.mode', '#9');
        mainProg.run(fbMask);

        const texHorzBlurMask = new Texture(gl, 3);
        texHorzBlurMask.setData(gl.canvas.width, gl.canvas.height);
        const fbHorzBlurMask = new Framebuffer(gl, texHorzBlurMask);
        
        let kernel = blurKernel(
            userOptions.maskBlur, gl.canvas.width, gl.canvas.height
        );
        blurProg.setUniform('u_kernel', kernel);

        blurProg.setUniform('u_vert', false);
        blurProg.setUniform('u_image', texMask);
        blurProg.run(fbHorzBlurMask);

        const texVertBlurMask = new Texture(gl, 4);
        texVertBlurMask.setData(gl.canvas.width, gl.canvas.height);
        const fbVertBlurMask = new Framebuffer(gl, texVertBlurMask);

        blurProg.setUniform('u_vert', true);
        blurProg.setUniform('u_image', texHorzBlurMask);
        blurProg.run(fbVertBlurMask);

        kernel = blurKernel(
            userOptions.noiseBlur, gl.canvas.width, gl.canvas.height
        );
        blurProg.setUniform('u_kernel', kernel);

        const texHorzBlurNoise = new Texture(gl, 5);
        texHorzBlurNoise.setData(gl.canvas.width, gl.canvas.height);
        const fbHorzBlurNoise = new Framebuffer(gl, texHorzBlurNoise);
        blurProg.setUniform('u_vert', false);
        blurProg.setUniform('u_image', texNoise);
        blurProg.run(fbHorzBlurNoise);

        const texVertBlurNoise = new Texture(gl, 6);
        texVertBlurNoise.setData(gl.canvas.width, gl.canvas.height);
        const fbVertBlurNoise = new Framebuffer(gl, texVertBlurNoise);
        blurProg.setUniform('u_vert', true);
        blurProg.setUniform('u_image', texHorzBlurNoise);
        blurProg.run(fbVertBlurNoise);

        mainProg.setUniform('u_mask', texVertBlurMask);
        mainProg.setUniform('u_noise', texVertBlurNoise);
        mainProg.setUniform('u_userOptions.mode', '#10');
        mainProg.run();
    }, [img, userOptions]);

    const borderWidth = 20;
    // border: `${borderWidth}px solid green`

    useEffect(() => {
        const outer = outerRef.current;
        const inner = innerRef.current;
        let oldWidth: number;
        let oldHeight: number;
        const resizeObserver = new ResizeObserver(() => {
            if (oldWidth !== outer.clientWidth || oldHeight !== outer.clientHeight) {
                const ratio = img.width / img.height;
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
    }, [img]);
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
        draw(gl);
    }, [draw]);
    useEffect(() => {
        const canvas = ref.current;
        const resizeObserver = new ResizeObserver(([cv]) => {
            if(resizeCanvasToDisplaySize(canvas)) {
                console.log(`Re-drawing as canvas size changed:`,
                    cv.contentBoxSize[0].blockSize, cv.contentBoxSize[0].inlineSize);
                const gl = canvas.getContext('webgl2');
                draw(gl);
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
