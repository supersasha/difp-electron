import { Matrix } from './matrix';
import { mul, div } from './math';

interface NmfResult {
    w: Matrix;
    h: Matrix;
    iter: number;
}

// V (n x m) = W (n x features) x H (features x m)
export function nmf(v: Matrix, features: number): NmfResult {
    const [n, m] = v.shape;

    // init matrices
    let w = Matrix.random([n, features]);
    let h = Matrix.random([features, m]);

    let iter = 0;
    while(true) {
        const h1 = nextH(v, w, h);
        const w1 = nextW(v, w, h1);
        iter++;

        if (stopCondition(w, h, w1, h1)) {
            w = w1;
            h = h1;
            break;
        }
        
        w = w1;
        h = h1;
    }

    return { w, h, iter };
}

function nextH(v: Matrix, w: Matrix, h: Matrix): Matrix {
    const wt = w.transpose();
    const u = wt.mmul(v);
    const l = wt.mmul(w).mmul(h).clip(1e-9, Infinity);
    const h1 = h.elementWise(mul, u).elementWise(div, l);
    return h1;
}

function nextW(v: Matrix, w: Matrix, h: Matrix): Matrix {
    const ht = h.transpose();
    const u = v.mmul(ht);
    const l = w.mmul(h).mmul(ht).clip(1e-9, Infinity);
    const w1 = w.elementWise(mul, u).elementWise(div, l);
    return w1;
}

function stopCondition(w0, h0, w1, h1): boolean {
    const [nw, mw] = w0.shape;
    const [nh, mh] = h0.shape;
    const norm = w1.sub(w0).norm1() / nw / mw + h1.sub(h0).norm1() / nh / mh;
    //console.log(norm);
    return norm < 1e-5;
}
