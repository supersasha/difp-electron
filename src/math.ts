export function log10(v: number): number {
    return Math.log(v) / Math.LN10;
}

export function sigma(x: number, ymin: number, ymax: number, gamma: number, bias: number, smoo: number): number {
    const a = (ymax - ymin) / 2;
    const y = gamma * (x - bias) / a;
    return a * (y / Math.pow(1 + Math.pow(Math.abs(y), 1/smoo), smoo) + 1) + ymin;
}

export function bell(a: number, mu: number, sigma: number, x: number): number {
    const d = (x - mu) / sigma;
    return a * Math.exp(-d*d);
}

export function add(a: number, b: number): number {
    return a + b;
}

export function sub(a: number, b: number): number {
    return a - b;
}

export function mul(a: number, b: number): number {
    return a * b;
}

export function div(a: number, b: number): number {
    return a / b;
}

export function neg(a: number): number {
    return -a;
}

export class Chi {
    xmin: number;
    xmax: number;
    ymin: number;
    ymax: number;
    gamma: number;

    constructor(xmin: number, xmax: number, ymin: number, ymax: number) {
        this.xmin = xmin;
        this.xmax = xmax;
        this.ymin = ymin;
        this.ymax = ymax;
        this.gamma = (ymax - ymin) / (xmax - xmin);
    }

    static to(ymin: number, ymax: number, gamma: number, xmax: number): Chi {
        const xmin = xmax - (ymax - ymin) / gamma;
        return new Chi(xmin, xmax, ymin, ymax);
    }

    static from(ymin: number, gamma: number, xmin: number, xmax: number): Chi {
        const ymax = gamma * (xmax - xmin) + ymin;
        return new Chi(xmin, xmax, ymin, ymax);
    }

    at(x: number): number {
        return this.get(x);
    }

    get(x: number): number {
        if (x < this.xmin) {
            return this.ymin;
        }
        if (x > this.xmax) {
            return this.ymax;
        }
        return (x - this.xmin) * this.gamma + this.ymin;
    }

    // obsolete, use xmax directly
    hmax(): number {
        return this.xmax;
    }
}

export interface Rect {
    width: number;
    height: number;
}

export function inscribedRect(w: number, h: number, ratio: number): Rect {
    if (ratio * h < w) {
        return { width: Math.floor(ratio * h), height: h };
    } else {
        return { width: w, height: Math.floor(w / ratio) };
    }
}

