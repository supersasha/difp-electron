import {Slider, Button} from '@mui/material';
import * as React from 'react';
import { useState, useRef, useMemo } from 'react';
import {loadDatasheet, loadSpectralBasis} from '../data';
import {defaultTestColors, ProfileBuilder, ProfileInitialData} from '../profile-builder';
import {daylightSpectrum, logExposure, transmittance} from '../spectrum';
import { Matrix } from '../matrix';
import * as fs from 'fs';
import { Plot } from './plot';
import {linspace} from '../generators';
import {LightSourceControls} from './light-source';
import {RGBColorBox, XYZColorBox} from './colorbox';
import {mul, neg} from '../math';
import {ColorSliders} from './color-sliders';
import {srgbToXyz} from '../colors';

export interface ProfileBuilderTabProps {
}

export function ProfileBuilderTab(props: ProfileBuilderTabProps): React.ReactElement {
    const {} = props;
    const [ h0, setH0 ] = useState(-2);
    const [ paperGamma, setPaperGamma ] = useState(5.5);
    const [ devTemp, setDevTemp ] = useState(6500);
    const [ projTemp, setProjTemp ] = useState(6500);
    const [ reflTemp, setReflTemp ] = useState(6500);
    const [ srgb, setSrgb ] = useState(Matrix.fromArray([[0, 0, 0]]));
    
    const spectrumXs = [...linspace(400, 700, 31)];
    const xyz = srgbToXyz(srgb);

    const builder = useMemo(() => {
        const devLight = daylightSpectrum(devTemp);
        const projLight = daylightSpectrum(projTemp);
        const reflLight = daylightSpectrum(reflTemp);
        const profileInitData: ProfileInitialData = {
            h0,
            paperGammas: Matrix.fromArray([[ paperGamma, paperGamma, paperGamma ]]),
            filmDatasheet: loadDatasheet('./data/kodak-vision3-50d-5203-2.datasheet'),
            paperDatasheet: loadDatasheet('./data/kodak-vision-color-print-2383-2.datasheet'),
            devLight,
            projLight,
            reflLight,
            spectralBasis: loadSpectralBasis('./data/spectral-bases/opt-spectral-basis.json'),
            testCmys: defaultTestColors,
        };

        const builder = new ProfileBuilder(profileInitData);
        return builder;
    }, [h0, paperGamma, devTemp, projTemp, reflTemp]);

    const hs = Matrix.fromArray([[... linspace(builder.h0-1, 1, 100)]]);

    function ExpoDens(props: { devColor: number, corr?: Matrix }): React.ReactElement {
        const { devColor, corr = Matrix.fromArray([[0, 0, 0]]) } = props;
        const colorName = (['red', 'green', 'blue'])[devColor];
        return (
            <Plot containerStyle={{ width: '420px', height: '300px' }}
                title={`Exp. dens. of dye in ${colorName}-sens. layer measured by corr. sensor`}
                xmarks={15}
                xmarkFormat="fixed:2"
                titleFont="12px sans"
                plots={[
                    {
                        xs: hs.toFlatArray(),
                        ys: hs.map(h => builder.expos(h, devColor, 0, corr)).toFlatArray(),
                        style: 'cyan',
                    },
                    {
                        xs: hs.toFlatArray(),
                        ys: hs.map(h => builder.expos(h, devColor, 1, corr)).toFlatArray(),
                        style: 'magenta',
                    },
                    {
                        xs: hs.toFlatArray(),
                        ys: hs.map(h => builder.expos(h, devColor, 2, corr)).toFlatArray(),
                        style: '#aa0',
                    },
                ]}
            />
        );
    }
    return (
        <div style={{ display: 'flex'}}>
            <div style={{ flex: '1 1 100px' }}>
                <div>
                    <table style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th>Original</th>
                                <th>Generated</th>
                                <th>Dev-d w gammas</th>
                                <th>Developed</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ padding: '0px'}}>
                                    <RGBColorBox rgb={srgb} size="150px"/>
                                </td>
                                <td style={{ padding: '0px'}}>
                                    <XYZColorBox xyz={
                                        /* Here we should use mtx for the light used in reflGen */
                                        builder.reflMtx.mmul(builder.reflGen.reflOf(xyz).transpose()).transpose()
                                    } size="150px"/>
                                </td>
                                <td style={{ padding: '0px'}}>
                                    <XYZColorBox xyz={
                                        builder.developWithGammas(xyz)
                                    } size="150px"/>
                                </td>
                                <td style={{ padding: '0px'}}>
                                    <XYZColorBox xyz={
                                        builder.develop(
                                            xyz,
                                            builder.correction().map(neg)
                                        )
                                    } size="150px"/>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div>Normalize film dyes error: {builder.normalizeFilmDyesError}</div>
                <div>Normalize paper dyes error: {builder.normalizePaperDyesError}</div>
                <div>Find gammas error: {builder.findGammasError}</div>
                <div>Find dye quantities error: {builder.findDyeQuantitiesError.show(10)}</div>
                <div>{ (()=>{
                    const qs = Matrix.fill([1, 3], 1);
                    const trans = transmittance(builder.couplers, qs);
                    const sp = trans.elementWise(mul, builder.projLight);
                    const h1 = logExposure(builder.paperSense, sp);
                    return h1.show(4);
                })() }</div>
                <div>Chi film at 0: {builder.chiFilm[0].at(0)}, {builder.chiFilm[1].at(0)}, {builder.chiFilm[2].at(0)}</div>
                <div>Chi paper at 0: {builder.chiPaper[0].at(0)}, {builder.chiPaper[1].at(0)}, {builder.chiPaper[2].at(0)}</div>
                <div style={{ display: 'flex' }}>
                    <Plot containerStyle={{ width: '500px', height: '300px' }}
                        title="Couplers"
                        xmarks={31}
                        xmarkFormat="fixed:0"
                        plots={[
                            {
                                xs: spectrumXs,
                                ys: builder.couplers.row(0).toFlatArray(),
                                style: 'red',
                        },
                        {
                            xs: spectrumXs,
                            ys: builder.couplers.row(1).toFlatArray(),
                            style: 'green',
                        },
                        {
                            xs: spectrumXs,
                            ys: builder.couplers.row(2).toFlatArray(),
                            style: 'blue',
                        },
                        {
                            xs: spectrumXs,
                            ys: builder.couplers.row(0).add(builder.couplers.row(1).add(builder.couplers.row(2))).toFlatArray(),
                            style: 'black',
                        },
                        ]}
                    />
                    <XYZColorBox size={300} xyz={
                        builder.dyesToXyz(builder.couplers, Matrix.fromArray([[1, 1, 1]]), builder.reflMtx)
                    }/>
                </div>
                <div>Corr: {builder.correction().show(4)}</div>
                <div style={{ display: 'flex' }}>
                    <ExpoDens devColor={0} corr={Matrix.fromArray([[0.33, 0.49, 0.49]])}/>
                    <ExpoDens devColor={1} corr={Matrix.fromArray([[0.33, 0.49, 0.49]])}/>
                    <ExpoDens devColor={2} corr={Matrix.fromArray([[0.33, 0.49, 0.49]])}/>
                </div>
            </div>
            <div style={{ flex: '0 0 500px', padding: '30px' }}>
                <ColorSliders color={srgb} onChange={setSrgb}/>
                <div>H0:</div>
                <Slider
                    min={-5}
                    max={-1}
                    step={0.1}
                    value={h0}
                    onChange={ (_e, v) => {setH0(v as number)} }
                    valueLabelDisplay="on"
                />
                <div>Paper gamma:</div>
                <Slider
                    min={1}
                    max={10}
                    step={0.1}
                    value={paperGamma}
                    onChange={ (_e, v) => {setPaperGamma(v as number)} }
                    valueLabelDisplay="on"
                />
                <LightSourceControls daylightTemp={devTemp}
                    onChange={setDevTemp} caption="Dev temp"/>
                <LightSourceControls daylightTemp={projTemp}
                    onChange={setProjTemp} caption="Proj temp"/>
                <LightSourceControls daylightTemp={reflTemp}
                    onChange={setReflTemp} caption="Refl temp"/>
                <Button onClick={() => {
                    const json = JSON.stringify(builder.profile(), null, 4);
                    fs.writeFileSync('./data/profiles/profile.json', json);
                }}>Save profile</Button>
            </div>
        </div>
    );
}
