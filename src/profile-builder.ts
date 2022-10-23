import {Datasheet, SpectralBasis} from "./data";
import {Matrix} from "./matrix";
import {
    layerTransmittance,
    logExposure,
    normalizedSense,
    normalizeDyes,
    ReflGen,
    transmittance,
    transmittanceToXyzMtx
} from "./spectrum";
import nlopt from 'nlopt-js';
import {fill} from "./generators";
import {add, Chi, div, mul, sub} from "./math";
import {deltaE94Xyz, xyzToSrgb} from "./colors";

export interface ProfileInitialData {
    h0: number;
    paperGammas: Matrix; // 1x3
    filmDatasheet: Datasheet;
    paperDatasheet: Datasheet;
    devLight: Matrix; // 1x31
    projLight: Matrix; // 1x31
    reflLight: Matrix; // 1x31
    spectralBasis: SpectralBasis;
    testCmys: Matrix[];
}

/*
export const defaultTestColors: Matrix[] = [
    [0.5, 0, 0],
    [0, 0.5, 0],
    [0, 0, 0.5],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1.33, 0.59, 0],
    [1.32, 0, 1.09],
    [1.32, 1.29, 0],
    [0.58, 0.84, 0.0],
    [1.54, 0.0, 1.8],

    // reds
    [0, 1.14, 1.09],
    [0.0, 1.82, 1.74],
    [0.0, 1.5, 1.89],

    // grays
    //[[0, 0, 0], [0, 0, 0]],
    [0.1, 0.1, 0.1],
    [0.5, 0.5, 0.5],
    [1, 1, 1],
    [2, 2, 2],
].map(c => Matrix.fromArray([c]));
*/

export const defaultTestColors: Matrix[] = [
    // red
    [0, 2.04, 1.8],
    // green
    [1.32, 0, 1.56],
    // blue
    [2.2, 1.4, 0],
    // grays
    [1, 1, 1],
].map(c => Matrix.fromArray([c]));

/*
 * filmSense <- filmSense + devLight
 * paperSense <- paperSense + projLight
 * filmDyes <- filmDyes + projLight
 * paperDyes <- paperDyes + reflLight
 * reflGen <- basis + devLight
 *
 * filmDatasheet -> filmSense, filmDyes
 * paperDatasheet -> paperSense, paperDyes
 * devLight -> filmSense, reflGen
 * projLight -> paperSense, filmDyes
 * reflLight -> paperDyes
 * spectralBasis -> reflGen
 */

export class ProfileBuilder {
    h0: number;
    paperGammas: Matrix; // 1x3

    filmSense: Matrix; // 3x31
    filmDyes: Matrix; // 3x31

    paperSense: Matrix; // 3x31
    paperDyes: Matrix; // 3x31

    devLight: Matrix; // 1x31
    projLight: Matrix; // 1x31
    reflLight: Matrix; // 1x31

    reflGen: ReflGen;
    testColors: [Matrix, Matrix][];

    normalizeFilmDyesError: number;
    normalizePaperDyesError: number;
    findGammasError: number;
    findDyeQuantitiesError: Matrix = Matrix.fromArray([[0, 0, 0]]); // 1x3

    gammas: Matrix; // 3x3

    // The following is a matrix that converts exposure densities
    // of incoming light measured by film sensors
    // to exposure densities of light transmitted through the developed film
    // measured by paper sensors:
    // D_p = filmGammas * D_f
    // Each element of the matrix is:
    // filmGammas[s, l] = gamma of the l-th layer (0 is red-sensitive layer of the film)
    //                 measured by the s-th sensor (0 is the red-sensitive sensor of the paper)
    filmGammas: Matrix; // 3x3

    couplers: Matrix; // 3x31
    qs: Matrix; // 3x3
    chiFilm: [Chi, Chi, Chi];
    chiPaper: [Chi, Chi, Chi];

    // Transmittance To XYZ Matrix for the correspondent light
    devMtx: Matrix;
    //private projMtx: Matrix;
    reflMtx: Matrix;

    constructor(pid: ProfileInitialData) {
        this.h0 = pid.h0;
        this.paperGammas = pid.paperGammas;
        this.filmSense = normalizedSense(pid.filmDatasheet.sense, pid.devLight);
        this.paperSense = normalizedSense(pid.paperDatasheet.sense, pid.projLight);

        let r = normalizeDyes(pid.filmDatasheet.dyes, pid.projLight, 1.0);
        this.filmDyes = r.dyes;
        this.normalizeFilmDyesError = r.err;

        r = normalizeDyes(pid.paperDatasheet.dyes, pid.reflLight, 1.0);
        this.paperDyes = r.dyes;
        this.normalizePaperDyesError = r.err;

        this.devLight = pid.devLight;
        this.projLight = pid.projLight;
        this.reflLight = pid.reflLight;
        this.reflGen = ReflGen.fromBasisAndLight(pid.spectralBasis, pid.devLight);

        this.devMtx = transmittanceToXyzMtx(this.devLight);
        //this.projMtx = transmittanceToXyzMtx(this.projLight);
        this.reflMtx = transmittanceToXyzMtx(this.reflLight);
        
        this.testColors = pid.testCmys.map(cmy => [
            cmy,
            this.exposureDensitiesFromDyeConcentrations(cmy)
        ]);

        this.gammas = this.findGammas();
        this.filmGammas = this.gammas.rowWise(div, this.paperGammas);
        this.qs = this.findDyeQuantities();
        this.couplers = this.findCouplers();

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
    }

