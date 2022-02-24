import * as React from 'react';
import { Matrix } from '../matrix';

export interface MatrixDispProps {
    mtx: Matrix;
    precision?: number;
}

export function MatrixDisp(props: MatrixDispProps): React.ReactElement {
    const precision = props.precision || 2;
    const [nrows, ncols] = props.mtx.shape;
    const rows = [];
    for (let r = 0; r < nrows; r++) {
        const cols = [];
        for (let c = 0; c < ncols; c++) {
            cols.push(
                <td key={c} style={{ padding: '2px', textAlign: 'right'}}>{
                    props.mtx.get(r, c).toFixed(precision)
                }</td>);
        }
        rows.push(
            <tr key={r}>{ cols }</tr>
        );
    }
    return (
        <table>
            <tbody>
                { rows }
            </tbody>
        </table>
    );
}

