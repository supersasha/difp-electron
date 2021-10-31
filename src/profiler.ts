import * as nlopt from 'nlopt-js';

import { Matrix } from './matrix';
import {
    daylightSpectrum,
    exposure,
    normalizedDyes,
    normalizedSense,
    transmittance,
    transmittanceToXyzMtx,
    ReflGen,
} from './spectrum';
import { log10, bell, Chi } from './math';
import { loadDatasheet, loadSpectrumData, Datasheet, SpectrumData } from './data';
import { deltaE94Xyz } from './colors';

function referenceColors(): [Matrix, number][] {
    const colors = [
        [12.08, 19.77, 16.28, 1],
        [20.86, 12.00, 17.97, 1],
        [14.27, 19.77, 26.42, 1],
        [ 7.53,  6.55, 34.26, 1],
        [64.34, 59.10, 59.87, 1],
        [58.51, 59.10, 29.81, 1],
        [37.93, 30.05,  4.98, 1],
        [95.67970526, 100.0, 92.1480586, 1],
        [95.67970526 / 4, 100.0 / 4, 92.1480586 / 4, 1],
        [95.67970526 / 16, 100.0 / 16, 92.1480586 / 16, 1],
        [95.67970526 / 64, 100.0 / 64, 92.1480586 / 64, 1],

        [24.3763, 12.752, 3.093, 1],
        [16.6155, 8.47486, 3.12047, 1],
    ];

    return colors.map(([x, y, z, w]) => [Matrix.fromArray([[x, y, z]]), w]);
}

const N_FREE_PARAMS = 0;
const GAUSSIAN_LAYERS = [0, 0, 1, 1, 1, 1, 2, 2];
const N_GAUSSIANS = GAUSSIAN_LAYERS.length;
const N_GAUSSIAN_PARAMS = 3 * N_GAUSSIANS;
const N_PARAMS = N_FREE_PARAMS + N_GAUSSIAN_PARAMS;

export class Developer {
    private devLight: Matrix;
    private projLight: Matrix;
    private reflLight: Matrix;
    private kfmax: number;
    private kpmax: number;
    private filmds: Datasheet;
    private paperds: Datasheet;
    private reflGen: ReflGen;
    private mtxRefl: Matrix;
    private mtxReflD55: Matrix;
    private filmSense: Matrix;
    private filmDyes: Matrix;
    private paperDyes0: Matrix;
    private paperDyes: Matrix;
    private paperSense: Matrix;
    private chiFilm: [Chi, Chi, Chi];
    private chiPaper: [Chi, Chi, Chi];
    private couplers: Matrix;

    constructor() {
        this.devLight = daylightSpectrum(5500);
        this.projLight = daylightSpectrum(5500);
        this.reflLight = daylightSpectrum(6500);

        this.kfmax = 2.5;
        this.kpmax = 4.0;

        const film_ds_file =
            //"profiles/datasheets/kodak-vision3-250d-5207-2.datasheet";
            "./data/kodak-vision3-50d-5203-2.datasheet";
        const paper_ds_file =
            "./data/kodak-vision-color-print-2383-2.datasheet";
        const spectrum_file =
            "./data/spectrum-d55-4.json";

        this.filmds = loadDatasheet(film_ds_file);
        this.paperds = loadDatasheet(paper_ds_file);
        const spectrum = loadSpectrumData(spectrum_file);
        this.reflGen = new ReflGen(spectrum);
        this.mtxRefl = transmittanceToXyzMtx(this.reflLight);
        this.mtxReflD55 = transmittanceToXyzMtx(this.devLight);

        this.filmSense = normalizedSense(this.filmds.sense, this.devLight);
        this.filmDyes = normalizedDyes(this.filmds.dyes, this.projLight, 1.0);

        this.paperDyes0 = normalizedDyes(this.paperds.dyes, this.reflLight, 1.0);
        this.paperSense = normalizedSense(this.paperds.sense, this.projLight);

        const cf = Chi.to(0, this.kfmax, 0.5, 0);
        //console.log(`Chi film at 0: ${cf.get(0)}, kfmax: ${this.kfmax}`);
        this.chiFilm = [cf, cf, cf];
    }

