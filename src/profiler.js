import fs from 'fs';
import { Matrix } from './matrix';
import nlopt from 'nlopt-js';

const A_1931_64_400_700_10nm = Matrix.fromArray([
    [ 0.0191097, 0.0020044, 0.0860109 ],
    [ 0.084736, 0.008756, 0.389366 ],
    [ 0.204492, 0.021391, 0.972542 ],
    [ 0.314679, 0.038676, 1.55348 ],
    [ 0.383734, 0.062077, 1.96728 ],
    [ 0.370702, 0.089456, 1.9948 ],
    [ 0.302273, 0.128201, 1.74537 ],
    [ 0.195618, 0.18519, 1.31756 ],
    [ 0.080507, 0.253589, 0.772125 ],
    [ 0.016172, 0.339133, 0.415254 ],
    [ 0.003816, 0.460777, 0.218502 ],
    [ 0.037465, 0.606741, 0.112044 ],
    [ 0.117749, 0.761757, 0.060709 ],
    [ 0.236491, 0.875211, 0.030451 ],
    [ 0.376772, 0.961988, 0.013676 ],
    [ 0.529826, 0.991761, 0.003988 ],
    [ 0.705224, 0.99734, 0 ],
    [ 0.878655, 0.955552, 0 ],
    [ 1.01416, 0.868934, 0 ],
    [ 1.11852, 0.777405, 0 ],
    [ 1.12399, 0.658341, 0 ],
    [ 1.03048, 0.527963, 0 ],
    [ 0.856297, 0.398057, 0 ],
    [ 0.647467, 0.283493, 0 ],
    [ 0.431567, 0.179828, 0 ],
    [ 0.268329, 0.107633, 0 ],
    [ 0.152568, 0.060281, 0 ],
    [ 0.0812606, 0.0318004, 0 ],
    [ 0.0408508, 0.0159051, 0 ],
    [ 0.0199413, 0.0077488, 0 ],
    [ 0.00957688, 0.00371774, 0 ],
]).transpose();

const D_S0 = Matrix.fromArray([[
     94.80, 104.80, 105.90,  96.80, 113.90, 125.60, 125.50, 121.30, 121.30, 113.50,
    113.10, 110.80, 106.50, 108.80, 105.30, 104.40, 100.00,  96.00,  95.10,  89.10,
     90.50,  90.30,  88.40,  84.00,  85.10,  81.90,  82.60,  84.90,  81.30,  71.90,
     74.30
]]);

const D_S1 = Matrix.fromArray([[
     43.40, 46.30, 43.90, 37.10,  36.70,  35.90,  32.60,  27.90,  24.30,  20.10,
     16.20, 13.20,  8.60,  6.10,   4.20,   1.90,   0.00,  -1.60,  -3.50,  -3.50,
     -5.80, -7.20, -8.60, -9.50, -10.90, -10.70, -12.00, -14.00, -13.60, -12.00,
    -13.30
]]);

const D_S2 = Matrix.fromArray([[
    -1.10, -0.50, -0.70, -1.20, -2.60, -2.90, -2.80, -2.60, -2.60, -1.80,
    -1.50, -1.30, -1.20, -1.00, -0.50, -0.30,  0.00,  0.20,  0.50,  2.10,
     3.20,  4.10,  4.70,  5.10,  6.70,  7.30,  8.60,  9.80, 10.20,  8.30,
     9.60
]]);

function daylightSpectrum(temp) {
    let x = 0;
    const s = 1000 / temp;

    if (temp <= 7000) {
        x = (((-4.607 * s) + 2.9678) * s + 0.09911) * s + 0.244063;
    } else {
        x = (((-2.0064 * s) + 1.9018) * s + 0.24748) * s + 0.237040;
    }
    const y = (-3.0 * x + 2.870) * x - 0.275;
    const m = 0.0241 + 0.2562 * x - 0.7341 * y;
    const m1 = (-1.3515 - 1.7703 * x + 5.9114 * y) / m;
    const m2 = (0.030 - 31.4424 * x + 30.0717 * y) / m;
    return D_S0.add(D_S1.mul(m1)).add(D_S2.mul(m2));
}

