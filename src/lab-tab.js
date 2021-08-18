import React, { useState } from 'react';
import { neg, mul, div, Chi, sub, add } from './math';
import { loadDatasheet, loadSpectrumData } from './data';
import {
    ReflGen,
    daylightSpectrum,
    normalizedDyes,
    normalizedSense,
    layerTransmittance,
    logExposure,
    transmittance,
    transmittanceToXyzMtx,
} from './spectrum';
import { linspace, fill } from './generators';
import { Matrix } from './matrix';
import { Plot } from './plot';
import { RGBColorBox, XYZColorBox } from './colorbox';
import { srgbToXyz, xyzToSrgb, deltaE94Xyz } from './colors';

import fs from 'fs';
import { Slider, Radio, Button } from 'antd';
import 'antd/dist/antd.css';

import nlopt from 'nlopt-js';

let _LabInst;
class Lab {
    static instance() {
        if (!_LabInst) {
            _LabInst = new Lab();
        }
        return _LabInst;
    }

    constructor() {
        this.h0 = -2 // -2 for minimal curvature of gamma curves
        this.inColors = [];
        this.outColors = [];
        const pg = 5.5;
        this.paperGammas = Matrix.fromArray([[pg, pg, pg]]);

        const filmDsFile =
            "./data/kodak-vision3-50d-5203-2.datasheet";
        const paperDsFile =
            "./data/kodak-vision-color-print-2383-2.datasheet";
        const spectrumFile =
            "./data/spectrum-d55-4.json";
        const spectrumData = loadSpectrumData(spectrumFile);

        this.filmDs = loadDatasheet(filmDsFile);
        this.paperDs = loadDatasheet(paperDsFile);
        this.reflGen = new ReflGen(spectrumData);

        this.devLight = daylightSpectrum(5500);
        this.projLight = daylightSpectrum(5500);
        this.reflLight = daylightSpectrum(6500);

        this.mtxRefl = transmittanceToXyzMtx(this.reflLight);
        this.mtxD55 = transmittanceToXyzMtx(daylightSpectrum(5500));

        this.filmSense = normalizedSense(this.filmDs.sense, this.devLight);
        this.paperSense = normalizedSense(this.paperDs.sense, this.projLight);

        this.filmDyes = normalizedDyes(this.filmDs.dyes, this.projLight, 1.0);
        this.paperDyes = normalizedDyes(this.paperDs.dyes, this.reflLight, 1.0);

        /*
        // gamma[x, y],
        // where x - sensor, //segment
        //       y - layer
        this.filmGammas = Matrix.fromArray([
            [ -0.8447,  0.1581,  0.0921 ],
            [  0.1256, -1.0433,  0.1668 ],
            [ -0.0122,  0.1356, -1.0807 ],
        ]).transpose().map(neg).rowWise(div, this.paperGammas);
        */

        this.gammas = this.findGammas();
        // filmGammas.get(sensor, layer)
        this.filmGammas = this.gammas/*.map(neg)*/.rowWise(div, this.paperGammas);

        console.log('film gammas:', this.filmGammas.show(4));

        const qs = [];
        for (let layer = 0; layer < 3; layer++) {
            qs.push(this.findDyeQuantities(layer, this.h0));
        }
        this.qs = Matrix.fromArray(qs);
        console.log('qs:', this.qs.show());
        this.filmDyesQ = this.filmDyes.rowWise(mul, Matrix.fromArray([
            this.qs.get(0, 0),
            this.qs.get(1, 1),
            this.qs.get(2, 2),
        ]));
        this.couplers = Matrix.fromArray([
            this.filmDyes.row(1).mul(this.qs.get(0, 1)).add(this.filmDyes.row(2).mul(this.qs.get(0, 2))).toFlatArray(),
            this.filmDyes.row(0).mul(this.qs.get(1, 0)).add(this.filmDyes.row(2).mul(this.qs.get(1, 2))).toFlatArray(),
            this.filmDyes.row(0).mul(this.qs.get(2, 0)).add(this.filmDyes.row(1).mul(this.qs.get(2, 1))).toFlatArray(),
        ]);
        console.log('Couplers:', this.couplers);
        this.chiFilm = [
            new Chi(this.h0, 0, 0, this.qs.get(0, 0)),
            new Chi(this.h0, 0, 0, this.qs.get(1, 1)),
            new Chi(this.h0, 0, 0, this.qs.get(2, 2)),
        ];
        this.chiPaper = [
            Chi.to(0, 4, this.paperGammas.getv(0), 0),
            Chi.to(0, 4, this.paperGammas.getv(1), 0),
            Chi.to(0, 4, this.paperGammas.getv(2), 0),
        ];
        console.log('Chi paper:', this.chiPaper);

        const rgb0 = Matrix.fromArray([[0.1, 0.1, 0.1]]);
        const xyz0 = srgbToXyz(rgb0);
        const xyz1 = this.develop(xyz0, Matrix.fromArray([[-0.20, -0.65, -0.44]])); 
                                    //Matrix.fromArray([[-0.23, -0.51, -0.35]]));
                                    //Matrix.fromArray([[-0.2, -0.7, -0.5]]));
        const rgb1 = xyzToSrgb(xyz1);
        console.log(`From XYZ ${xyz0.show()} get ${xyz1.show()}`);
        console.log(`From ${rgb0.show()} get ${rgb1.show()}`);

        //this.findCorrs();
    }

