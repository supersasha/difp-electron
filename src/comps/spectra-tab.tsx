import * as React from 'react';
import { useState, useRef, useMemo } from 'react';
import { Matrix } from '../matrix';
import { Button, Slider } from '@mui/material';

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
    generateSpectrumData
} from '../spectrum';
import { loadSpectrumData, saveSpectrumData } from '../data';

import { nmf } from '../nmf';

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

let lastDelta = 0;

function closeToColor(xyz: Matrix, tol: number) {
    const d65 = daylightSpectrum(6500);
    const mtx = transmittanceToXyzMtx(d65).transpose();
    return function(refl: Matrix): boolean {
        const xyz1 = refl.mmul(mtx);
        const d = deltaE94Xyz(xyz, xyz1);
        lastDelta = d;
        return d < tol;
    };
}

function closeToChroma(xyz: Matrix, tol: number) {
    const d65 = daylightSpectrum(6500);
    const mtx = transmittanceToXyzMtx(d65).transpose();
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

const spectrumFile =
    "./data/spectrum-d55-4.json";
const spectrumData = loadSpectrumData(spectrumFile);
const reflGen = new ReflGen(spectrumData);

export function SpectraTab(props): React.ReactElement {
    const [ srgb, setSrgb ] = useState(Matrix.fromArray([[0, 0, 0]]));
    const [ index, setIndex ] = useState(0);
    const [ basisRadius, setBasisRadius ] = useState(0.1);
    const [ newReflGen, setNewReflGen ] = useState(undefined);

    const xyz = srgbToXyz(srgb);
    const d55 = daylightSpectrum(5500);
    const d65 = daylightSpectrum(6500);
    const xyzOfRefl = reflectanceUnderLightSource(reflDb.getRefl(index), d65);

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
                        setIndex(nextFilteredRefl(index, closeToChroma(xyz, 0.005)));
                    }}>Next filtered</Button>
                </div>
                <div className="lab2item">
                    <Button onClick={() => {
                        /*
                        const n = 3;
                        const m = 3;
                        const f = 2;
                        const v = Matrix.random([n, m]).mul(100);
                        const r = nmf(v, f);
                        console.log('NMF:', r.iter, v.sub(r.w.mmul(r.h)).norm1() / n / m);
                        console.log(v.show(4));
                        console.log(r.w.mmul(r.h).show(4));
                        console.log(v.sub(r.w.mmul(r.h)).norm1());
                         */
                        const a: Matrix[] = [];
                        const n = 500;
                        const m = 31;
                        const f = 3;
                        for (let i = 0; i < n; i++) {
                            a.push(reflDb.getRefl(i));
                        }
                        const v = Matrix.fromRows(a);
                        const r = nmf(v, f);
                        console.log('NMF:', r.iter, v.sub(r.w.mmul(r.h)).norm1() / n / m);
                        console.log(v.show(4));
                        console.log(r.w.mmul(r.h).show(4));
                        console.log(v.sub(r.w.mmul(r.h)).norm1());
                    }}>NMF</Button>
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
            <div className="lab2cont">
                <div className="lab2item">
                    {chromeDist}
                </div>
            </div>
        </div>
    );
}
