import * as React from 'react';
import { useState, useRef, useMemo } from 'react';
import { Matrix } from '../matrix';
import { Button, Slider, TextField } from '@mui/material';

import { ColorSliders } from './color-sliders';
import { RGBColorBox, XYZColorBox } from './colorbox';
import { MatrixDisp } from './mtx-disp';
import { deltaE94Xyz, srgbToXyz, xyzToSrgb, chromaticity } from '../colors';
import { Spectrum31Plot, Plot } from './plot';
import { SpectrumGenerator } from './spectrum-gen';
import { getReflDB } from '../refl-db';
import {
    daylightSpectrum,
    reflectanceUnderLightSource,
    transmittanceToXyzMtx,
    ReflGen,
    generateSpectrumData,
    COLOR_MATCHING_MTX,
} from '../spectrum';

import { loadSpectrumData, saveSpectrumData, saveSpectralBasis } from '../data';

import * as fs from 'fs';

const reflDb = getReflDB();

function prevRefl(current: number): number {
    current--;
    if (current < 0) {
        current = reflDb.getSize() - 1;
    }
    return current;
}

function nextRefl(current: number): number {
    current ++;
    if (current >= reflDb.getSize()) {
        current = 0;
    }
    return current;
}

type ReflFilter = (refl: Matrix) => boolean;

function nextFilteredRefl(current: number, filter: ReflFilter): number {
    let attempt = 0;
    let index = current;
    while(true) {
        index = nextRefl(index);
        if (filter(reflDb.getRefl(index))) {
            console.log('attempt:', attempt);
            console.log('delta:', lastDelta);
            return index;
        }
        attempt++;
        if (attempt >= reflDb.getSize()) {
            return current;
        }
    }
}

function reflError(refl: Matrix): number {
    let err = 0;
    for (let i = 0; i < 31; i++) {
        const v = refl.getv(i);
        if (v > 1) {
            err += (v-1) * (v-1);
        } else if (v < 0) {
            err += v*v;
        }
    }
    return Math.sqrt(err);
}

function reflGenError(reflGen: ReflGen): number {
    const colors = ([
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [1, 1, 1]
    ]).map(c => srgbToXyz(Matrix.fromArray([c])));
   
    return colors.reduce((acc, xyz) => acc + reflError(reflGen.reflOfUnclipped(xyz)), 0);
}

function findOptReflGen() {
    const fileBase = './data/refl-gen-d65-opt';
    const fileName = `${fileBase}.json`;
    const fileOld  = `${fileBase}.old.json`;
    
    let minErr = Infinity;

    const oldExists = fs.existsSync(fileName);
    if (oldExists) {
        const sd = loadSpectrumData(fileName);
        const reflGen = new ReflGen(sd);
        minErr = reflGenError(reflGen);
        console.log('old sd error:', minErr);
    }

    const d55 = daylightSpectrum(6500);

    while (true) {
        reflDb.shuffle();
        const n = 100;
        const refls: Matrix[] = [];
        for (let i = 0; i < n; i++) {
            refls.push(reflDb.getRefl(i));
        }

        const sd = generateSpectrumData(refls, d55);
        const reflGen = new ReflGen(sd);
        const err = reflGenError(reflGen);
        if (err < minErr) {
            console.log('new sd error:', err);
            if (oldExists) {
                fs.renameSync(fileName, fileOld);
            }
            saveSpectrumData(fileName, sd);
            break;
        }
    }
}

function findNewReflGen(light: Matrix, refls: Matrix[]): ReflGen {
    const sd = generateSpectrumData(refls, light);
    return new ReflGen(sd);
}

let lastDelta = 0;

function closeToColor(xyz: Matrix, light: Matrix, tol: number) {
    const mtx = transmittanceToXyzMtx(light).transpose();
    return function(refl: Matrix): boolean {
        const xyz1 = refl.mmul(mtx);
        const d = deltaE94Xyz(xyz, xyz1);
        lastDelta = d;
        return d < tol;
    };
}

function closeToChroma(xyz: Matrix, light: Matrix, tol: number) {
    const mtx = transmittanceToXyzMtx(light).transpose();
    const xy = chromaticity(xyz);
    return function(refl: Matrix): boolean {
        const xyz1 = refl.mmul(mtx);
        const xy1 = chromaticity(xyz1);
        const dxy = xy.sub(xy1);
        const d = Math.sqrt(dxy.dot(dxy));
        lastDelta = d;
        return d < tol;
    };
}

