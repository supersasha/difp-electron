import { Matrix } from './matrix';
import { log10, mul } from './math';
import { chromaticity } from './colors';
import nlopt from 'nlopt-js';

(async function() {
    await nlopt.ready;
})();

export const A_1931_64_400_700_10nm = Matrix.fromArray([
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

export function daylightSpectrum(temp) {
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

export function exposure(logsense, sp) {
    return logsense.map(e => Math.pow(10, e)).mmul(sp.transpose());
}

export function logExposure(logsense, sp) {
    return exposure(logsense, sp).map(log10);
}

// Sensors normalized to logExposure to be zero (0, 0, 0) at light
export function normalizedSense(logsense, light) {
    const E = exposure(logsense, light);
    const theta = E.map(e => -log10(e));
    //console.log('theta:', theta);
    const normSense = logsense.rowWise((s, t) => s + t, theta);
    //console.log('Exposure with normalized sense:', exposure(normSense, light.map(e => e * 10)));
    //console.log('logExposure with normalized sense:', logExposure(normSense, light));
    return normSense;
}

// ?? The matrix that when being multiplied by spectral transmittance
// ?? will give the XYZ color.
// ?? It is assumed that the light gives white color of maximum intensity.
export function transmittanceToXyzMtx(light) {
    const N = A_1931_64_400_700_10nm.row(1).dot(light);
    return A_1931_64_400_700_10nm.colWise((a, l) => a * l, light.map(l => 100 / N * l));
}

export function whitePoint(ill) {
    const xyz = A_1931_64_400_700_10nm.mmul(ill.transpose()); 
    return chromaticity(xyz);
}

// Spectral transmittance of the dyes taken in the given quantities,
// i.e. what part of the light passes through the dyes on each wavelength.
// The maximum is 1 at each wavelength (full transmission).
export function transmittance(dyes, qs) {
    return dyes.transpose().mmul(qs.transpose()).map(e => Math.pow(10, -e)).transpose();
}

export function layerTransmittance(dye, q) {
    return dye.map(x => Math.pow(10, -x * q));
}

// The light that passes through the dyes if the given light falls
export function outflux(dyes, light, qs) {
    return light.elementWise((l, t) => l * t, transmittance(dyes, qs));
}

// The integral (not spectral) density the dyes (taken with the given quantities)
// create when the given light falls on them.
export function dyeDensity(dyes, light, qs) {
    const out = outflux(dyes, light, qs);
    const sum = (acc, x) => acc + x;
    const r = light.reduce(sum, 0) / out.reduce(sum, 0);
    return Math.log(r) / Math.LN10;
}

// Returns quantities of dyes so that the light transmitted or reflected
// from the dyes would create neutral (gray) color of the given density
export function normalizedDyesQs(dyes, light, density) {
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

export function normalizedDyes(dyes, light, density) {
    const qs = normalizedDyesQs(dyes, light, density);
    return dyes.rowWise((d, q) => d * q, qs);
}

export class ReflGen {
    constructor(spectrumData) {
        this.triToVMtx = Matrix.fromArray(spectrumData.tri_to_v_mtx);
        this.base = Matrix.fromArray(spectrumData.base).transpose();
        this.light = Matrix.fromArray([spectrumData.light]);
    }

    spectrumOf(xyz, light) {
        const li = light || this.light;
        return this.reflOf(xyz).elementWise((x, y) => x*y, li);
    }

    reflOf(xyz) {
        const v = this.triToVMtx.mmul(xyz.transpose());
        return this.base.mmul(v).transpose().clip(1e-15, 1);
    }
}
