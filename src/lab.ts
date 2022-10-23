import nlopt from 'nlopt-js';
import { loadDatasheet, loadSpectrumData, Datasheet } from './data';
import { srgbToXyz, xyzToSrgb, deltaE94Xyz } from './colors';
import { fill } from './generators';
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
import { Matrix } from './matrix';
import { mul, div, sub, Chi } from './math';

let labsMap: { [key: string]: Lab } = {};

export class Lab {
    static instance(key: string): Lab {
        if (!labsMap[key]) {
            labsMap[key] = new Lab();
        }
        return labsMap[key];
    }

    h0: number;
    inColors: Matrix[];
    outColors: Matrix[];
    paperGammas: Matrix;
    private filmDs: Datasheet;
    private paperDs: Datasheet;
    reflGen: ReflGen;
    private devLight: Matrix;
    projLight: Matrix;
    private reflLight: Matrix;
    private mtxRefl: Matrix;
    private mtxD55: Matrix;
    filmSense: Matrix;
    paperSense: Matrix;
    private filmDyes: Matrix;
    paperDyes: Matrix;
    private gammas: Matrix;
    filmGammas: Matrix;
    qs: Matrix;
    //private filmDyesQ: Matrix;
    couplers: Matrix;
    chiFilm: [Chi, Chi, Chi];
    private chiPaper: [Chi, Chi, Chi];

    // debug
    debugSpectrum: Matrix = Matrix.empty([0, 0]);
    debugRefl: Matrix = Matrix.empty([0, 0]);
    debugFilmDyes: Matrix = Matrix.empty([0, 0]);
    debugFilmCouplers: Matrix = Matrix.empty([0, 0]);
    debugPaperDyes: Matrix = Matrix.empty([0, 0]);

    constructor() {
        const t0 = Date.now();
        this.h0 = -2; // -2 for minimal curvature of gamma curves
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
        this.reflGen = ReflGen.fromSpectrumData(spectrumData);

        this.devLight = daylightSpectrum(5500);
        this.projLight = daylightSpectrum(5500);
        this.reflLight = daylightSpectrum(6500);

        this.mtxRefl = transmittanceToXyzMtx(this.reflLight);
        this.mtxD55 = transmittanceToXyzMtx(daylightSpectrum(5500));

        this.filmSense = normalizedSense(this.filmDs.sense, this.devLight);
        this.paperSense = normalizedSense(this.paperDs.sense, this.projLight);

        this.filmDyes = normalizedDyes(this.filmDs.dyes, this.projLight, 1.0);
        this.paperDyes = normalizedDyes(this.paperDs.dyes, this.reflLight, 1.0);

        this.gammas = this.findGammas();
        this.filmGammas = this.gammas/*.map(neg)*/.rowWise(div, this.paperGammas);

        const qs = [];
        for (let layer = 0; layer < 3; layer++) {
            qs.push(this.findDyeQuantities(layer, this.h0));
        }
        this.qs = Matrix.fromArray(qs);
        this.couplers = Matrix.fromArray([
            this.filmDyes.row(1).mul(this.qs.get(0, 1)).add(this.filmDyes.row(2).mul(this.qs.get(0, 2))).toFlatArray(),
            this.filmDyes.row(0).mul(this.qs.get(1, 0)).add(this.filmDyes.row(2).mul(this.qs.get(1, 2))).toFlatArray(),
            this.filmDyes.row(0).mul(this.qs.get(2, 0)).add(this.filmDyes.row(1).mul(this.qs.get(2, 1))).toFlatArray(),
        ]);
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

        console.log('Init Lab time:', Date.now() - t0);
        //this.findCorrs();
    }

    develop(xyz: Matrix, corr: Matrix): Matrix {
        const sp = this.reflGen.spectrumOf(xyz);
        this.debugSpectrum = sp;

        // only for debugging purposes
        const refl = this.reflGen.reflOfUnclipped(xyz);
        this.debugRefl = refl;

        const H = logExposure(this.filmSense, sp);
        const negative = this.developFilm(H);
        const positive = this.developPaper(negative, corr);
        this.debugPaperDyes = positive;
        return this.dyesToXyz(positive, Matrix.fill([1, 3], 1));
    }

    developFilm(H: Matrix): Matrix {
        const [developedDyes, developedCouplers] = this.developFilmSep(H);
        return developedDyes.add(developedCouplers);
    }