interface LightSourceSpectrumAndColorProps {
    daylightTemp: number;
}

function LightSourceSpectrumAndColor(props: LightSourceSpectrumAndColorProps): React.ReactElement {
    const { daylightTemp } = props;
    
    const light = daylightSpectrum(daylightTemp);
    const coef = COLOR_MATCHING_MTX.row(1).dot(light);
    const xyzOfLight = light.mmul(COLOR_MATCHING_MTX.transpose()).mul(100 / coef);

    return (
        <div style={{ flex: '1 1 100px', display: 'flex' }}>
            <Spectrum31Plot
                data={[{
                    ys: light.toFlatArray(),
                    style: 'black',
                }]}
                containerStyle={{
                    width: '600px',
                    height: '400px'
                }}
                title="Light source spectrum"
                yrange={[0, 170]}
                ymarks={18}
            />
            <XYZColorBox
                xyz={xyzOfLight}
                size="400px"
            />
        </div>
    );
}

interface SRGBPickerProps {
    srgb: Matrix;
    onChange: (srgb: Matrix) => void;
}

function SRGBPicker(props: SRGBPickerProps): React.ReactElement {
    const { srgb, onChange } = props;
    return (
        <>
            <div>
                Color (srgb):
            </div>
            <div style={{ display: 'flex'}}>
                <ColorSliders
                    labels={['sRed', 'sGreen', 'sBlue']}
                    color={srgb}
                    onChange={onChange}
                />
                <div className="lab2item">
                    <RGBColorBox rgb={srgb} size="150px"/>
                </div>
            </div>
        </>
    );
}

interface LightSourceControlsProps {
    daylightTemp: number;
    onChange: (temp: number) => void;
}

function LightSourceControls(props: LightSourceControlsProps): React.ReactElement {
    const { daylightTemp, onChange } = props;
    return (
        <>
            <div>
                Light source:
            </div>
            <div style={{ width: '350px' }}>
                <Slider
                    min={4000}
                    max={10000}
                    step={100}
                    value={daylightTemp}
                    onChange={(_event, value) => {
                        onChange(value as number);
                    }}
                    marks={[
                        {
                            value: 5000,
                            label: 'D50'
                        },
                        {
                            value: 5500,
                            label: 'D55'
                        },
                        {
                            value: 6500,
                            label: 'D65'
                        },
                        {
                            value: 7500,
                            label: 'D75'
                        },
                    ]}
                    valueLabelDisplay="on"
                />
            </div>
        </>
    );
}

interface ReflGenOptControlsProps {
    iterations: string;
    reflGen: ReflGen | undefined;
    light: Matrix;
    onIterationsChange: (its: string) => void;
    onReflGenChange: (reflGen: ReflGen) => void;
}

function ReflGenOptControls(props: ReflGenOptControlsProps): React.ReactElement {
    const {
        iterations,
        reflGen,
        onIterationsChange,
        onReflGenChange,
        light,
    } = props;
    return (
        <div>
            <div>
                ReflGen Optimizer:
            </div>
            <div style={{ marginTop: '10px' }}>
                <TextField
                    label="Number of iterations"
                    variant="outlined"
                    value={iterations}
                    onChange={(event: any) => { onIterationsChange(event.target.value); }}
                />
            </div>
            <div>
                <Button onClick={() => {
                    const iters = parseInt(iterations);
                    if (isNaN(iters)) {
                        return;
                    }
                    let minErr = reflGen ? reflGenError(reflGen) : Infinity;
                    let optReflGen = reflGen;

                    for (let i = 0; i < iters; i++) {
                        try {
                            const refls = [
                                reflDb.getRefl(Math.trunc(Math.random() * reflDb.getSize())),
                                reflDb.getRefl(Math.trunc(Math.random() * reflDb.getSize())),
                                reflDb.getRefl(Math.trunc(Math.random() * reflDb.getSize())),
                            ];
                            const newReflGen = findNewReflGen(light, refls);
                            const err = reflGenError(newReflGen);
                            if (err < minErr) {
                                optReflGen = newReflGen; 
                                minErr = err;
                                console.log(`Achieved min at the ${i}th iteration`);
                                break;
                            }
                        } catch(e) {
                            console.error(e);
                        }
                    }
                    onReflGenChange(optReflGen);
                }}>Run iterations</Button>
            </div>
            <div>
                <Button onClick={() => {
                    if (!reflGen) {
                        return;
                    }
                    saveSpectralBasis('./data/spectral-bases/opt-spectral-basis.json', {
                        basis: reflGen.getBase().transpose()
                    });
                }}>Save</Button>
            </div>
        </div>
    );
}

