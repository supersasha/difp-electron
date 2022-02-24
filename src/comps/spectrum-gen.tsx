import * as React from 'react';
import { Matrix } from '../matrix';
import { ReflGen } from '../spectrum';
import { Spectrum31Plot } from './plot';
import { reflectanceUnderLightSource } from '../spectrum';
import { XYZColorBox } from "./colorbox";

interface SpectrumGeneratorProps {
    xyz: Matrix;
    reflGen: ReflGen;
    title?: string;
}

function outOfRange(refl: Matrix): number {
    let err = 0;
    for (let i = 0; i < 31; i++) {
        const v = refl.getv(i);
        if (v > 1) {
            err += (v-1) * (v-1);
        } else if (v < 0) {
            err += v*v;
        }
    }
    return Math.sqrt(err);
}

export function SpectrumGenerator(props: SpectrumGeneratorProps): React.ReactElement {
    const { xyz, reflGen, title } = props;
    const spectrum = reflGen.spectrumOf(xyz);
    const refl = reflGen.reflOf(xyz);
    const reflUnclipped = reflGen.reflOfUnclipped(xyz);
    const xyzOfRefl = reflectanceUnderLightSource(refl, reflGen.getLight());

    return (
        <div className="lab2cont">
            <div className="lab2item">
                <Spectrum31Plot
                    data={[{
                        ys: reflUnclipped.mul(100).toFlatArray(),
                        style: 'red',
                    }, {
                        ys: refl.mul(100).toFlatArray(),
                        style: 'cyan',
                    }, {
                        ys: spectrum.toFlatArray(),
                        style: 'blue',
                    }]}
                    containerStyle={{
                        width: '600px',
                        height: '400px'
                    }}
                    title={ `${title ? (title + ': ') : ''}reflUC*100 (red), refl (cyan), spectrum (blue)` }
                    yrange={[ -30, 130 ]}
                    ymarks={17}
                />
            </div>
            <div className="lab2item">
                <div>
                    <XYZColorBox xyz={xyz} size="100px" />
                    <XYZColorBox xyz={xyzOfRefl} size="100px" />
                    <p>Err: {outOfRange(reflUnclipped)}</p>
                </div>
            </div>
        </div>
    );
}
