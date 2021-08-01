import React from 'react';
import { Matrix } from './matrix';
import { xyzToSrgb } from './colors';

export function RGBColorBox(_props) {
    const defaultProps = {
        size: 100,
        red: 0,
        green: 0,
        blue: 0
    };
    const props = {...defaultProps, ..._props};
    return (
        <div style={{
            width: props.size,
            height: props.size,
            background: `rgb(${props.red*100}%, ${props.green*100}%, ${props.blue*100}%)`
        }}>
        </div>
    );
}

export function XYZColorBox(_props) {
    const defaultProps = {
        size: 100,
        x: 0,
        y: 0,
        z: 0
    };
    const props = {...defaultProps, ..._props};
    const rgb = xyzToSrgb(Matrix.fromArray([[props.x, props.y, props.z]]));
    return (
        <RGBColorBox size={props.size}
            red={rgb.getv(0)}
            green={rgb.getv(1)}
            blue={rgb.getv(2)}
        />
    );
}