/*
const spectrumFile =
    "./data/spectrum-d55-4.json";
const spectrumData = loadSpectrumData(spectrumFile);
const reflGen = new ReflGen(spectrumData);
 */

export function SpectraTab(props): React.ReactElement {
    const [ srgb, setSrgb ] = useState(Matrix.fromArray([[0, 0, 0]]));
    /*
    const [ index, setIndex ] = useState(0);
    const [ basisRadius, setBasisRadius ] = useState(0.1);
     */
    const [ newReflGen, setNewReflGen ] = useState(undefined);
    const [ daylightTemp, setDaylightTemp ] = useState(6500);
    const [ iterations, setIterations] = useState("0");

    const xyz = srgbToXyz(srgb);
    /*
    const d55 = daylightSpectrum(5500);
    const d65 = daylightSpectrum(6500);
    const xyzOfRefl = reflectanceUnderLightSource(reflDb.getReflStretched(index), d65);
     */
    const light = daylightSpectrum(daylightTemp);

    const minErr = newReflGen ? reflGenError(newReflGen) : Infinity;
    return (
        <div style={{ display: 'flex'}}>
            <div style={{ flex: '1 1 100px' }}>
                <LightSourceSpectrumAndColor daylightTemp={daylightTemp} />
                <div>Min err: {minErr}</div>
                <div>
                    {
                        newReflGen ? (
                            <div className="lab2item">
                                <SpectrumGenerator
                                    xyz={xyz}
                                    reflGen={newReflGen}
                                />
                            </div>) : undefined
                    }
                </div>
                <div>
                    { newReflGen ? (<Spectrum31Plot
                        data={[{
                            ys: newReflGen.getBase().transpose().row(0).toFlatArray(),
                            style: 'red',
                        }, {
                            ys: newReflGen.getBase().transpose().row(1).toFlatArray(),
                            style: 'green',
                        }, {
                            ys: newReflGen.getBase().transpose().row(2).toFlatArray(),
                            style: 'blue',
                        }]}
                        containerStyle={{
                            width: '600px',
                            height: '400px'
                        }}
                        title="New reflection generator base"
                        yrange={[-0.1, 1.3]}
                        ymarks={15}
                    />) : undefined }
                </div>
            </div>
            <div style={{ flex: '0 0 500px'}}>
                <SRGBPicker srgb={srgb} onChange={setSrgb} />
                <LightSourceControls daylightTemp={daylightTemp} onChange={setDaylightTemp} />
                <div style={{ marginTop: '15px'}}>
                    <ReflGenOptControls
                        reflGen={newReflGen}
                        iterations={iterations}
                        light={light}
                        onIterationsChange={setIterations}
                        onReflGenChange={(rg: ReflGen) => {
                            setNewReflGen(rg);
                        }}
                    />
                </div>
            </div>
        </div>
    );

    /*
    const chromeDist = useMemo(() => {
        const xys = reflDb.getChromaticities(d65);
        const rx = xys.row(0).toFlatArray();
        const ry = xys.row(1).toFlatArray();
        return (<Plot
            title="Chromaticity distribution of reflections under D65"
            lineWidth={1}
            plots={[{
                xs: rx,
                ys: ry,
                style: 'red',
                kind: 'scatter',
            }]}
            containerStyle={{
                width: '800px',
                height: '900px'
            }}
            xrange={[0, 0.8]}
            yrange={[0, 0.9]}
            xmarks={9}
            ymarks={10}
        />);
    }, []);
     */
/*
    return (
        <div>
            <div className="lab2cont">
                <div className="lab2item" style={{paddingTop: '15px'}}>
                    <ColorSliders
                        labels={['sRed', 'sGreen', 'sBlue']}
                        color={srgb}
                        onChange={setSrgb}
                    />
                </div>
                <div className="lab2item">
                    <RGBColorBox rgb={srgb} size="150px"/>
                </div>
                <div className="lab2item">
                    <h3>sRGB</h3>
                    <MatrixDisp mtx={srgb}/>
                </div>
                <div className="lab2item">
                    <h3>XYZ</h3>
                    <MatrixDisp mtx={xyz}/>
                </div>
            </div>
            <div>
                <div style={{display: 'flex'}}>
                    <p>Radius:</p>
                    <div style={{width: '200px', marginLeft: '10px'}}>
                        <Slider
                            min={0}
                            max={1.0}
                            step={0.01}
                            value={basisRadius}
                            onChange={(_event, value) => {
                                setBasisRadius(value as number);
                            }}
                            valueLabelDisplay="on"
                        />
                    </div>
                    <Button onClick={() => {
                        const refls: Matrix[] = [];
                        reflDb.shuffle();
                        //const filter = closeToChroma(xyz, basisRadius);
                        for (let i = 0; i < reflDb.getSize(); i++) {
                            const r = reflDb.getRefl(i);
                            //if (filter(r)) {
                                refls.push(r);
                            //}
                            if (refls.length >= 100) {
                                break;
                            }
                        }
                        if (refls.length > 0) {
                            console.log(`${refls.length} reflections found`);
                            const sd = generateSpectrumData(refls, d55);
                            console.log(sd);
                            setNewReflGen(new ReflGen(sd));
                        }
                        console.log(Matrix.fromArray([
                            [0, 0, 2],
                            [0, 1, 0],
                            [1, 0, 0]
                        ]).inv3x3().show());
                    }}>Make sp. gen.</Button>
                    <Button onClick={findOptReflGen}>Find opt. reflGen</Button>
                </div>
                <div className="lab2cont">
                    <div className="lab2item">
                        <SpectrumGenerator
                            xyz={xyz}
                            reflGen={reflGen}
                        />
                    </div>
                    {
                        newReflGen ? (
                            <div className="lab2item">
                                <SpectrumGenerator
                                    xyz={xyz}
                                    reflGen={newReflGen}
                                />
                            </div>) : undefined
                    }
                </div>
            </div>
            <div className="lab2cont">
                <div className="lab2item">
                    { newReflGen ? (<Spectrum31Plot
                        data={[{
                            ys: newReflGen.getBase().transpose().row(0).toFlatArray(),
                            style: 'red',
                        }, {
                            ys: newReflGen.getBase().transpose().row(1).toFlatArray(),
                            style: 'green',
                        }, {
                            ys: newReflGen.getBase().transpose().row(2).toFlatArray(),
                            style: 'blue',
                        }]}
                        containerStyle={{
                            width: '600px',
                            height: '400px'
                        }}
                        title="New reflection generator base"
                        yrange={[-0.1, 1.3]}
                        ymarks={15}
                    />) : undefined }
                </div>
            </div>
            <div className="lab2cont">
                <div className="lab2item">
                    <Button onClick={() => { setIndex(prevRefl(index)) }}>Prev</Button>
                </div>
                <div className="lab2item">
                    <Button onClick={() => { setIndex(nextRefl(index)) }}>Next</Button>
                </div>
                <div className="lab2item">
                    <Button onClick={() => {
                        setIndex(nextFilteredRefl(index, closeToChroma(xyz, basisRadius)));
                    }}>Next filtered</Button>
                </div>
            </div>
            <div className="lab2cont">
                <div className="lab2item">
                    <Spectrum31Plot
                        data={[{
                            ys: reflDb.getRefl(index).toFlatArray(),
                            style: 'black',
                        }]}
                        containerStyle={{
                            width: '600px',
                            height: '400px'
                        }}
                        title="Reflection found"
                        yrange={[-0.1, 1.3]}
                        ymarks={15}
                    />
                </div>
                <div className="lab2item">
                    <XYZColorBox xyz={xyzOfRefl} size="200px"/>
                </div>
            </div>
            {/*
            <div className="lab2cont">
                <div className="lab2item">
                    {chromeDist}
                </div>
            </div>
              * /}
        </div>
    );
*/
}
