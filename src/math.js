export function log10(v) {
    return Math.log(v) / Math.LN10;
}

export function sigma(x, ymin, ymax, gamma, bias, smoo) {
    const a = (ymax - ymin) / 2;
    const y = gamma * (x - bias) / a;
    return a * (y / Math.pow(1 + Math.pow(Math.abs(y), 1/smoo), smoo) + 1) + ymin;
}

export function bell(a, mu, sigma, x) {
    const d = (x - mu) / sigma;
    return a * Math.exp(-d*d);
}

export function add(a, b) {
    return a + b;
}

export function sub(a, b) {
    return a - b;
}

export function mul(a, b) {
    return a * b;
}

export function div(a, b) {
    return a / b;
}

export function neg(a) {
    return -a;
}

export class Chi {
    constructor(xmin, xmax, ymin, ymax) {
        this.xmin = xmin;
        this.xmax = xmax;
        this.ymin = ymin;
        this.ymax = ymax;
        this.gamma = (ymax - ymin) / (xmax - xmin);
    }

    static to(ymin, ymax, gamma, xmax) {
        const xmin = xmax - (ymax - ymin) / gamma;
        return new Chi(xmin, xmax, ymin, ymax);
    }

    static from(ymin, gamma, xmin, xmax) {
        const ymax = gamma * (xmax - xmin) + ymin;
        return new Chi(xmin, xmax, ymin, ymax);
    }

    at(x) {
        return this.get(x);
    }

    get(x) {
        if (x < this.xmin) {
            return this.ymin;
        }
        if (x > this.xmax) {
            return this.ymax;
        }
        return (x - this.xmin) * this.gamma + this.ymin;
    }

    gamma() {
        return this.gamma;
    }

    // obsolete, use xmax directly
    hmax() {
        return this.xmax;
    }
}

