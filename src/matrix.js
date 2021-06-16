class Matrix {
    constructor(data, shape) {
        this.data = data;
        this.shape = shape;
    }

    static fromArray(a) {
        let shape = [];
        let b = a;
        while(Array.isArray(b)) {
            shape.push(b.length);
            b = b[0];
        }
        return new Matrix(new Float64Array(a.flat(shape.length)), shape);
    }

    static fromTypedArray(a, shape) {
        return new Matrix(a, shape);
    }

    static empty(shape) {
        const size = shape.reduce((acc, s) => acc * s, 1);
        return new Matrix(new Float64Array(size), shape);
    }

    static random(shape) {
        const size = shape.reduce((acc, s) => acc * s, 1);
        const res = Matrix.empty(shape);
        for (let i = 0; i < size; i++) {
            res.data[i] = Math.random();
        }
        return res;
    }

    static fill(shape, v) {
        const res = Matrix.empty(shape);
        res.data.fill(v);
        return res;
    }

    toArray() {
        const res = [];
        for (let row = 0; row < this.shape[0]; row++) {
            const a = [];
            for (let col = 0; col < this.shape[1]; col++) {
                a.push(this.get(row, col));
            }
            res.push(a);
        }
        return res;
    }

    toFlatArray() {
        return [...this.data];
    }

    size() {
        return this.shape.reduce((acc, e) => acc * e, 1);
    }

    set(row, col, val) {
        this.data[row * this.shape[1] + col] = val;
    }

    get(row, col) {
        return this.data[row * this.shape[1] + col];
    }

    getv(i) {
        return this.data[i];
    }

    row(r) {
        const res = Matrix.empty([1, this.shape[1]]);
        for (let i = 0; i < this.shape[1]; i++) {
            res.data[i] = this.get(r, i);
        }
        return res;
    }

    col(c) {
        const res = Matrix.empty([this.shape[0], 1]);
        for (let i = 0; i < this.shape[0]; i++) {
            res.data[i] = this.get(i, c);
        }
        return res;
    }

    map(f) {
        return new Matrix(this.data.map(f), this.shape);
    }

    reduce(f/*(acc, x)*/, acc0) {
        return this.data.reduce(f, acc0);
    }

    elementWise(f, m) {
        if (this.shape[0] != m.shape[0] || this.shape[1] != m.shape[1]) {
            throw new Error(`Shapes don't match: ${this.shape} vs ${m.shape}`);
        }
        const res = Matrix.empty(this.shape);
        const size = this.size();
        for (let i = 0; i < size; i++) {
            res.data[i] = f(this.data[i], m.data[i]);
        }
        return res;
    }

    rowWise(f, v) {
        if (this.shape[0] !== v.size()) {
            throw `Vector size should be ${this.shape[0]} vs ${v.size()}`;
        }
        const res = Matrix.empty(this.shape);
        for(let row = 0; row < this.shape[0]; row++) {
            for (let col = 0; col < this.shape[1]; col++) {
                res.set(row, col, f(this.get(row, col), v.data[row]));
            }
        }
        return res;
    }

    colWise(f, v) {
        if (this.shape[1] !== v.size()) {
            throw `Vector size should be ${this.shape[1]} vs ${v.size()}`;
        }
        const res = Matrix.empty(this.shape);
        for(let row = 0; row < this.shape[0]; row++) {
            for (let col = 0; col < this.shape[1]; col++) {
                res.set(row, col, f(this.get(row, col), v.data[col]));
            }
        }
        return res;
    }

    mmul(m) {
        if (this.shape[1] !== m.shape[0]) {
            throw new Error(`Shapes don't allow matrix multiplication: ${this.shape} vs ${m.shape}`);
        }
        const res = Matrix.empty([this.shape[0], m.shape[1]]);
        for (let row = 0; row < this.shape[0]; row++) {
            for (let col = 0; col < m.shape[1]; col++) {
                let s = 0;
                for (let k = 0; k < this.shape[1]; k++) {
                    s += this.get(row, k) * m.get(k, col);
                }
                res.set(row, col, s);
            }
        }
        return res;
    }

    dot(v) {
        if (this.shape[0] !== 1 && this.shape[1] !== 1) {
            throw new Error(`Dot: this is not vector, shape: ${this.shape}`);
        }
        if (v.shape[0] !== 1 && v.shape[1] !== 1) {
            throw new Error(`Dot: other is not vector, shape: ${v.shape}`);
        }
        const size = this.size();
        if (size !== v.size()) {
            throw new Error(`Dot: sizes don't match: ${size} vs ${v.size()}`);
        }
        let s = 0;
        for (let i = 0; i < size; i++) {
            s += this.data[i] * v.data[i];
        }
        return s;
    }

    show(precision = 2) {
        let maxWidth = 0;
        for (let row = 0; row < this.shape[0]; row++) {
            for (let col = 0; col < this.shape[1]; col++) {
                const v = this.get(row, col);
                const len = v.toFixed(precision).length;
                if (len > maxWidth) {
                    maxWidth = len;
                }
            }
        }
        let lines = '';
        for (let row = 0; row < this.shape[0]; row++) {
            let line = '';
            for (let col = 0; col < this.shape[1]; col++) {
                const v = this.get(row, col);
                const s = v.toFixed(precision).padStart(maxWidth + 1);
                line += s;
            }
            lines += line + '\n';
        }
        return lines;
    }

    transpose() {
        const res = Matrix.empty([this.shape[1], this.shape[0]]);
        for (let i = 0; i < this.shape[0]; i++) {
            for (let j = 0; j < this.shape[1]; j++) {
                res.set(j, i, this.get(i, j));
            }
        }
        return res;
    }

    add(m) {
        return this.elementWise((e1, e2) => e1 + e2, m);
    }

    sub(m) {
        return this.elementWise((e1, e2) => e1 - e2, m);
    }

    div(m) {
        return this.elementWise((e1, e2) => e1 / e2, m);
    }

    mul(s) {
        return this.map(e => s * e);
    }

    reduce(f, acc0) {
        return this.data.reduce(f, acc0);
    }

    sum() {
        return this.reduce((acc, e) => acc + e, 0);
    }

    clip(low, high) {
        return this.map(e => {
            if (e < low) {
                return low;
            }
            if (e > high) {
                return high;
            }
            return e;
        });
    }
}

module.exports = {
    Matrix
};
