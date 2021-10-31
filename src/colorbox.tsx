import * as React from 'react';
import { Matrix } from './matrix';
import { xyzToSrgb } from './colors';

export interface RGBColorBoxProps {
    size: number;
    red: number;
    green: number;
    blue: number;
    rgb: Matrix;
}

export function RGBColorBox(_props: Partial<RGBColorBoxProps>): React.ReactElement {
    const defaultProps = {
        size: 100,
        red: 0,
        green: 0,
        blue: 0,
    };
    const props = {...defaultProps, ..._props};
    if (props.rgb instanceof Matrix) {
        props.red = props.rgb.getv(0);
        props.green = props.rgb.getv(1);
        props.blue = props.rgb.getv(2);
    }
    return (
        <div style={{
            width: props.size,
            height: props.size,
            background: `rgb(${props.red*100}%, ${props.green*100}%, ${props.blue*100}%)`
        }}>
        </div>
    );
}

export interface XYZColorBoxProps {
    size: number;
    x: number;
    y: number;
    z: number;
    xyz: Matrix;
}

export function XYZColorBox(_props: Partial<XYZColorBoxProps>): React.ReactElement {
    const defaultProps = {
        size: 100,
        x: 0,
        y: 0,
        z: 0
    };
    const props = {...defaultProps, ..._props};
    if (props.xyz instanceof Matrix) {
        props.x = props.xyz.getv(0);
        props.y = props.xyz.getv(1);
        props.z = props.xyz.getv(2);
    }
    const rgb = xyzToSrgb(Matrix.fromArray([[props.x, props.y, props.z]]));
    return (
        <RGBColorBox size={props.size} rgb={rgb} />
    );
}
