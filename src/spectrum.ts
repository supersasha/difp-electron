import { Matrix } from './matrix';
import { log10, mul } from './math';
import { chromaticity } from './colors';
import * as nlopt from 'nlopt-js';

import { SpectrumData, saveSpectrumData } from './data';
import { nmf } from './nmf';

function colorMatchingG(x: number, mu: number, sigma1: number, sigma2: number): number {
    const dx = x - mu;
    if (x < mu) {
        return Math.exp(-0.5*dx*dx/(sigma1*sigma1));
    } else {
        return Math.exp(-0.5*dx*dx/(sigma2*sigma2));
    }
}

function colorMatchingX(lambda: number): number {
    return 1.056 * colorMatchingG(lambda, 599.8, 37.9, 31.0) +
           0.362 * colorMatchingG(lambda, 442.0, 16.0, 26.7) +
          -0.065 * colorMatchingG(lambda, 501.1, 20.4, 26.2);
}

function colorMatchingY(lambda: number): number {
    return 0.821 * colorMatchingG(lambda, 568.8, 46.9, 40.5) +
           0.286 * colorMatchingG(lambda, 530.9, 16.3, 31.1);
}

function colorMatchingZ(lambda: number): number {
    return 1.217 * colorMatchingG(lambda, 437.0, 11.8, 36.0) +
           0.681 * colorMatchingG(lambda, 459.0, 26.0, 13.8);
}

export function colorMatchingMatrix(): Matrix {
    return Matrix.withGen([3, 31], (r, c) => {
        if (r === 0) {
            return colorMatchingX(400 + c * 10);
        } else if (r === 1) {
            return colorMatchingY(400 + c * 10);
        } else {
            return colorMatchingZ(400 + c * 10);
        }
    });
}

export const COLOR_MATCHING_MTX = colorMatchingMatrix();

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


export const D65 = Matrix.fromArray([[
    82.754900,
    91.486000,
    93.431800,
    86.682300,
    104.865000,
    117.008000,
    117.812000,
    114.861000,
    115.923000,
    108.811000,
    109.354000,
    107.802000,
    104.790000,
    107.689000,
    104.405000,
    104.046000,
    100.000000,
    96.334200,
    95.788000,
    88.685600,
    90.006200,
    89.599100,
    87.698700,
    83.288600,
    83.699200,
    80.026800,
    80.214600,
    82.277800,
    78.284200,
    69.721300,
    71.609100,
]]);

export function daylightSpectrum(temp: number): Matrix {
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

export function exposure(logsense: Matrix, sp: Matrix): Matrix {
    return logsense.map(e => Math.pow(10, e)).mmul(sp.transpose());
}

export function logExposure(logsense: Matrix, sp: Matrix): Matrix {
    return exposure(logsense, sp).map(log10);
}

// Sensors normalized to logExposure to be zero (0, 0, 0) at light
export function normalizedSense(logsense: Matrix, light: Matrix): Matrix {
    const E = exposure(logsense, light);
    const theta = E.map(e => -log10(e));
    const normSense = logsense.rowWise((s, t) => s + t, theta);
    return normSense;
}

// ?? The matrix that when being multiplied by spectral transmittance
// ?? will give the XYZ color.
// ?? It is assumed that the light gives white color of maximum intensity.
export function transmittanceToXyzMtx(light: Matrix): Matrix {
    const N = COLOR_MATCHING_MTX.row(1).dot(light);
    return COLOR_MATCHING_MTX.colWise((a, l) => a * l, light.map(l => 100 / N * l));
}

export function reflectanceUnderLightSource(refl: Matrix, light: Matrix): Matrix {
    const mtx = transmittanceToXyzMtx(light);
    return refl.mmul(mtx.transpose());
}

export function whitePoint(ill: Matrix): Matrix {
    const xyz = COLOR_MATCHING_MTX.mmul(ill.transpose()); 
    return chromaticity(xyz);
}

// Spectral transmittance of the dyes taken in the given quantities,
// i.e. what part of the light passes through the dyes on each wavelength.
// The maximum is 1 at each wavelength (full transmission).
export function transmittance(dyes: Matrix, qs: Matrix): Matrix {
    return dyes.transpose().mmul(qs.transpose()).map(e => Math.pow(10, -e)).transpose();
}

export function layerTransmittance(dye: Matrix, q: number): Matrix {
    return dye.map(x => Math.pow(10, -x * q));
}

// The light that passes through the dyes if the given light falls
export function outflux(dyes: Matrix, light: Matrix, qs: Matrix): Matrix {
    return light.elementWise((l, t) => l * t, transmittance(dyes, qs));
}

// The integral (not spectral) density the dyes (taken with the given quantities)
// create when the given light falls on them.
export function dyeDensity(dyes: Matrix, light: Matrix, qs: Matrix): number {
    const out = outflux(dyes, light, qs);
    const sum = (acc: number, x: number) => acc + x;
    const r = light.reduce(sum, 0) / out.reduce(sum, 0);
    return Math.log(r) / Math.LN10;
}

// Returns quantities of dyes so that the light transmitted or reflected
// from the dyes would create neutral (gray) color of the given density
export function normalizedDyesQs(dyes: Matrix, light: Matrix, density: number): Matrix {
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

export function normalizedDyes(dyes: Matrix, light: Matrix, density: number): Matrix {
    const qs = normalizedDyesQs(dyes, light, density);
    return dyes.rowWise((d, q) => d * q, qs);
}

export class ReflGen {
    private triToVMtx: Matrix; // 3x3
    private base: Matrix; // 31x3
    private light: Matrix; // 1x31

    constructor(spectrumData: SpectrumData) {
        this.triToVMtx = Matrix.fromArray(spectrumData.tri_to_v_mtx);
        this.base = Matrix.fromArray(spectrumData.base).transpose();
        this.light = Matrix.fromArray([spectrumData.light]);
    }

    spectrumOf(xyz: Matrix, light?: Matrix): Matrix {
        const li = light || this.light;
        return this.reflOf(xyz).elementWise((x, y) => x*y, li);
    }

    reflOf(xyz: Matrix): Matrix {
        const v = this.triToVMtx.mmul(xyz.transpose());
        return this.base.mmul(v).transpose().clip(1.0e-15, 1);
    }
    
    reflOfUnclipped(xyz: Matrix): Matrix {
        const v = this.triToVMtx.mmul(xyz.transpose());
        return this.base.mmul(v).transpose();
    }

    getBase(): Matrix {
        return this.base;
    }

    getLight(): Matrix {
        return this.light;
    }

    save(filename: string): void {
        const spectrumData: SpectrumData = {
            wp: [],
            light: this.light.toFlatArray(),
            base: this.base.transpose().toArray(),
            tri_to_v_mtx: this.triToVMtx.toArray()
        };
        saveSpectrumData(filename, spectrumData);
    }
}

export function generateSpectrumData(refls: Matrix[], light: Matrix): SpectrumData {
    const rsMtx = Matrix.fromRows(refls); // rsMtx(n x 31) = w(n x 3) * h(3 x 31)
    //const { h } = nmf(rsMtx, 3);
    const k = 100.0;
    const n = light.dot(COLOR_MATCHING_MTX.row(1));
    const a = COLOR_MATCHING_MTX.colWise(mul, light).mul(k / n); // 3x31
    //const base = h.transpose(); // 31 x 3
    const base = rsMtx.transpose();
    const triToVMtx = a.mmul(base).inv3x3();
    return {
        wp: [], // should be white point xy, but unused
        light: light.toFlatArray(),
        base: base.transpose().toArray(),
        tri_to_v_mtx: triToVMtx.toArray(),
    };
}
