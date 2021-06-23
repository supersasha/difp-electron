import { Button, Switch, Slider, Tabs } from 'antd';
import React, { useState } from 'react';
import 'antd/dist/antd.css';

import fs from 'fs';

import { Matrix } from './matrix';
import { xyzToSrgb, srgbToXyz, Developer } from './profiler';
import { Plot, Spectrum31Plot, linspace } from './plot';

export function RGBColorBox(_props) {
    const defaultProps = {
        size: 100,
        red: 0,
        green: 0,
        blue: 0
    };
    const props = {...defaultProps, ..._props};
    return (
        <div style={{
            width: props.size,
            height: props.size,
            background: `rgb(${props.red*100}%, ${props.green*100}%, ${props.blue*100}%)`
        }}>
        </div>
    );
}

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
    console.log('xyzD:', xyzD);
    const rgbD = xyzToSrgb(xyzD);
    console.log('rgbD:', rgbD);

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
