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

export class Chi {
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

