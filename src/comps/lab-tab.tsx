import * as React from 'react';
import { useState } from 'react';
import {
    daylightSpectrum,
    logExposure,
    transmittance,
    transmittanceToXyzMtx,
} from '../spectrum';
import { linspace } from '../generators';
import { Matrix } from '../matrix';
import { Plot } from './plot';
import { XYZColorBox } from './colorbox';
import { xyzToSrgb } from '../colors';

import * as fs from 'fs';
//import { Radio } from 'antd';
import { Slider, Button, Radio, RadioGroup } from '@blueprintjs/core';
//import 'antd/dist/antd.css';

import { Lab } from '../lab';
import { ColorSliders } from './color-sliders';
import { MatrixDisp } from './mtx-disp';

function BlockRow(props): React.ReactElement {
    return (
        <div style={{ display: 'flex' }}>
            { props.children }
        </div>
    );
}

interface CMYSlidersProps {
    cmy: Matrix;
    setCmy: (cmy: Matrix) => void;
}

function CMYSliders(props: CMYSlidersProps): React.ReactElement {
    return (
        <div style={{width: '150px'}}>
            <div>
                C
                <Slider
                    min={0}
                    max={4}
                    stepSize={0.01}
                    value={props.cmy.getv(0)}
                    onChange={(v: number) => props.setCmy(props.cmy.copy().setv(0, v))}
                />
            </div>
            <div>
                M
                <Slider
                    min={0}
                    max={4}
                    stepSize={0.01}
                    value={props.cmy.getv(1)}
                    onChange={(v: number) => props.setCmy(props.cmy.copy().setv(1, v))}
                />
            </div>
            <div>
                Y
                <Slider
                    min={0}
                    max={4}
                    stepSize={0.01}
                    value={props.cmy.getv(2)}
                    onChange={(v: number) => props.setCmy(props.cmy.copy().setv(2, v))}
                />
            </div>
        </div>
    );
}

