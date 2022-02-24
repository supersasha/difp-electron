import * as fs from 'fs';
import { Matrix } from './matrix';

export interface SpectrumData {
    wp: number[];
    light: number[];            // 31
    base: number[][];           // 3x31
    tri_to_v_mtx: number[][];   // 3x3
}

export interface Datasheet {
    sense: Matrix; // 3x31
    dyes: Matrix;  // 3x31
}

export function loadDatasheet(filename: string): Datasheet {
    const json = fs.readFileSync(filename, { encoding: 'utf8' });
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

export function loadSpectrumData(filename: string): SpectrumData {
    const json = fs.readFileSync(filename, { encoding: 'utf8' });
    const data = JSON.parse(json);

    return data;
}

export function saveSpectrumData(filename: string, sd: SpectrumData): void {
    const json = JSON.stringify(sd, null, 4);
    fs.writeFileSync(filename, json);
}