    develop(xyz, corr) {
        const sp = this.reflGen.spectrumOf(xyz);
        console.log('sp:', sp.show());
        const H = logExposure(this.filmSense, sp);
        console.log('H:', H.show());
        const negative = this.developFilm(H);
        console.log('negative:', negative.show());
        const positive = this.developPaper(negative, corr);
        console.log('positive:', positive.show());
        return this.dyesToXyz(positive, Matrix.fill([1, 3], 1));
    }

    developFilm(H) {
        const [developedDyes, developedCouplers] = this.developFilmSep(H);
        return developedDyes.add(developedCouplers);
    }

    developFilmSep(H) {
        const dev = Matrix.fromArray([[
            this.chiFilm[0].get(H.getv(0)),
            this.chiFilm[1].get(H.getv(1)),
            this.chiFilm[2].get(H.getv(2)),
        ]]);
        const developedDyes = this.filmDyes.rowWise((e1, e2) => e1 * e2, dev);
        const cDev = Matrix.fromArray([[
            1 - dev.getv(0) / this.qs.get(0, 0),
            1 - dev.getv(1) / this.qs.get(1, 1),
            1 - dev.getv(2) / this.qs.get(2, 2),
        ]]);
        const developedCouplers = this.couplers.rowWise((e1, e2) => e1 * e2, cDev);
        return [developedDyes, developedCouplers];
    }
    
    developPaper(negative, corr) {
        const trans = transmittance(negative, Matrix.fill([1, 3], 1));
        console.log('neg trans:', trans.show());
        const sp = trans.elementWise((e1, e2) => e1 * e2, this.projLight);
        console.log('neg sp:', sp.show());

        // log10(10^paper_sense % sp)
        const H1 = logExposure(this.paperSense.rowWise(sub, corr), sp);
        console.log('paper exposure:', H1.show());
        const dev = Matrix.fromArray([[
            this.chiPaper[0].get(H1.getv(0)),
            this.chiPaper[1].get(H1.getv(1)),
            this.chiPaper[2].get(H1.getv(2)),
        ]]);
        console.log('paper dev:', dev.show(4));
        return this.paperDyes.rowWise((e1, e2) => e1 * e2, dev);
    }

    dyesToXyz(dyes, qs) {
        const trans = transmittance(dyes, qs);
        return this.mtxRefl.mmul(trans.transpose()).transpose();
    }

    dyesToXyzD55(dyes, qs) {
        const trans = transmittance(dyes, qs);
        return this.mtxD55.mmul(trans.transpose()).transpose();
    }