export function xyzToSrgb(c) {
    const x = c.getv(0) / 100.0;
    const y = c.getv(1) / 100.0;
    const z = c.getv(2) / 100.0;
    
    // D65
    let r = x *  3.2406 + y * -1.5372 + z * -0.4986;
    let g = x * -0.9689 + y *  1.8758 + z *  0.0415;
    let b = x *  0.0557 + y * -0.2040 + z *  1.0570;
    
    // D55
    /*
    float r = x * 2.93537622  + y * -1.39242205 + z * -0.45159634;
    float g = x * -0.98211899 + y * 1.90088771  + z *  0.04210707;
    float b = x * 0.06757551  + y * -0.24777685 + z *  1.2839346; 
    */

    if(r > 0.0031308) {
        r = 1.055 * Math.pow(r, 1.0 / 2.4) - 0.055;
    } else {
        r = 12.92 * r;
    }

    if(g > 0.0031308) {
        g = 1.055 * Math.pow(g, 1.0 / 2.4) - 0.055;
    } else {
        g = 12.92 * g;
    }

    if(b > 0.0031308) {
        b = 1.055 * Math.pow(b, 1.0 / 2.4) - 0.055;
    } else {
        b = 12.92 * b;
    }
    
    if(r < 0.0) {
        r = 0.0;
    } else if(r > 1.0) {
        r = 1.0;
    }

    if(g < 0.0) {
        g = 0.0;
    } else if(g > 1.0) {
        g = 1.0;
    }

    if(b < 0.0) {
        b = 0.0;
    } else if(b > 1.0) {
        b = 1.0;
    }
    return Matrix.fromArray([[r, g, b]]);
}

export function srgbToXyz(c) {
    let r = c.getv(0);
    let g = c.getv(1);
    let b = c.getv(2);

    if(r > 0.04045) {
        r = Math.pow((r + 0.055) / 1.055, 2.4);
    } else {
        r /= 12.92;
    }

    if(g > 0.04045) {
        g = Math.pow((g + 0.055) / 1.055, 2.4);
    } else {
        g /= 12.92;
    }

    if(b > 0.04045) {
        b = Math.pow((b + 0.055) / 1.055, 2.4);
    } else {
        b /= 12.92;
    }

    r *= 100.0;
    g *= 100.0;
    b *= 100.0;

    const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
    const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const z = r * 0.0193 + g * 0.1192 + b * 0.9505;

    return Matrix.fromArray([[x, y, z]]);
}

const ref_x = 95.047;
const ref_y = 100.0;
const ref_z = 108.883;

function xyzToLab(c) {
    let x = c.getv(0) / ref_x;
    let y = c.getv(1) / ref_y;
    let z = c.getv(2) / ref_z;

    if(x > 0.008856) {
        x = Math.cbrt(x);
    } else {
        x = 7.787 * x + 16.0/116.0;
    }

    if(y > 0.008856) {
        y = Math.cbrt(y);
    } else {
        y = 7.787 * y + 16.0/116.0;
    }

    if(z > 0.008856) {
        z = Math.cbrt(z);
    } else {
        z = 7.787 * z + 16.0/116.0;
    }

    return Matrix.fromArray([[116.0 * y - 16.0, 500.0 * (x - y), 200.0 * (y - z)]]);
}

function labToLch(c) {
    return Matrix.fromArray([[
        c.getv(0),
        Math.hypot(c.getv(1), c.getv(2)),
        Math.atan2(c.getv(2), c.getv(1)),
    ]]);
}

function xyzToLch(c) {
    return labToLch(xyzToLab(c));
}

function deltaE94Xyz(xyz1, xyz2) {
    const lch1 = xyzToLch(xyz1);
    const lch2 = xyzToLch(xyz2);
    const KL = 1;
    const K1 = 0.045;
    const K2 = 0.015;
    const d1 = (lch2.getv(0) - lch1.getv(0)) / KL;
    const d2 = (lch2.getv(1) - lch1.getv(1)) / (1 + K1*lch1.getv(1));
    const d3 = (lch2.getv(2) - lch1.getv(2)) / (1 + K2*lch1.getv(1)); // <- K2*lch1[1] !
    return Math.sqrt(d1*d1 + d2*d2 + d3*d3);
}

