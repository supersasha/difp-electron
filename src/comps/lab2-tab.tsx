import * as React from 'react';
import { useState, useRef, useMemo } from 'react';
import { Matrix } from '../matrix';
//import { Stack, Box } from '@mui/material';

import { ColorSliders } from './color-sliders';
import { RGBColorBox } from './colorbox';
import { MatrixDisp } from './mtx-disp';
import { srgbToXyz, xyzToSrgb } from '../colors';
import { Lab } from '../lab';
import { Spectrum31Plot } from './plot';

export function Lab2Tab(props): React.ReactElement {
    const [ srgb, setSrgb ] = useState(Matrix.fromArray([[0, 0, 0]]));
    const lab = Lab.instance('lab2-tab');
    const xyz = srgbToXyz(srgb);
    const corr = Matrix.fromArray([[0.26, 0.03, 0.16]]);
    const xyz1 = lab.develop(xyz, corr);
    const srgb1 = xyzToSrgb(xyz1);
    return (
        <div>
            <div className="lab2cont">
                <div className="lab2item">
                    <h3>Paper gammas</h3>
                    <MatrixDisp mtx={lab.paperGammas}/>
                </div>
                <div className="lab2item">
                    <h3>Film gammas</h3>
                    <MatrixDisp mtx={lab.filmGammas}/>
                </div>
                <div className="lab2item" style={{paddingTop: '15px'}}>
                    <ColorSliders
                        labels={['sRed', 'sGreen', 'sBlue']}
                        color={srgb}
                        onChange={setSrgb}
                    />
                </div>
                <div className="lab2item">
                    <RGBColorBox rgb={srgb} size='150px'/>
                </div>
                <div className="lab2item">
                    <h3>sRGB</h3>
                    <MatrixDisp mtx={srgb}/>
                </div>
                <div className="lab2item">
                    <h3>XYZ</h3>
                    <MatrixDisp mtx={xyz}/>
                </div>
                <div className="lab2item">
                    <h3>XYZ1</h3>
                    <MatrixDisp mtx={xyz1}/>
                </div>
                <div className="lab2item">
                    <h3>sRGB 1</h3>
                    <MatrixDisp mtx={srgb1}/>
                </div>
                <div className="lab2item">
                    <RGBColorBox rgb={srgb1} size='150px'/>
                </div>
            </div>
            <div className="lab2cont">
                <div className="lab2item">
                    <Spectrum31Plot
                        data={[{
                            ys: lab.debugSpectrum.toFlatArray(),
                            style: 'blue' 
                        },{
                            ys: lab.debugRefl.mul(100).toFlatArray(),
                            style: 'red'
                        }]}
                        containerStyle={{
                            width: '600px',
                            height: '400px'
                        }}
                        title="Generated spectrum (blue) and reflection (red)"
                        yrange={[-10, 110]}
                        ymarks={13}
                    />
                </div>
                <div className="lab2item">
                    <Spectrum31Plot
                        data={[{
                            ys: lab.debugFilmDyes.row(0)
                                    .add(lab.debugFilmDyes.row(1))
                                    .add(lab.debugFilmDyes.row(2))
                                    .toFlatArray(),
                            style: 'red' 
                        },{
                            ys: lab.debugFilmCouplers.row(0)
                                    .add(lab.debugFilmCouplers.row(1))
                                    .add(lab.debugFilmCouplers.row(2))
                                    .toFlatArray(),
                            style: 'cyan'
                        },{
                            ys: lab.debugFilmDyes.row(0)
                                    .add(lab.debugFilmDyes.row(1))
                                    .add(lab.debugFilmDyes.row(2))
                                    .add(lab.debugFilmCouplers.row(0))
                                    .add(lab.debugFilmCouplers.row(1))
                                    .add(lab.debugFilmCouplers.row(2))
                                    .toFlatArray(),
                            style: 'black'
                        }]}
                        containerStyle={{
                            width: '600px',
                            height: '400px'
                        }}
                        title="Developed film dyes (red), couplers (cyan) and their sum (black)"
                        yrange={[0, 1.0]}
                    />
                </div>
                <div className="lab2item">
                    <Spectrum31Plot
                        data={[{
                            ys: lab.debugPaperDyes.row(0).toFlatArray(),
                            style: 'cyan'
                        },{
                            ys: lab.debugPaperDyes.row(1).toFlatArray(),
                            style: 'magenta'
                        },{
                            ys: lab.debugPaperDyes.row(2).toFlatArray(),
                            style: 'yellow'
                        },{
                            ys: lab.debugPaperDyes.row(0)
                                    .add(lab.debugPaperDyes.row(1))
                                    .add(lab.debugPaperDyes.row(2))
                                    .toFlatArray(),
                            style: 'black'
                        }]}
                        containerStyle={{
                            width: '600px',
                            height: '400px'
                        }}
                        title="Developed paper dyes"
                        yrange={[0, 3.0]}
                    />
                </div>
            </div>
        </div>
    );
}