    testColors() {
        return [
            //[[0, 0, 0], []],
            [[0.5, 0, 0], [-0.3897, -0.0938, -0.0563]],
            [[0, 0.5, 0], [-0.0281, -0.3874, -0.0713]],
            [[0, 0, 0.5], [-0.0033, -0.0747, -0.4091]],
            [[1, 0, 0], [-1.1341, -0.1501, -0.0973]],
            [[0, 1, 0], [-0.0646, -0.7432, -0.1307]],
            [[0, 0, 1], [-0.0040, -0.1161, -0.8092]],
            [[1.33, 0.59, 0], [-1.4152, -0.6232, -0.1995]],
            [[1.32, 0, 1.09], [-1.2479, -0.3218, -0.9861]],
            [[1.32, 1.29, 0], [-1.2095, -1.1084, -0.2866]],
            [[0.58, 0.84, 0.0], [-0.5301, -0.7123, -0.1664]],
            [[1.54, 0.0, 1.8], [-1.3268, -0.4243, -1.4027]],

            // reds
            [[0, 1.14, 1.09], [-0.0998, -0.9517, -0.9881]],
            [[0.0, 1.82, 1.74], [-0.2047, -1.4659, -1.5213]],
            [[0.0, 1.5, 1.89], [-0.1617, -1.2659, -1.5818]],

            // grays
            [[0.1, 0.1, 0.1], [-0.0258, -0.1186, -0.1126]],
            [[0.5, 0.5, 0.5], [-0.4209, -0.5208, -0.5124]],
            [[1, 1, 1], [-0.9169, -1.0187, -1.0099]],
            [[2, 2, 2], [-1.8939, -1.9989, -1.9965]],
        ];
    }

    findGammas() {
        // Mapping from dye quantities to exposure densities
        const colors = this.testColors();
        const cmyrgb = colors.map(([cmy, rgb]) => (
            [Matrix.fromArray([cmy]), Matrix.fromArray([rgb])]
        ));
        const opt = nlopt.Optimize(nlopt.Algorithm.LN_COBYLA, 9);
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
        //const v = Matrix.fromArray([[x[9], x[10], x[11]]]);
        console.log(mtx.show(4));
        for (let i = 0; i < cmyrgb.length; i++) {
            const [cmy, rgb] = cmyrgb[i];
            console.log(cmy.show(), rgb.show(), '-->', rgb.mmul(mtx)/*.add(v)*/.show());
            this.inColors.push(this.dyesToXyz(this.paperDyes, cmy));
            this.outColors.push(this.dyesToXyz(this.paperDyes, rgb.mmul(mtx)/*.add(v)*/));
        }
        return mtx.transpose();
        //mtx.transpose().map(neg).rowWise(div, this.paperGammas);
    }

    filmTransExpoDensityPaper(h, layer, sensor, chiFilmDyeLayer, qs) {
        let sp = this.filmDyes.row(layer).mul(chiFilmDyeLayer.at(h));
        for (let lr = 0; lr < 3; lr++) {
            if (lr === layer) {
                continue;
            }
            sp = sp.add(this.filmDyes.row(lr).mul(qs.getv(lr) * (1 - chiFilmDyeLayer.at(h)/chiFilmDyeLayer.ymax)));
        }
        return logExposure(this.paperSense, layerTransmittance(sp, 1.0).elementWise(mul, this.projLight)).getv(sensor);
    }

    findDyeQuantities(layer, h0) {
        const opt = nlopt.Optimize(nlopt.Algorithm.LN_COBYLA, 3);
        opt.setMinObjective((x, grad) => {
            const qs = Matrix.fromArray([
                [x[0], x[1], x[2]],
            ]);
            /*
             * Choose quantities of dye and couplers for each layer
             * so that the resulting logExposure gammas match those in filmGammas matrix
             */
            const hmin = h0;
            const hmax = 0;
            let s = 0;
            const chi = new Chi(h0, 0, 0, qs.getv(layer));
            for (let sensor = 0; sensor < 3; sensor++) {
                const ed0 = this.filmTransExpoDensityPaper(hmin, layer, sensor, chi, qs);
                const ed1 = this.filmTransExpoDensityPaper(hmax, layer, sensor, chi, qs);
                const gamma = (ed1 - ed0) / (hmax - hmin);
                const diff = gamma - this.filmGammas.get(sensor, layer);
                s += diff * diff;
            }
            return s;
        }, 1e-10);
        opt.setLowerBounds([...fill(3, 0.001)]);
        opt.setUpperBounds([...fill(3, 4)]);
        const res = opt.optimize([...fill(3, 0.1)]);
        console.log(`Dye quantities (${layer}):`, res);
        return res.x;
    }