    setup() {
        const hprojMax = this.beta(-10.0);
        const hprojMin = this.beta(1.0);
        
        const paperGammas = (hprojMax.sub(hprojMin)).map(e => this.kpmax / e);
        this.chiPaper = [
            Chi.to(0, this.kpmax, paperGammas.getv(0), hprojMax.getv(0)),
            Chi.to(0, this.kpmax, paperGammas.getv(1), hprojMax.getv(1)),
            Chi.to(0, this.kpmax, paperGammas.getv(2), hprojMax.getv(2)),
        ];

        this.paperDyes = this.paperDyes0.mul(4 / this.delta(-4));
    }

    /*
    generatedColor(xyz) {
        const refl = this.reflGen.reflOf(xyz);
        return this.mtxRefl.mmul(refl);
    }
    */

    dyesToXyz(dyes: Matrix, qs: Matrix): Matrix {
        const trans = transmittance(dyes, qs);
        return this.mtxRefl.mmul(trans.transpose()).transpose();
    }
    
    dyesToXyzD55(dyes: Matrix, qs: Matrix): Matrix {
        const trans = transmittance(dyes, qs);
        return this.mtxReflD55.mmul(trans.transpose()).transpose();
    }

    develop(xyz: Matrix): Matrix {
        const sp = this.reflGen.spectrumOf(xyz);
        const H = exposure(this.filmSense, sp).map(log10);
        const negative = this.developFilm(H);
        const positive = this.developPaper(negative);
        return this.dyesToXyz(positive, Matrix.fill([1, 3], 1));
    }

    developFilmSep(H: Matrix): [Matrix, Matrix] {
        const dev = Matrix.fromArray([[
            this.chiFilm[0].get(H.getv(0)),
            this.chiFilm[1].get(H.getv(1)),
            this.chiFilm[2].get(H.getv(2)),
        ]]);
        const developedDyes = this.filmDyes.rowWise((e1, e2) => e1 * e2, dev);
        const cDev = Matrix.fromArray([[
            1 - dev.getv(0) / this.kfmax,
            1 - dev.getv(1) / this.kfmax,
            1 - dev.getv(2) / this.kfmax,
        ]]);
        const developedCouplers = this.couplers.rowWise((e1, e2) => e1 * e2, cDev);
        return [developedDyes, developedCouplers];
    }

    developFilm(H: Matrix): Matrix {
        const [developedDyes, developedCouplers] = this.developFilmSep(H);
        return developedDyes.add(developedCouplers);
    }

    developPaper(negative: Matrix): Matrix {
        const trans = transmittance(negative, Matrix.fill([1, 3], 1));
        const sp = trans.elementWise((e1, e2) => e1 * e2, this.projLight);

        // log10(10^paper_sense % sp)
        const H1 = exposure(this.paperSense, sp).map(log10);
        const dev = Matrix.fromArray([[
            this.chiPaper[0].get(H1.getv(0)),
            this.chiPaper[1].get(H1.getv(1)),
            this.chiPaper[2].get(H1.getv(2)),
        ]]);
        return this.paperDyes.rowWise((e1, e2) => e1 * e2, dev);
    }

    beta(D: number): Matrix {
        const alpha = D;
        const kfs = Matrix.fromArray([[
            this.chiFilm[0].get(alpha),
            this.chiFilm[1].get(alpha),
            this.chiFilm[2].get(alpha),
        ]]);
        const cKfs = kfs.map(e => 1 - e / this.kfmax);
        
        const trans = kfs.mmul(this.filmDyes)
                         .add(cKfs.mmul(this.couplers))
                         .map(e => Math.pow(10, -e));
        const res = this.paperSense.map(e => Math.pow(10, e))
                              .mmul(this.projLight.elementWise((e1, e2) => e1*e2, trans).transpose())
                              .map(log10);
        return res;
    }
    
    delta(D: number): number {
        const betas = this.beta(D);
        const kps = Matrix.fromArray([[
            this.chiPaper[0].get(betas.getv(0)),
            this.chiPaper[1].get(betas.getv(1)),
            this.chiPaper[2].get(betas.getv(2)),
        ]]);
        const refl = kps.map(e => -e).mmul(this.paperDyes0).map(e => Math.pow(10, e));
        return log10(this.reflLight.sum() / this.reflLight.dot(refl));
    }