export function LabTab(props) {
    const [ logexp, setLogexp ] = useState(0);
    const [ devColor, setDevColor ] = useState(0);
    const [ couplerQs, setCouplerQs ] = useState(Matrix.fromArray([[0, 0, 0]]));
    const [ cmy, setCmy ] = useState(Matrix.fromArray([[0, 0, 0]]));
    const [ corr, setCorr ] = useState(Matrix.fromArray([[0, 0, 0]]));
    
    const lab = Lab.instance('lab-tab');
    const h0 = lab.h0;

    const spectrumXs = [...linspace(400, 700, 31)];

    const couplerStyles = [ 'red', 'green', 'blue' ];

    function expos(h, layer, sensor) {
        return lab.filmTransExpoDensityPaper(
            h, layer, sensor, lab.chiFilm[layer], lab.qs.row(layer)
        );
    }

    const hs = Matrix.fromArray([[...linspace(h0-1, 1, 100)]]);

    const light = daylightSpectrum(6500);
    const trmx = transmittanceToXyzMtx(light);
    const trans = transmittance(lab.couplers, Matrix.fromArray([[1, 1, 1]]));
    const sp = trans.elementWise((e1, e2) => e1 * e2, lab.projLight);
    const Hc = logExposure(lab.paperSense, sp);
    console.log('Hc:', Hc.show());
    const xyz = trmx.mmul(trans.transpose());

    const xyzOfCmy = lab.dyesToXyzD55(lab.paperDyes, cmy);
    const refl = lab.reflGen.reflOf(xyzOfCmy);
    const mtxD55Xyz = transmittanceToXyzMtx(daylightSpectrum(5500));
    const mtxD65Xyz = transmittanceToXyzMtx(daylightSpectrum(6500));
    const xyzOfRefl = mtxD55Xyz.mmul(refl.transpose()).transpose();
    const xyzOfReflD65 = mtxD65Xyz.mmul(refl.transpose()).transpose();
    const spectrum = lab.reflGen.spectrumOf(xyzOfCmy);
    const Hcmy = logExposure(lab.filmSense, spectrum);

    const initXyz = xyzOfCmy;
    const devXyz = lab.develop(initXyz, corr);

    return (
        <>
            <BlockRow>
                <MatrixDisp mtx={lab.filmGammas} precision={4}/>
                <div>
                    <BlockRow>
                        {
                            lab.inColors.map((c, i) => (
                                <XYZColorBox key={i} size={50} xyz={c} />
                            ))
                        }
                    </BlockRow>
                    <BlockRow>
                        {
                            lab.outColors.map((c, i) => (
                                <XYZColorBox key={i} size={50} xyz={c} />
                            ))
                        }
                    </BlockRow>
                </div>
            </BlockRow>
            <Button onClick={() => {
                const data = JSON.stringify(lab.profile(), null, 4);
                fs.writeFileSync('./data/new-profile.json', data);
            }}>
                Save profile
            </Button>
            <BlockRow>
                <BlockRow>
                    {/*<CMYSliders cmy={cmy} setCmy={setCmy} />*/}
                    <ColorSliders
                        color={cmy}
                        onChange={setCmy}
                        upperBounds={[4, 4, 4]}
                        labels="CMY"
                    />
                    <div>
                        <XYZColorBox size={150} xyz={xyzOfCmy} />
                        <div>{xyzOfCmy.show()}</div>
                        <div>{xyzToSrgb(xyzOfCmy).show()}</div>
                        <div>{Hcmy.show(4)}</div>
                    </div>
                    <div>
                        <XYZColorBox size={150} xyz={xyzOfRefl} />
                        <div>{xyzOfRefl.show()}</div>
                        <div>{xyzToSrgb(xyzOfRefl).show()}</div>
                    </div>
                    <div>
                        <XYZColorBox size={150} xyz={xyzOfReflD65} />
                        <div>{xyzOfReflD65.show()}</div>
                        <div>{xyzToSrgb(xyzOfReflD65).show()}</div>
                    </div>
                </BlockRow>
                <BlockRow>
                    <div style={{width: '20px'}} />
                    <div style={{width: '150px'}}>
                        <div>
                            corr_R
                            <Slider
                                min={-5}
                                max={5}
                                stepSize={0.01}
                                value={corr.getv(0)}
                                onChange={v => setCorr(corr.copy().setv(0, v))}
                            />
                        </div>
                        <div>
                            corr_G
                            <Slider
                                min={-5}
                                max={5}
                                stepSize={0.01}
                                value={corr.getv(1)}
                                onChange={v => setCorr(corr.copy().setv(1, v))}
                            />
                        </div>
                        <div>
                            corr_B
                            <Slider
                                min={-5}
                                max={5}
                                stepSize={0.01}
                                value={corr.getv(2)}
                                onChange={v => setCorr(corr.copy().setv(2, v))}
                            />
                        </div>
                    </div>
                    <XYZColorBox size={150} xyz={initXyz} />
                    <XYZColorBox size={150} xyz={devXyz} />
                </BlockRow>
            </BlockRow>
            <div style={{ display: 'flex' }}>
                <Plot containerStyle={{ width: '800px', height: '500px' }}
                    title="Couplers"
                    xmarks={31}
                    xmarkFormat="fixed:0"
                    plots={[
                        {
                            xs: spectrumXs,
                            ys: lab.couplers.row(0).toFlatArray(),
                            style: 'red',
                        },
                        {
                            xs: spectrumXs,
                            ys: lab.couplers.row(1).toFlatArray(),
                            style: 'green',
                        },
                        {
                            xs: spectrumXs,
                            ys: lab.couplers.row(2).toFlatArray(),
                            style: 'blue',
                        },
                        {
                            xs: spectrumXs,
                            ys: lab.couplers.row(0).add(lab.couplers.row(1).add(lab.couplers.row(2))).toFlatArray(),
                            style: 'black',
                        },
                    ]}
                />
                <XYZColorBox size={200} xyz={xyz} />
            </div>
            <div style={{ display: 'flex' }}>
                <div>
                    <div style={{ display: 'flex', flexDirection: 'column', height: '300px' }}>
                        <div>H</div>
                        <Slider
                            min={-5}
                            max={0}
                            stepSize={0.01}
                            value={logexp}
                            onChange={setLogexp}
                            vertical
                        />
                        <div>
                            {/*style={{ display: 'flex', flexDirection: 'column' }}*/}
                            <RadioGroup selectedValue={devColor} onChange={(e) => {
                                setDevColor(parseInt(e.currentTarget.value))
                            }}>
                                <Radio label="R" value={0} style={{ color: 'red' }}/>
                                <Radio label="G" value={1} style={{ color: 'green' }}/>
                                <Radio label="B" value={2} style={{ color: 'blue' }}/>
                            </RadioGroup>
                        </div>
                    </div>
                </div>
                <Plot containerStyle={{ width: '700px', height: '500px' }}
                    title="Exposure densities of dyes measured by corresponded sensor"
                    xmarks={15}
                    xmarkFormat="fixed:2"
                    //yrange={[-4, -1.5]}
                    plots={[
                        {
                            xs: hs.toFlatArray(),
                            ys: hs.map(h => expos(h, devColor, 0)).toFlatArray(),
                            style: couplerStyles[0],
                        },
                        {
                            xs: hs.toFlatArray(),
                            ys: hs.map(h => expos(h, devColor, 1)).toFlatArray(),
                            style: couplerStyles[1],
                        },
                        {
                            xs: hs.toFlatArray(),
                            ys: hs.map(h => expos(h, devColor, 2)).toFlatArray(),
                            style: couplerStyles[2],
                        },
                    ]}
                />
                <div>
                    <div>
                        <div>R:{((expos(h0-1, devColor, 0)-expos(1, devColor, 0))/-h0).toFixed(4)}</div>
                        <div>G:{((expos(h0-1, devColor, 1)-expos(1, devColor, 1))/-h0).toFixed(4)}</div>
                        <div>B:{((expos(h0-1, devColor, 2)-expos(1, devColor, 2))/-h0).toFixed(4)}</div>
                    </div>
                    <div style={{ display: 'flex'}}>
                        <div style={{ height: '150px'}}>
                            <div>cplr R</div>
                            <Slider
                                min={0}
                                max={5}
                                stepSize={0.01}
                                value={couplerQs.getv(0)}
                                onChange={v => setCouplerQs(Matrix.fromArray([[v, couplerQs.getv(1), couplerQs.getv(2)]]))}
                                vertical
                            />
                        </div>
                        <div>
                            <div>cplr G</div>
                            <Slider
                                min={0}
                                max={5}
                                stepSize={0.01}
                                value={couplerQs.getv(1)}
                                onChange={v => setCouplerQs(Matrix.fromArray([[couplerQs.getv(0), v, couplerQs.getv(2)]]))}
                                vertical
                            />
                        </div>
                        <div>
                            <div>cplr B</div>
                            <Slider
                                min={0}
                                max={5}
                                stepSize={0.01}
                                value={couplerQs.getv(2)}
                                onChange={v => setCouplerQs(Matrix.fromArray([[couplerQs.getv(0), couplerQs.getv(1), v]]))}
                                vertical
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
//style={{ alignSelf: 'center' }}>