    findCorrs() {
        const opt = nlopt.Optimize(nlopt.Algorithm.LN_COBYLA, 3);
        const colors = this.testColors().map(([cmy, rgb]) => this.dyesToXyz(this.paperDyes, Matrix.fromArray([cmy])));
        opt.setMinObjective((x, grad) => {
            const corrs = Matrix.fromArray([
                [x[0], x[1], x[2]],
            ]);
            let s = 0;
            for (let xyz0 of colors) {
                const xyz1 = this.develop(xyz0, corrs);
                const d = deltaE94Xyz(xyz0, xyz1);
                s += d*d;
            }
            console.log('****S:', s);
            return s;
        }, 1e-10);
        opt.setLowerBounds([...fill(3, -5)]);
        opt.setUpperBounds([...fill(3, 0)]);
        const res = opt.optimize([...fill(3, -1.0)]);
        console.log(`Corrs:`, res);
        return res.x;
    }

    profile() {
        return {
            couplers: this.couplers.toArray(),
            dev_light: this.devLight.toFlatArray(),
            film_dyes: this.filmDyes.toArray(),
            film_max_qs: [this.qs.get(0, 0), this.qs.get(1, 1), this.qs.get(2, 2)],
            film_sense: this.filmSense.toArray(),
            mtx_refl: this.mtxRefl.toArray(),
            neg_gammas: [0, 0, 0], // no use
            paper_dyes: this.paperDyes.toArray(),
            paper_gammas: this.paperGammas.toFlatArray(),
            paper_sense: this.paperSense.toArray(),
            proj_light: this.projLight.toFlatArray(),
        }
    }
}

