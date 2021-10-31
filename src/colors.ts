import { Matrix } from './matrix';

export function xyzToSrgb(c: Matrix): Matrix {
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

export function srgbToXyz(c: Matrix): Matrix {
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

export function xyzToLab(c: Matrix): Matrix {
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

export function labToLch(c: Matrix): Matrix {
    return Matrix.fromArray([[
        c.getv(0),
        Math.hypot(c.getv(1), c.getv(2)),
        Math.atan2(c.getv(2), c.getv(1)),
    ]]);
}

export function xyzToLch(c: Matrix): Matrix {
    return labToLch(xyzToLab(c));
}

export function deltaE94Xyz(xyz1: Matrix, xyz2: Matrix): number {
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

export function chromaticity(xyz: Matrix): Matrix {
    const v = xyz.reduce((acc, x) => acc + x, 0);
    if (Math.abs(v) < 1e-10) {
        return Matrix.fromArray([[1/3, 1/3]]);
    }
    return Matrix.fromArray([[xyz.getv(0) / v, xyz.getv(1) / v]]); //xyz.map(x => x / v);
}

