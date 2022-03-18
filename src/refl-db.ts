import { Matrix } from './matrix';
import * as fs from 'fs';
import { daylightSpectrum, transmittanceToXyzMtx } from './spectrum';
import { chromaticity } from './colors';

class ReflDB {
    private length: number = 0;
    private data: Matrix[] = [];

    constructor() {
        const filename = 'data/TotalRefs_IndividualSpectra.json';
        const json = fs.readFileSync(filename, { encoding: 'utf8' });
        const data = JSON.parse(json);
        for(let sp of data.spectra) {
            /*
            let max = 0;
            for (let i = 0; i < sp.length; i++) {
                if (sp[i] > max) {
                    max = sp[i];
                }
            }
            */
            this.data.push(Matrix.fromArray([sp]));//.mul(1/max));
        }
        this.length = this.data.length;
    }

    getRefl(index: number): Matrix {
        return this.data[index];
    }

    getReflStretched(index: number): Matrix {
        const refl = this.getRefl(index);
        const max = refl.reduce((acc, e) => e > acc ? e : acc, 0.0001);
        return refl.mul(1/max);
    }

    getSize(): number {
        return this.length;
    }

    shuffle() {
        for(let i = this.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * i);
            const temp = this.data[i];
            this.data[i] = this.data[j];
            this.data[j] = temp;
        }
    }

    getChromaticities(light: Matrix): Matrix {
        const mtx = transmittanceToXyzMtx(light).transpose();
        return Matrix.withColumnGen([2, this.length], (i: number) => {
            const xyz = this.getRefl(i).mmul(mtx);
            return chromaticity(xyz).toFlatArray();
        });
    }
}

let reflDB: ReflDB = null;

export function getReflDB(): ReflDB {
    if (!reflDB) {
        reflDB = new ReflDB();
        //reflDB.saveAs('row-by-row-spectra-64bit-float.bin');
    }
    return reflDB;
}
