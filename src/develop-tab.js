import { Button, Switch, Slider, Tabs } from 'antd';
import React, { useState } from 'react';
import 'antd/dist/antd.css';

import fs from 'fs';

import { Matrix } from './matrix';
import { xyzToSrgb, srgbToXyz,} from './colors';
import { logExposure, transmittance } from './spectrum';
import { Developer } from './profiler';
import { Plot, Spectrum31Plot, linspace } from './plot';
import { fill } from './generators';
import { RGBColorBox } from './colorbox';

import nlopt from 'nlopt-js';

export function DevelopTab(props) {
    const [red, setRed] = useState(0);
    const [green, setGreen] = useState(0);
    const [blue, setBlue] = useState(0);
    const [lightness, setLightness] = useState(1);
    const [densCyan, setDensCyan] = useState(0);
    const [densMagenta, setDensMagenta] = useState(0);
    const [densYellow, setDensYellow] = useState(0);
    const [hCyan, setHCyan] = useState(0);
    const [hMagenta, setHMagenta] = useState(0);
    const [hYellow, setHYellow] = useState(0);
    const rgb0 = Matrix.fromArray([lightness*red, lightness*green, lightness*blue]);
    const profile = JSON.parse(fs.readFileSync('./data/b29-50d.json'));
    const couplers = Matrix.fromArray(profile.couplers);

    const dev = new Developer();
    dev.makeCouplersFromMatrix(couplers);
    dev.setup();

    const betaXs = Matrix.fromArray([[...linspace(-6, 2, 100)]]);
    const betaRs = betaXs.map(x => dev.beta(x).getv(0));
    const betaGs = betaXs.map(x => dev.beta(x).getv(1));
    const betaBs = betaXs.map(x => dev.beta(x).getv(2));

    const deltaXs = Matrix.fromArray([[...linspace(-6, 2, 100)]]);
    const deltaYs = deltaXs.map(x => dev.delta(x));

    const xyz0 = srgbToXyz(rgb0);
    const xyz1 = dev.develop(xyz0);
    const rgb1 = xyzToSrgb(xyz1);

    const spectrum31Xs = Matrix.fromArray([...linspace(400, 700, 31)]);
    const refl = dev.reflGen.reflOf(xyz0).map(x => x * 100);
    const spectrum = dev.reflGen.spectrumOf(xyz0);

    const xyzD = dev.dyesToXyz(dev.paperDyes,
        Matrix.fromArray([[densCyan, densMagenta, densYellow]]));
    const rgbD = xyzToSrgb(xyzD);

    //const spD = dev.reflGen.spectrumOf(xyzD);
    const transD = transmittance(dev.paperDyes0,
        Matrix.fromArray([[densCyan, densMagenta, densYellow]]));
    const exposD = logExposure(dev.filmSense, transD.elementWise((e1, e2) => e1 * e2, dev.devLight));

    const h = Matrix.fromArray([hCyan, hMagenta, hYellow]);
    const [devFilmDyes, devFilmCouplers] = dev.developFilmSep(h);
    const devFilm = devFilmDyes.add(devFilmCouplers);

    return (
        <>
            <div style={{ display: 'flex' }}>
                <div style={{width: '420px'}}>
                    <div>Lightness</div>
                    <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={lightness}
                        onChange={setLightness}
                    />
                    <div>Red</div>
                    <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={red}
                        onChange={setRed}
                    />
                    <div>Green</div>
                    <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={green}
                        onChange={setGreen}
                    />
                    <div>Blue</div>
                    <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={blue}
                        onChange={setBlue}
                    />
                    <div style={{ display: 'flex' }}>
                    <RGBColorBox size={200} red={lightness*red} green={lightness*green} blue={lightness*blue} />
                    <RGBColorBox size={200} red={rgb1.getv(0)} green={rgb1.getv(1)} blue={rgb1.getv(2)} />
                    </div>
                </div>
                <Plot containerStyle={{ width: '600px', height: '500px' }}
                    title="Beta"
                    xmarks={17}
                    xmarkFormat="fixed:1"
                    yrange={[-3.20, -0.90]}
                    plots={[
                        {
                            xs: betaXs.toFlatArray(),
                            ys: betaRs.toFlatArray(),
                            style: 'red',
                        },
                        {
                            xs: betaXs.toFlatArray(),
                            ys: betaGs.toFlatArray(),
                            style: 'green',
                        },
                        {
                            xs: betaXs.toFlatArray(),
                            ys: betaBs.toFlatArray(),
                            style: 'blue',
                        },
                    ]}
                />
                <Plot containerStyle={{ width: '600px', height: '500px' }}
                    title="Delta"
                    xmarks={17}
                    xmarkFormat="fixed:1"
                    lineWidth={3}
                    yrange={[-0.1, 3.9]}
                    plots={[
                        {
                            xs: deltaXs.toFlatArray(),
                            ys: deltaYs.toFlatArray(),
                            style: 'violet',
                        },
                    ]}
                />
            </div>
            <div style={{ display: 'flex' }}>
                <Plot
                    containerStyle={{ width: '800px', height: '500px'}}
                    title="Refl (green) vs Spectrum (blue)"
                    xmarks={31}
                    xmarkFormat="fixed:0"
                    ymarkFormat="fixed:4"
                    yrange={[0, 110]}
                    lineWidth={2}
                    plots={[
                        {
                            xs: spectrum31Xs.toFlatArray(),
                            ys: refl.toFlatArray(),
                            style: 'green',
                        },
                        {
                            xs: spectrum31Xs.toFlatArray(),
                            ys: spectrum.toFlatArray(),
                            style: 'blue',
                        },
                    ]}
                />
                <div style={{display: 'flex'}}>
                    <div style={{ width: '200px', display: 'flex', flexDirection: 'column', marginRight: '20px' }}>
                        <div>Cyan density</div>
                        <Slider
                            min={0}
                            max={4}
                            step={0.01}
                            value={densCyan}
                            onChange={setDensCyan}
                        />
                        <div>Magenta density</div>
                        <Slider
                            min={0}
                            max={4}
                            step={0.01}
                            value={densMagenta}
                            onChange={setDensMagenta}
                        />
                        <div>Yellow density</div>
                        <Slider
                            min={0}
                            max={4}
                            step={0.01}
                            value={densYellow}
                            onChange={setDensYellow}
                        />
                        <div>
                            {`XYZ: ${xyzD.show()}`}
                        </div>
                        <div>
                            {`Exposure density: ${exposD.show(4)}`}
                        </div>
                        <div>
                            <Button onClick={() => {
                                //console.log(`[[${densCyan}, ${densMagenta}, ${densYellow}], [${exposD.getv(0).toFixed(4)}, ${exposD.getv(1).toFixed(4)}, ${exposD.getv(2).toFixed(4)}]],`);
                                const colors = [
                                    [[0, 0, 0], [0.0000, 0.0000, 0.0000]],
                                    [[0.5, 0, 0], [-0.6219, -0.1014, -0.0652]],
                                    [[0, 0.5, 0], [-0.0573, -0.5112, -0.0828]],
                                    [[0, 0, 0.5], [-0.0088, -0.0504, -0.4753]],
                                    [[1, 0, 0], [-1.1959, -0.1930, -0.1245]],
                                    [[0, 1, 0], [-0.1090, -0.9883, -0.1620]],
                                    [[0, 0, 1], [-0.0176, -0.0956, -0.9301]],
                                    [[1.33, 0.59, 0], [-1.6807, -0.8592, -0.2672]],
                                    [[0, 1.14, 1.09], [-0.1416, -1.2469, -1.1997]],
                                    [[1.32, 0, 1.09], [-1.5556, -0.3761, -1.1993]],
                                    [[0.5, 0.5, 0.5], [-0.7051, -0.6824, -0.6351]],
                                    [[1, 1, 1], [-1.3969, -1.3569, -1.2642]],
                                    [[2, 2, 2], [-2.7389, -2.6802, -2.5027]],
                                    [[1.32, 1.29, 0], [-1.8037, -1.5170, -0.3850]],
                                ];
                                const cmyrgb = colors.map(([cmy, rgb]) => (
                                    [Matrix.fromArray([cmy]), Matrix.fromArray([rgb])]
                                ));
                                const opt = nlopt.Optimize(nlopt.Algorithm.LN_PRAXIS, 9);
                                opt.setMinObjective((x, grad) => {
                                    const mtx = Matrix.fromArray([
                                        [x[0], x[1], x[2]],
                                        [x[3], x[4], x[5]],
                                        [x[6], x[7], x[8]],
                                    ]);
                                    //const v = Matrix.fromArray([[x[9], x[10], x[11]]]);
                                    let s = 0;
                                    for (let i = 0; i < cmyrgb.length; i++) {
                                        const [cmy, rgb] = cmyrgb[i];
                                        const d = rgb.mmul(mtx)/*.add(v)*/.sub(cmy);
                                        //console.log('d:', d);
                                        s += d.dot(d);
                                    }
                                    return s;
                                }, 1e-6);
                                opt.setLowerBounds([...fill(9, -10)]);
                                opt.setUpperBounds([...fill(9,  10)]);
                                const res = opt.optimize([...fill(9, 0)]);
                                console.log(res);
                                const x = res.x;
                                const mtx = Matrix.fromArray([
                                    [x[0], x[1], x[2]],
                                    [x[3], x[4], x[5]],
                                    [x[6], x[7], x[8]],
                                ]);
                                console.log(mtx.show(4));
                                for (let i = 0; i < cmyrgb.length; i++) {
                                    const [cmy, rgb] = cmyrgb[i];
                                    console.log(cmy.show(), rgb.show(), '-->', rgb.mmul(mtx).show());
                                }
                            }}>
                                opt mtx 2
                            </Button>
                        </div>
                        <div>
                            <Button onClick={async () => {
                                await nlopt.ready;
                                const n = 1000;
                                const rnd = () => Math.random() * 4;
                                const xyzs = [];
                                for (let i = 0; i < n; i++) {
                                    const cmy = Matrix.fromArray([[rnd(), rnd(), rnd()]]);
                                    const xyz = dev.dyesToXyz(dev.paperDyes, cmy);
                                    //console.log([cmy, xyz]);
                                    xyzs.push([cmy.map(x => Math.pow(10, -x)), xyz]);
                                }
                                const opt = nlopt.Optimize(nlopt.Algorithm.GN_ISRES, 12);
                                opt.setMinObjective((x, grad) => {
                                    const mtx = Matrix.fromArray([
                                        [x[0], x[1], x[2]],
                                        [x[3], x[4], x[5]],
                                        [x[6], x[7], x[8]],
                                    ]);
                                    const v = Matrix.fromArray([[x[9], x[10], x[11]]]);
                                    let s = 0;
                                    for (let i = 0; i < n; i++) {
                                        const [cmy, xyz] = xyzs[i];
                                        const d = xyz.mmul(mtx).add(v).sub(cmy);
                                        //console.log('d:', d);
                                        s += d.dot(d);
                                    }
                                    console.log('s:', 1000 * s);
                                    return 1000 * s;
                                }, 1e-10);
                                opt.setLowerBounds([...fill(12, -100)]);
                                opt.setUpperBounds([...fill(12,  100)]);
                                const res = opt.optimize([...fill(12, 0)]);
                                console.log(res);
                                const x = res.x;
                                const mtx = Matrix.fromArray([
                                    [x[0], x[1], x[2]],
                                    [x[3], x[4], x[5]],
                                    [x[6], x[7], x[8]],
                                ]);
                                const v = Matrix.fromArray([[x[9], x[10], x[11]]]);
                                function log10(v) {
                                    return Math.log(v) / Math.LN10;
                                }
                                for (let i = 0; i < n; i++) {
                                    const [cmy, xyz] = xyzs[i];
                                    const cmy1 = cmy.map(x => -log10(x));
                                    console.log(cmy1.show(), xyz.show(), '-->', xyz.mmul(mtx).add(v).map(x => Math.pow(10, -x)).show());
                                }
                            }}>
                                opt mtx
                            </Button>
                        </div>
                    </div>
                    <RGBColorBox
                        size={300}
                        red   ={rgbD.getv(0)}
                        green ={rgbD.getv(1)}
                        blue  ={rgbD.getv(2)}
                    />
                </div>
            </div>
            <div>
                <div style={{ display: 'flex', flexDirection: 'row'}}>
                    <div style={{ width: '200px' }}>
                        <div>H_cyan</div>
                        <Slider
                            min={-5}
                            max={0}
                            step={0.01}
                            value={hCyan}
                            onChange={setHCyan}
                        />
                    </div>
                    <div style={{ width: '200px' }}>
                        <div>H_magenta</div>
                        <Slider
                            min={-5}
                            max={0}
                            step={0.01}
                            value={hMagenta}
                            onChange={setHMagenta}
                        />
                    </div>
                    <div style={{ width: '200px' }}>
                        <div>H_yellow</div>
                        <Slider
                            min={-5}
                            max={0}
                            step={0.01}
                            value={hYellow}
                            onChange={setHYellow}
                        />
                    </div>
                </div>
                <div style={{ display: 'flex' }}>
                    <Spectrum31Plot containerStyle={{ width: '800px', height: '600px' }}
                        yrange={[-0.1, 4]}
                        data={[
                            {
                                ys: devFilmDyes.row(0).toFlatArray(),
                                style: 'cyan',
                            },
                            {
                                ys: devFilmDyes.row(1).toFlatArray(),
                                style: 'magenta',
                            },
                            {
                                ys: devFilmDyes.row(2).toFlatArray(),
                                style: 'yellow',
                            },
                            {
                                ys: devFilmCouplers.row(0).toFlatArray(),
                                style: 'red',
                            },
                            {
                                ys: devFilmCouplers.row(1).toFlatArray(),
                                style: 'green',
                            },
                            {
                                ys: devFilmCouplers.row(2).toFlatArray(),
                                style: 'blue',
                            },
                        ]}
                    />
                    <Spectrum31Plot containerStyle={{ width: '800px', height: '600px' }}
                        yrange={[-0.1, 4]}
                        data={[
                            {
                                ys: devFilm.row(0).toFlatArray(),
                                style: 'cyan',
                            },
                            {
                                ys: devFilm.row(1).toFlatArray(),
                                style: 'magenta',
                            },
                            {
                                ys: devFilm.row(2).toFlatArray(),
                                style: 'yellow',
                            },
                        ]}
                    />
                </div>
            </div>
        </>
    );
}