function log10(v) {
    return Math.log(v) / Math.LN10;
}

function sigma(x, ymin, ymax, gamma, bias, smoo) {
    const a = (ymax - ymin) / 2;
    const y = gamma * (x - bias) / a;
    return a * (y / Math.pow(1 + Math.pow(Math.abs(y), 1/smoo), smoo) + 1) + ymin;
}

function bell(a, mu, sigma, x) {
    const d = (x - mu) / sigma;
    return a * Math.exp(-d*d);
}

function exposure(logsense, sp) {
    return logsense.map(e => Math.pow(10, e)).mmul(sp.transpose());
}

function normalizedSense(logsense, light) {
    const E = exposure(logsense, light);
    const theta = E.map(e => -Math.log(e)/Math.LN10);
    console.log('theta:', theta);
    const normSense = logsense.rowWise((s, t) => s + t, theta);
    console.log('Exposure with normalized sense:', exposure(normSense, light.map(e => e * 10)));
    return normSense;
}

function transmittanceToXyzMtx(light) {
    const N = A_1931_64_400_700_10nm.row(1).dot(light);
    return A_1931_64_400_700_10nm.colWise((a, l) => a * l, light.map(l => 100 / N * l));
}

function chromaticity(xyz) {
    const v = xyz.reduce((acc, x) => acc + x, 0);
    if (Math.abs(v) < 1e-10) {
        return Matrix.fromArray([[1/3, 1/3]]);
    }
    return xyz.map(x => x / v);
}

function whitePoint(ill) {
    const xyz = A_1931_64_400_700_10nm.mmul(ill.transpose()); 
    return chromaticity(xyz);
}

function transmittance(dyes, qs) {
    return dyes.transpose().mmul(qs.transpose()).map(e => Math.pow(10, -e)).transpose();
}

function outflux(dyes, light, qs) {
    return light.elementWise((l, t) => l * t, transmittance(dyes, qs));
}

function dyeDensity(dyes, light, qs) {
    const out = outflux(dyes, light, qs);
    const sum = (acc, x) => acc + x;
    const r = light.reduce(sum, 0) / out.reduce(sum, 0);
    return Math.log(r) / Math.LN10;
}

function normalizedDyesQs(dyes, light, density) {
    const trMtx = transmittanceToXyzMtx(light);
    const wp = whitePoint(light);
    const opt = nlopt.Optimize(nlopt.Algorithm.LN_PRAXIS, 3);
    opt.setMinObjective((x, grad) => {
        const qs = Matrix.fromTypedArray(x, [1, 3]);
        const d = dyeDensity(dyes, light, qs);
        const trans = transmittance(dyes, qs);
        const xyz = trMtx.mmul(trans.transpose());
        const xy = chromaticity(xyz);

        const dd = d - density;
        const dxy = xy.elementWise((x, y) => x-y, wp);
        return dd*dd + dxy.dot(dxy);
    }, 1e-4);
    opt.setLowerBounds([0, 0, 0]);
    opt.setUpperBounds([7, 7, 7]);
    const optRes = opt.optimize([0, 0, 0]);
    return Matrix.fromArray([optRes.x]);
}

function normalizedDyes(dyes, light, density) {
    const qs = normalizedDyesQs(dyes, light, density);
    return dyes.rowWise((d, q) => d * q, qs);
}

class ReflGen {
    constructor(spectrumData) {
        this.triToVMtx = Matrix.fromArray(spectrumData.tri_to_v_mtx);
        this.base = Matrix.fromArray(spectrumData.base).transpose();
        this.light = Matrix.fromArray([spectrumData.light]);
    }

    spectrumOf(xyz) {
        return this.reflOf(xyz).elementWise((x, y) => x*y, this.light);
    }

    reflOf(xyz) {
        const v = this.triToVMtx.mmul(xyz.transpose());
        return this.base.mmul(v).clip(1e-15, 1).transpose();
    }
}