export function LabTab(props) {
    const [ logexp, setLogexp ] = useState(0);
    const [ devColor, setDevColor ] = useState(0);
    const [ couplerQs, setCouplerQs ] = useState(Matrix.fromArray([[0, 0, 0]]));
    const [ cmy, setCmy ] = useState(Matrix.fromArray([[0, 0, 0]]));
    const [ corr, setCorr ] = useState(Matrix.fromArray([[0, 0, 0]]));
    
    const lab = Lab.instance();
    const h0 = lab.h0;

    const xs = Matrix.fromArray([[...linspace(h0-1, 1, 100)]]);

    const spectrumXs = [...linspace(400, 700, 31)];

    const dyeStyles = [ 'cyan', 'magenta', '#cc0' ];
    const couplerStyles = [ 'red', 'green', 'blue' ];

    function expos(h, layer, sensor) {
        return lab.filmTransExpoDensityPaper(
            h, layer, sensor, lab.chiFilm[layer], lab.qs.row(layer)
        );
    }

    const hs = Matrix.fromArray([[...linspace(h0-1, 1, 100)]]);

    const light = daylightSpectrum(6500);
    const trmx = transmittanceToXyzMtx(light);
    const trans = transmittance(lab.couplers, Matrix.fromArray([[1, 1, 1]]));
    const sp = trans.elementWise((e1, e2) => e1 * e2, lab.projLight);
    const Hc = logExposure(lab.paperSense, sp);
    console.log('Hc:', Hc.show());
    const xyz = trmx.mmul(trans.transpose());

    

    const xyzOfCmy = lab.dyesToXyzD55(lab.paperDyes, cmy);
    const refl = lab.reflGen.reflOf(xyzOfCmy);
    const mtxD55Xyz = transmittanceToXyzMtx(daylightSpectrum(5500));
    const mtxD65Xyz = transmittanceToXyzMtx(daylightSpectrum(6500));
    const xyzOfRefl = mtxD55Xyz.mmul(refl.transpose()).transpose();
    const xyzOfReflD65 = mtxD65Xyz.mmul(refl.transpose()).transpose();
    const spectrum = lab.reflGen.spectrumOf(xyzOfCmy);
    const Hcmy = logExposure(lab.filmSense, spectrum);

    const initXyz = xyzOfCmy;
    const devXyz = lab.develop(initXyz, corr);

    return (
        <>
            <textarea readOnly rows="3" cols="25">
                {lab.filmGammas.show(4)}
            </textarea>
            <div style={{display: 'flex'}}>
                {
                    lab.inColors.map((c, i) => (
                        <XYZColorBox key={i} size={50} xyz={c} />
                    ))
                }
            </div>
            <div style={{display: 'flex'}}>
                {
                    lab.outColors.map((c, i) => (
                        <XYZColorBox key={i} size={50} xyz={c} />
                    ))
                }
            </div>
            <Button onClick={() => {
                const data = JSON.stringify(lab.profile(), null, 4);
                fs.writeFileSync('./data/new-profile.json', data);
            }}>
                Save profile
            </Button>
            <div style={{display: 'flex'}}>
                <div style={{width: '150px'}}>
                    <div>
                        C
                        <Slider
                            min={0}
                            max={4}
                            step={0.01}
                            value={cmy.getv(0)}
                            onChange={v => setCmy(cmy.copy().setv(0, v))}
                        />
                    </div>
                    <div>
                        M
                        <Slider
                            min={0}
                            max={4}
                            step={0.01}
                            value={cmy.getv(1)}
                            onChange={v => setCmy(cmy.copy().setv(1, v))}
                        />
                    </div>
                    <div>
                        Y
                        <Slider
                            min={0}
                            max={4}
                            step={0.01}
                            value={cmy.getv(2)}
                            onChange={v => setCmy(cmy.copy().setv(2, v))}
                        />
                    </div>
                </div>
                <div>
                    <XYZColorBox size={150} xyz={xyzOfCmy} />
                    <div>{xyzOfCmy.show()}</div>
                    <div>{xyzToSrgb(xyzOfCmy).show()}</div>
                    <div>{Hcmy.show(4)}</div>
                </div>
                <div>
                    <XYZColorBox size={150} xyz={xyzOfRefl} />
                    <div>{xyzOfRefl.show()}</div>
                    <div>{xyzToSrgb(xyzOfRefl).show()}</div>
                </div>
                <div>
                    <XYZColorBox size={150} xyz={xyzOfReflD65} />
                    <div>{xyzOfReflD65.show()}</div>
                    <div>{xyzToSrgb(xyzOfReflD65).show()}</div>
                </div>
            </div>
            <div style={{display: 'flex'}}>
                <div style={{width: '150px'}}>
                    <div>
                        corr_R
                        <Slider
                            min={-5}
                            max={5}
                            step={0.01}
                            value={corr.getv(0)}
                            onChange={v => setCorr(corr.copy().setv(0, v))}
                        />
                    </div>
                    <div>
                        corr_G
                        <Slider
                            min={-5}
                            max={5}
                            step={0.01}
                            value={corr.getv(1)}
                            onChange={v => setCorr(corr.copy().setv(1, v))}
                        />
                    </div>
                    <div>
                        corr_B
                        <Slider
                            min={-5}
                            max={5}
                            step={0.01}
                            value={corr.getv(2)}
                            onChange={v => setCorr(corr.copy().setv(2, v))}
                        />
                    </div>
                </div>
                <div>
                    <XYZColorBox size={150} xyz={initXyz} />
                    <XYZColorBox size={150} xyz={devXyz} />
                </div>
            </div>
            <div style={{ display: 'flex' }}>
                <Plot containerStyle={{ width: '800px', height: '500px' }}
                    title="Couplers"
                    xmarks={31}
                    xmarkFormat="fixed:0"
                    plots={[
                        {
                            xs: spectrumXs,
                            ys: lab.couplers.row(0).toFlatArray(),
                            style: 'red',
                        },
                        {
                            xs: spectrumXs,
                            ys: lab.couplers.row(1).toFlatArray(),
                            style: 'green',
                        },
                        {
                            xs: spectrumXs,
                            ys: lab.couplers.row(2).toFlatArray(),
                            style: 'blue',
                        },
                        {
                            xs: spectrumXs,
                            ys: lab.couplers.row(0).add(lab.couplers.row(1).add(lab.couplers.row(2))).toFlatArray(),
                            style: 'black',
                        },
                    ]}
                />
                <XYZColorBox size={200} xyz={xyz} />
            </div>
            <div style={{ display: 'flex' }}>
                <div>
                    <div style={{ display: 'flex', flexDirection: 'column', height: '300px' }}>
                        <div>H</div>
                        <Slider
                            min={-5}
                            max={0}
                            step={0.01}
                            value={logexp}
                            onChange={setLogexp}
                            vertical
                        />
                        <div>
                            <Radio.Group value={devColor} style={{ display: 'flex', flexDirection: 'column' }} onChange={ e => setDevColor(e.target.value) }>
                                <Radio.Button value={0} style={{ color: 'red' }}>R</Radio.Button>
                                <Radio.Button value={1} style={{ color: 'green' }}>G</Radio.Button>
                                <Radio.Button value={2} style={{ color: 'blue' }}>B</Radio.Button>
                            </Radio.Group>
                        </div>
                    </div>
                </div>
                <Plot containerStyle={{ width: '700px', height: '500px' }}
                    title="Exposure densities of dyes measured by corresponded sensor"
                    xmarks={15}
                    xmarkFormat="fixed:2"
                    //yrange={[-4, -1.5]}
                    plots={[
                        {
                            xs: hs.toFlatArray(),
                            ys: hs.map(h => expos(h, devColor, 0)).toFlatArray(),
                            style: couplerStyles[0],
                        },
                        {
                            xs: hs.toFlatArray(),
                            ys: hs.map(h => expos(h, devColor, 1)).toFlatArray(),
                            style: couplerStyles[1],
                        },
                        {
                            xs: hs.toFlatArray(),
                            ys: hs.map(h => expos(h, devColor, 2)).toFlatArray(),
                            style: couplerStyles[2],
                        },
                    ]}
                />
                <div>
                    <div>
                        <div>R:{((expos(h0-1, devColor, 0)-expos(1, devColor, 0))/-h0).toFixed(4)}</div>
                        <div>G:{((expos(h0-1, devColor, 1)-expos(1, devColor, 1))/-h0).toFixed(4)}</div>
                        <div>B:{((expos(h0-1, devColor, 2)-expos(1, devColor, 2))/-h0).toFixed(4)}</div>
                    </div>
                    <div style={{ display: 'flex'}}>
                        <div style={{ height: '150px'}}>
                            <div>cplr R</div>
                            <Slider
                                min={0}
                                max={5}
                                step={0.01}
                                value={couplerQs.getv(0)}
                                onChange={v => setCouplerQs(Matrix.fromArray([[v, couplerQs.getv(1), couplerQs.getv(2)]]))}
                                vertical
                            />
                        </div>
                        <div>
                            <div>cplr G</div>
                            <Slider
                                min={0}
                                max={5}
                                step={0.01}
                                value={couplerQs.getv(1)}
                                onChange={v => setCouplerQs(Matrix.fromArray([[couplerQs.getv(0), v, couplerQs.getv(2)]]))}
                                vertical
                            />
                        </div>
                        <div>
                            <div>cplr B</div>
                            <Slider
                                min={0}
                                max={5}
                                step={0.01}
                                value={couplerQs.getv(2)}
                                onChange={v => setCouplerQs(Matrix.fromArray([[couplerQs.getv(0), couplerQs.getv(1), v]]))}
                                vertical
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
//style={{ alignSelf: 'center' }}>
