type MatrixShape = [number, number];

export class Matrix {
    data: Float64Array;
    shape: MatrixShape;

    constructor(data: Float64Array, shape: MatrixShape) {
        this.data = data;
        this.shape = shape;
    }

    copy(): Matrix {
        return new Matrix(new Float64Array(this.data), [...this.shape]);
    }

    static fromArray(a: number[][]): Matrix {
        return new Matrix(new Float64Array(a.flat(2)), [a.length, a[0].length]);
    }

    static fromTypedArray(a: any, shape: MatrixShape): Matrix {
        return new Matrix(a, shape);
    }

    static empty(shape: MatrixShape): Matrix {
        const size = shape.reduce((acc, s) => acc * s, 1);
        return new Matrix(new Float64Array(size), shape);
    }

    static random(shape: MatrixShape): Matrix {
        const size = shape.reduce((acc, s) => acc * s, 1);
        const res = Matrix.empty(shape);
        for (let i = 0; i < size; i++) {
            res.data[i] = Math.random();
        }
        return res;
    }

    static fill(shape: MatrixShape, v: number): Matrix {
        const res = Matrix.empty(shape);
        res.data.fill(v);
        return res;
    }

    toArray(): number[][] {
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

    toFlatArray(): number[] {
        return [...this.data];
    }

    size(): number {
        return this.shape.reduce((acc, e) => acc * e, 1);
    }

    set(row: number, col: number, val: number): Matrix {
        this.data[row * this.shape[1] + col] = val;
        return this;
    }

    get(row: number, col: number): number {
        return this.data[row * this.shape[1] + col];
    }

    getv(i: number): number {
        return this.data[i];
    }

    setv(i: number, v: number): Matrix {
        this.data[i] = v;
        return this;
    }

    row(r: number): Matrix {
        const res = Matrix.empty([1, this.shape[1]]);
        for (let i = 0; i < this.shape[1]; i++) {
            res.data[i] = this.get(r, i);
        }
        return res;
    }

    col(c: number): Matrix {
        const res = Matrix.empty([this.shape[0], 1]);
        for (let i = 0; i < this.shape[0]; i++) {
            res.data[i] = this.get(i, c);
        }
        return res;
    }

    map(f: (x: number) => number): Matrix {
        return new Matrix(this.data.map(f), this.shape);
    }

    reduce(f: (acc: number, e: number) => number, acc0: number): number {
        return this.data.reduce(f, acc0);
    }

    elementWise(f: (x1: number, x2: number) => number, m: Matrix): Matrix {
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

    rowWise(f: (x1: number, x2: number) => number, v: Matrix): Matrix {
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

    colWise(f: (x1: number, x2: number) => number, v: Matrix): Matrix {
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

    mmul(m: Matrix): Matrix {
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

    dot(v: Matrix): number {
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

    show(precision = 2): string {
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

    transpose(): Matrix {
        const res = Matrix.empty([this.shape[1], this.shape[0]]);
        for (let i = 0; i < this.shape[0]; i++) {
            for (let j = 0; j < this.shape[1]; j++) {
                res.set(j, i, this.get(i, j));
            }
        }
        return res;
    }

    add(m: Matrix): Matrix {
        return this.elementWise((e1, e2) => e1 + e2, m);
    }

    sub(m: Matrix): Matrix {
        return this.elementWise((e1, e2) => e1 - e2, m);
    }

    div(m: Matrix): Matrix {
        return this.elementWise((e1, e2) => e1 / e2, m);
    }

    mul(s: number): Matrix {
        return this.map(e => s * e);
    }

    sum(): number {
        return this.reduce((acc: number, e: number) => acc + e, 0);
    }

    clip(low: number, high: number): Matrix {
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