    private findGammas(): Matrix {
        // Mapping from dye quantities to exposure densities
        const cmyrgb = this.testColors;
        const opt = nlopt.Optimize(nlopt.Algorithm.LN_COBYLA, 9);
        opt.setMinObjective((x: number[], _grad: any) => {
            const mtx = Matrix.fromArray([
                [x[0], x[1], x[2]],
                [x[3], x[4], x[5]],
                [x[6], x[7], x[8]],
            ]);
            // const v = Matrix.fromArray([[x[9], x[10], x[11]]]);
            let s = 0;
            for (let i = 0; i < cmyrgb.length; i++) {
                const [cmy, rgb] = cmyrgb[i];
                const d = rgb.mmul(mtx)/*.add(v)*/.sub(cmy);
                s += d.dot(d);
            }
            return s;
        }, 1e-6);
        opt.setLowerBounds([...fill(9, -10)]);
        opt.setUpperBounds([...fill(9,  10)]);
        const res = opt.optimize([...fill(9, 0)]);
        this.findGammasError = res.value;

        const x = res.x;
        const mtx = Matrix.fromArray([
            [x[0], x[1], x[2]],
            [x[3], x[4], x[5]],
            [x[6], x[7], x[8]],
        ]);
        //const v = Matrix.fromArray([[x[9], x[10], x[11]]]);
        /*
        for (let i = 0; i < cmyrgb.length; i++) {
            const [cmy, rgb] = cmyrgb[i];
            //console.log(cmy.show(), rgb.show(), '-->', rgb.mmul(mtx)/*.add(v)* /.show());
            this.inColors.push(this.dyesToXyz(this.paperDyes, cmy));
            this.outColors.push(this.dyesToXyz(this.paperDyes, rgb.mmul(mtx)/*.add(v)* /));
        }
        */
        return mtx.transpose();
        //mtx.transpose().map(neg).rowWise(div, this.paperGammas);
    }

    filmTransExpoDensityPaper(h: number, layer: number, sensor: number, chiFilmDyeLayer: Chi, qs: Matrix, corr = Matrix.fromArray([[0, 0, 0]])): number {
        let sp = this.filmDyes.row(layer).mul(chiFilmDyeLayer.at(h));
        for (let lr = 0; lr < 3; lr++) {
            if (lr === layer) {
                continue;
            }
            sp = sp.add(
                this.filmDyes.row(lr).mul(
                    qs.getv(lr) * (1 - chiFilmDyeLayer.at(h) / chiFilmDyeLayer.ymax)
                )
            );
        }
        return logExposure(
            this.paperSense,//.rowWise(add, corr),
            layerTransmittance(sp, 1.0).elementWise(mul, this.projLight)
        ).getv(sensor);
    }

    expos(h: number, layer: number, sensor: number, corr = Matrix.fromArray([[0, 0, 0]])): number {
        return this.filmTransExpoDensityPaper(
            h, layer, sensor, this.chiFilm[layer], this.qs.row(layer), corr
        );
    }

    private findCouplers(): Matrix {
        return Matrix.fromArray([
            this.filmDyes
                .row(1)
                .mul(this.qs.get(0, 1))
                .add(this.filmDyes.row(2).mul(this.qs.get(0, 2)))
                .toFlatArray(),
            this.filmDyes
                .row(0)
                .mul(this.qs.get(1, 0))
                .add(this.filmDyes.row(2).mul(this.qs.get(1, 2)))
                .toFlatArray(),
            this.filmDyes
                .row(0)
                .mul(this.qs.get(2, 0))
                .add(this.filmDyes.row(1).mul(this.qs.get(2, 1)))
                .toFlatArray(),
        ]);
    }

    private findDyeQuantities(): Matrix {
        const qs = [];
        for (let layer = 0; layer < 3; layer++) {
            const q = this.findDyeQuantitiesForLayer(layer);
            qs.push(q);
        }
        return Matrix.fromArray(qs);
    }