function referenceColors() {
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

class Chi {
    constructor(xmin, xmax, ymin, ymax) {
        this.xmin = xmin;
        this.xmax = xmax;
        this.ymin = ymin;
        this.ymax = ymax;
    }

    static to(ymin, ymax, gamma, xmax) {
        const xmin = xmax - (ymax - ymin) / gamma;
        return new Chi(xmin, xmax, ymin, ymax);
    }

    get(x) {
        if (x < this.xmin) {
            return this.ymin;
        }
        if (x > this.xmax) {
            return this.ymax;
        }
        return (x - this.xmin) / (this.xmax - this.xmin) * (this.ymax - this.ymin) + this.ymin;
    }

    gamma() {
        return (this.ymax - this.ymin) / (this.xmax - this.xmin);
    }

    hmax() {
        return this.xmax;
    }
}

const N_FREE_PARAMS = 0;
const GAUSSIAN_LAYERS = [0, 0, 1, 1, 1, 1, 2, 2];
const N_GAUSSIANS = GAUSSIAN_LAYERS.length;
const N_GAUSSIAN_PARAMS = 3 * N_GAUSSIANS;
const N_PARAMS = N_FREE_PARAMS + N_GAUSSIAN_PARAMS;

function loadDatasheet(filename) {
    const json = fs.readFileSync(filename);
    const data = JSON.parse(json);

    return {
        sense: Matrix.fromArray([
            data.red.sense,
            data.green.sense,
            data.blue.sense
        ]),
        dyes: Matrix.fromArray([
            data.red.dye.data,
            data.green.dye.data,
            data.blue.dye.data,
        ]),
    };
}

function loadSpectrumData(filename) {
    const json = fs.readFileSync(filename);
    const data = JSON.parse(json);

    return data;
}

export class Developer {
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

        this.filmSense = normalizedSense(this.filmds.sense, this.devLight);
        this.filmDyes = normalizedDyes(this.filmds.dyes, this.projLight, 1.0);

        this.paperDyes0 = normalizedDyes(this.paperds.dyes, this.reflLight, 1.0);
        this.paperSense = normalizedSense(this.paperds.sense, this.projLight);

        const cf = Chi.to(0, this.kfmax, 0.5, 0);
        console.log(`Chi film at 0: ${cf.get(0)}, kfmax: ${this.kfmax}`);
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

    dyesToXyz(dyes, qs) {
        const trans = transmittance(dyes, qs);
        return this.mtxRefl.mmul(trans.transpose()).transpose();
    }

    develop(xyz) {
        const sp = this.reflGen.spectrumOf(xyz);
        const H = exposure(this.filmSense, sp).map(log10);
        const negative = this.developFilm(H);
        const positive = this.developPaper(negative);
        return this.dyesToXyz(positive, Matrix.fill([1, 3], 1));
    }

    developFilmSep(H) {
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

    developFilm(H) {
        const [developedDyes, developedCouplers] = this.developFilmSep(H);
        return developedDyes.add(developedCouplers);
    }

    developPaper(negative) {
        const ymax = 4;
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

    beta(D) {
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
    
    delta(D) {
        const betas = this.beta(D);
        const kps = Matrix.fromArray([[
            this.chiPaper[0].get(betas.getv(0)),
            this.chiPaper[1].get(betas.getv(1)),
            this.chiPaper[2].get(betas.getv(2)),
        ]]);
        const refl = kps.map(e => -e).mmul(this.paperDyes0).map(e => Math.pow(10, e));
        return log10(this.reflLight.sum() / this.reflLight.dot(refl));
    }
    
    makeCouplers(qs) {
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
    makeCouplersFromMatrix(couplers) {
        this.couplers = couplers;
    }
}

class Solver {
    constructor() {
        this.xyzs = referenceColors();
        this.dev = new Developer();
    }

    solveFun(qs, print = false)
    {
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

    solve() {
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

export async function profile() {
    await nlopt.ready;
    const solver = new Solver();
    solver.solve();
    solver.solveFun(solver.solution, true);
}

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