    makeCouplers(qs: Matrix): void {
        const B = N_FREE_PARAMS; // Number of params not accounting gaussians
        const G = N_GAUSSIANS; // Number of gaussians (3 params each) in each (of 3) layer
        this.couplers = Matrix.fill([3, 31], 0);
        for (let i = 0; i < G; i++) {
            const b = B + i * 3;
            let x = 400;
            for (let j = 0; j < 31; j++, x += 10) {
                const v = this.couplers.get(GAUSSIAN_LAYERS[i], j);
                this.couplers.set(GAUSSIAN_LAYERS[i], j,
                    v + bell(qs.getv(b), qs.getv(b+1), qs.getv(b+2), x));
            }
        }
    }

    // Alternative to makeCouplers()
    // couplers - matrix 3x31
    makeCouplersFromMatrix(couplers: Matrix): void {
        this.couplers = couplers;
    }
}

class Solver {
    xyzs: [Matrix, number][];
    dev: Developer;
    solution: Matrix;

    constructor() {
        this.xyzs = referenceColors();
        this.dev = new Developer();
    }

    solveFun(qs: Matrix, print = false): number {
        this.dev.makeCouplers(qs);
        this.dev.setup();
        let d = 0;
        for (let [xyz, w] of this.xyzs) {
            const xyz1 = this.dev.develop(xyz);
            const d0 = deltaE94Xyz(xyz, xyz1);
            const d1 = d0 * w;
            d += d1 * d1;
            if (print) {
                console.log(`${xyz.toArray()} --> ${xyz1.toArray()}: ${d0}, ${d1}`);
            }
        }
        return d;
    }

    solve(): void {
        const opt = nlopt.Optimize(nlopt.Algorithm.GN_ISRES, N_PARAMS);
        //nlopt_set_population(opt, 5000);
        const solver = this;
        let r = 1e100;
        let i = 0;
        opt.setMinObjective((x, grad) => {
            const qs = Matrix.fromTypedArray(x, [1, N_PARAMS]);
            
            const r1 = solver.solveFun(qs);
            i++;
            if (r1 < r) {
                r = r1;
                console.log(`${i}: ${r1}; params: ${qs.toArray()}`);
                solver.solution = qs;
            }

            return r1;
        }, 1e-3);
        const lb = [
            0, 350, 20,
            0, 350, 10,
            0, 350, 20,
            0, 350, 10,
            0, 600, 20,
            0, 600, 10,
            0, 500, 20,
            0, 500, 10,
        ];
        const ub = [
            2.0, 600, 150,
            1.0, 600, 50,
            2.0, 500, 150,
            1.0, 500, 50,
            2.0, 750, 150,
            1.0, 750, 50,
            2.0, 750, 150,
            1.0, 750, 50,
        ];
        const opt_x = [
            0.5, 500, 30,
            0.5, 500, 30,
            0.5, 450, 30,
            0.5, 450, 30,
            0.5, 650, 30,
            0.5, 650, 30,
            0.5, 550, 30,
            0.5, 550, 30,
        ];
        opt.setLowerBounds(lb);
        opt.setUpperBounds(ub);
        //nlopt_set_maxtime(opt, 60 * 1);

        const res = opt.optimize(opt_x);
        console.log(`res:`, res);
    }
}

export async function profile(): Promise<void> {
    await nlopt.ready;
    const solver = new Solver();
    solver.solve();
    solver.solveFun(solver.solution, true);
}

/*
export async function test() {
    await nlopt.ready;
    console.log(A_1931_64_400_700_10nm.show());
    const ds = JSON.parse(fs.readFileSync('./data/kodak-vision3-50d-5203-2.datasheet'));
    const dyes = Matrix.fromArray([ds.red.dye.data, ds.green.dye.data, ds.blue.dye.data]);
    const light = Matrix.fill([1, 31], 1);
    const qs = Matrix.fill([1, 3], 1);
    const density = dyeDensity(dyes, light, qs);
    console.log(density);

    console.log(normalizedDyes(dyes, light, 1));

    const sd = JSON.parse(fs.readFileSync('./data/spectrum-d55-4.json'));
    const reflGen = new ReflGen(sd);
    console.log(reflGen.spectrumOf(Matrix.fromArray([[0.5, 0.5, 0.5]])));
}
*/