    developFilmSep(H: Matrix): [Matrix, Matrix] {
        const dev = Matrix.fromArray([[
            this.chiFilm[0].get(H.getv(0)),
            this.chiFilm[1].get(H.getv(1)),
            this.chiFilm[2].get(H.getv(2)),
        ]]);
        const developedDyes = this.filmDyes.rowWise((e1, e2) => e1 * e2, dev);
        this.debugFilmDyes = developedDyes;
        const cDev = Matrix.fromArray([[
            1 - dev.getv(0) / this.qs.get(0, 0),
            1 - dev.getv(1) / this.qs.get(1, 1),
            1 - dev.getv(2) / this.qs.get(2, 2),
        ]]);
        const developedCouplers = this.couplers.rowWise((e1, e2) => e1 * e2, cDev);
        this.debugFilmCouplers = developedCouplers;
        return [developedDyes, developedCouplers];
    }
    
    developPaper(negative: Matrix, corr: Matrix): Matrix {
        const trans = transmittance(negative, Matrix.fill([1, 3], 1));
        //console.log('neg trans:', trans.show());
        const sp = trans.elementWise((e1, e2) => e1 * e2, this.projLight);
        //console.log('neg sp:', sp.show());

        // log10(10^paper_sense % sp)
        const H1 = logExposure(this.paperSense.rowWise(sub, corr), sp);
        //console.log('paper exposure:', H1.show());
        const dev = Matrix.fromArray([[
            this.chiPaper[0].get(H1.getv(0)),
            this.chiPaper[1].get(H1.getv(1)),
            this.chiPaper[2].get(H1.getv(2)),
        ]]);
        //console.log('paper dev:', dev.show(4));
        return this.paperDyes.rowWise((e1, e2) => e1 * e2, dev);
    }

    dyesToXyz(dyes: Matrix, qs: Matrix): Matrix {
        const trans = transmittance(dyes, qs);
        return this.mtxRefl.mmul(trans.transpose()).transpose();
    }

    dyesToXyzD55(dyes: Matrix, qs: Matrix): Matrix {
        const trans = transmittance(dyes, qs);
        return this.mtxD55.mmul(trans.transpose()).transpose();
    }

    testColors(): [[number, number, number], [number, number, number]][] {
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
            //[[0, 0, 0], [0, 0, 0]],
            [[0.1, 0.1, 0.1], [-0.0258, -0.1186, -0.1126]],
            [[0.5, 0.5, 0.5], [-0.4209, -0.5208, -0.5124]],
            [[1, 1, 1], [-0.9169, -1.0187, -1.0099]],
            [[2, 2, 2], [-1.8939, -1.9989, -1.9965]],
        ];
    }

    findGammas(): Matrix {
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
        console.log('findGammas optimize result:', res);
        const x = res.x;
        const mtx = Matrix.fromArray([
            [x[0], x[1], x[2]],
            [x[3], x[4], x[5]],
            [x[6], x[7], x[8]],
        ]);
        //const v = Matrix.fromArray([[x[9], x[10], x[11]]]);
        //console.log(mtx.show(4));
        for (let i = 0; i < cmyrgb.length; i++) {
            const [cmy, rgb] = cmyrgb[i];
            //console.log(cmy.show(), rgb.show(), '-->', rgb.mmul(mtx)/*.add(v)*/.show());
            this.inColors.push(this.dyesToXyz(this.paperDyes, cmy));
            this.outColors.push(this.dyesToXyz(this.paperDyes, rgb.mmul(mtx)/*.add(v)*/));
        }
        return mtx.transpose();
        //mtx.transpose().map(neg).rowWise(div, this.paperGammas);
    }

    filmTransExpoDensityPaper(h: number, layer: number, sensor: number, chiFilmDyeLayer: Chi, qs: Matrix): number {
        let sp = this.filmDyes.row(layer).mul(chiFilmDyeLayer.at(h));
        for (let lr = 0; lr < 3; lr++) {
            if (lr === layer) {
                continue;
            }
            sp = sp.add(this.filmDyes.row(lr).mul(qs.getv(lr) * (1 - chiFilmDyeLayer.at(h)/chiFilmDyeLayer.ymax)));
        }
        return logExposure(this.paperSense, layerTransmittance(sp, 1.0).elementWise(mul, this.projLight)).getv(sensor);
    }

    findDyeQuantities(layer: number, h0: number): [number, number, number] {
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

    findCorrs(): [number, number, number] {
        const opt = nlopt.Optimize(nlopt.Algorithm.GN_ISRES, 3);
        const colors = this.testColors().map(([cmy, rgb]) => this.dyesToXyz(this.paperDyes, Matrix.fromArray([cmy])));
        console.log('Test colors:', colors.map(c => xyzToSrgb(c)).map(c => c.toFlatArray()));
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
            console.log('****S:', s, corrs.show());
            return s;
        }, 1e-10);
        opt.setLowerBounds([...fill(3, -5)]);
        opt.setUpperBounds([...fill(3, 5)]);
        const res = opt.optimize([...fill(3, 0.0)]);
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


