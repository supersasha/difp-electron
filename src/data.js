import fs from 'fs';
import { Matrix } from './matrix';
export function loadDatasheet(filename) {
    const json = fs.readFileSync(filename);
    const data = JSON.parse(json);

    return {
        sense: Matrix.fromArray([
            data.red.sense,
            data.green.sense,
            data.blue.sense
        ]),
        dyes: Matrix.fromArray([
            data.red.dye.data,
            data.green.dye.data,
            data.blue.dye.data,
        ]),
    };
}

export function loadSpectrumData(filename) {
    const json = fs.readFileSync(filename);
    const data = JSON.parse(json);

    return data;
}

