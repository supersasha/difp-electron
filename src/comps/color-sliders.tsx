import * as React from 'react';
import { Matrix } from '../matrix';

import { Slider } from '@mui/material';

export interface ColorSlidersProps {
    labels: string | string[];
    color: Matrix;
    lowerBounds: number[];
    upperBounds: number[];
    steps: number;
    onChange: (color: Matrix) => void;
    sliderWidth: number | string;
}

const defaultProps: ColorSlidersProps = {
    labels: 'RGB',
    color: Matrix.fromArray([[0, 0, 0]]),
    lowerBounds: [0, 0, 0],
    upperBounds: [1, 1, 1],
    steps: 100,
    onChange: () => {},
    sliderWidth: '150px',
};

export function ColorSliders(_props: Partial<ColorSlidersProps>): React.ReactElement {
    const props = { ...defaultProps, ..._props };
    if (typeof props.labels === 'string') {
        props.labels = props.labels.split('');
    }
    if (typeof props.sliderWidth === 'number') {
        props.sliderWidth = `${props.sliderWidth}px`;
    }

    const {
        labels,
        color,
        lowerBounds,
        upperBounds,
        steps,
        onChange,
    } = props;

    return (
        <table>
            <thead></thead>
            <tbody>
                {[0, 1, 2].map((i) => (
                    <tr key={i}>
                        <td className="td-slider-label">{labels[i]}</td>
                        <td style={{ width: props.sliderWidth }}>
                            <Slider
                                min={lowerBounds[i]}
                                max={upperBounds[i]}
                                step={(upperBounds[i] - lowerBounds[i]) / steps}
                                value={color.getv(i)}
                                valueLabelDisplay="auto"
                                onChange={(_: Event, value: number) =>
                                    onChange(color.copy().setv(i, value))
                                }
                            />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