    private findDyeQuantitiesForLayer(layer: number): [number, number, number] {
        const h0 = this.h0;
        const opt = nlopt.Optimize(nlopt.Algorithm.LN_COBYLA, 3);
        opt.setMinObjective((x: number[], _grad: any) => {
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
        opt.setUpperBounds([...fill(3, 10)]);
        const res = opt.optimize([...fill(3, 0.1)]);
        this.findDyeQuantitiesError.setv(layer, res.value);
        return res.x;
    }

    dyesToXyz(dyes: Matrix, qs: Matrix, lightMtx: Matrix): Matrix {
        const trans = transmittance(dyes, qs);
        return lightMtx.mmul(trans.transpose()).transpose();
    }

    private exposureDensitiesFromDyeConcentrations(cmy: Matrix): Matrix {
        const xyzOfCmy = this.dyesToXyz(this.paperDyes, cmy, this.reflMtx);
        const spectrum = this.reflGen.spectrumOf(xyzOfCmy);
        return logExposure(this.filmSense, spectrum).transpose();
        /*
        const xyzOfCmy = this.dyesToXyz(this.paperDyes, cmy, this.devMtx);
        const spectrum = this.reflGen.spectrumOf(xyzOfCmy);
        return logExposure(this.filmSense, spectrum).transpose();
        */
    }

    findCorrs(): Matrix {
        const opt = nlopt.Optimize(nlopt.Algorithm.GN_ISRES, 3);
        const colors = this.testColors.map(([cmy, rgb]) => this.dyesToXyz(this.paperDyes, cmy, this.devMtx));
        //console.log('Test colors:', colors.map(c => xyzToSrgb(c)).map(c => c.toFlatArray()));
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
            console.log('****S:', s, corrs.show(5));
            return s;
        }, 1e-10);
        opt.setLowerBounds([...fill(3, -5)]);
        opt.setUpperBounds([...fill(3, 5)]);
        const res = opt.optimize([...fill(3, 0.0)]);
        console.log(`Corrs:`, res);
        return Matrix.fromArray([res.x]);
    }

    profile() {
        return {
            h0: this.h0,
            couplers: this.couplers.toArray(),
            dev_light: this.devLight.toFlatArray(),
            film_dyes: this.filmDyes.toArray(),
            film_max_qs: [this.qs.get(0, 0), this.qs.get(1, 1), this.qs.get(2, 2)],
            film_sense: this.filmSense.toArray(),
            mtx_refl: this.reflMtx.toArray(),
            neg_gammas: [0, 0, 0], // no use
            paper_dyes: this.paperDyes.toArray(),
            paper_gammas: this.paperGammas.toFlatArray(),
            paper_sense: this.paperSense.toArray(),
            proj_light: this.projLight.toFlatArray(),
        }
    }

    developWithGammas(xyz: Matrix): Matrix {
        const sp = this.reflGen.spectrumOf(xyz);
        const hDev = logExposure(this.filmSense, sp);
        const hProj = this.filmGammas.mmul(hDev).transpose();
        const cmy = hProj.colWise(mul, this.paperGammas);
        return this.dyesToXyz(this.paperDyes, cmy, this.reflMtx);
    }

    develop(xyz: Matrix, corr: Matrix): Matrix {
        const sp = this.reflGen.spectrumOf(xyz);
        //this.debugSpectrum = sp;

        // only for debugging purposes
        const refl = this.reflGen.reflOfUnclipped(xyz);
        //this.debugRefl = refl;

        const H = logExposure(this.filmSense, sp);
        const negative = this.developFilm(H);
        const positive = this.developPaper(negative, corr);
        //this.debugPaperDyes = positive;
        return this.dyesToXyz(positive, Matrix.fill([1, 3], 1), this.reflMtx);
    }
    
    private developFilm(H: Matrix): Matrix {
        const [developedDyes, developedCouplers] = this.developFilmSep(H);
        return developedDyes.add(developedCouplers);
    }

    private developFilmSep(H: Matrix): [Matrix, Matrix] {
        const dev = Matrix.fromArray([[
            this.chiFilm[0].get(H.getv(0)),
            this.chiFilm[1].get(H.getv(1)),
            this.chiFilm[2].get(H.getv(2)),
        ]]);
        const developedDyes = this.filmDyes.rowWise((e1, e2) => e1 * e2, dev);
        //this.debugFilmDyes = developedDyes;
        const cDev = Matrix.fromArray([[
            1 - dev.getv(0) / this.qs.get(0, 0),
            1 - dev.getv(1) / this.qs.get(1, 1),
            1 - dev.getv(2) / this.qs.get(2, 2),
        ]]);
        const developedCouplers = this.couplers.rowWise((e1, e2) => e1 * e2, cDev);
        //this.debugFilmCouplers = developedCouplers;
        return [developedDyes, developedCouplers];
    }

    private developPaper(negative: Matrix, corr: Matrix): Matrix {
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

    correction(): Matrix {
        return Matrix.fromArray([[
            this.expos(0, 0, 0) + this.expos(0, 1, 0) + this.expos(0, 2, 0),
            this.expos(0, 0, 1) + this.expos(0, 1, 1) + this.expos(0, 2, 1),
            this.expos(0, 0, 2) + this.expos(0, 1, 2) + this.expos(0, 2, 2),
        ]]);
    }
}

