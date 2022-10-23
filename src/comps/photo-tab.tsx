import * as React from 'react';
import { Photo } from './photo';
import { State } from '../store';
import { Slider, Checkbox, FormGroup, FormControlLabel } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';

export function PhotoTab(props): React.ReactElement {
    const { imagePath } = props;
    const dispatch = useDispatch();
    const userOptions = useSelector((state: State) => state.userOptions);

    return (
        <>
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                <Photo path={imagePath} options={userOptions}/>
                <div style={{ padding: '30px', flex: '0 0 500px'}}>
                    <div>
                        <FormGroup>
                            <FormControlLabel label="Raw?"
                                control={<Checkbox
                                    checked={userOptions.raw}
                                    onChange={(_e: any, checked: boolean) => {
                                        dispatch({
                                            type: 'main/setUserOptions',
                                            payload: { raw: checked }
                                        });
                                    }}
                                />}
                            />
                        </FormGroup>
                        <div>Red &#x2194; Cyan</div>
                        <Slider
                            min={0}
                            max={1.3}
                            step={0.001}
                            value={userOptions.colorCorr[0]}
                            valueLabelDisplay="auto"
                            onChange={(e: Event, value: number) => {
                                dispatch({
                                    type: 'main/setColor',
                                    payload: { red: value },
                                })
                            }}
                        />
                        <div>Green &#x2194; Magenta</div>
                        <Slider
                            min={0}
                            max={1.3}
                            step={0.001}
                            value={userOptions.colorCorr[1]}
                            valueLabelDisplay="auto"
                            onChange={(e: Event, value: number) => {
                                dispatch({
                                    type: 'main/setColor',
                                    payload: { green: value },
                                })
                            }}
                        />
                        <div>Blue &#x2194; Yellow</div>
                        <Slider
                            min={0}
                            max={1.3}
                            step={0.001}
                            value={userOptions.colorCorr[2]}
                            valueLabelDisplay="auto"
                            onChange={(e: Event, value: number) => {
                                dispatch({
                                    type: 'main/setColor',
                                    payload: { blue: value },
                                })
                            }}
                        />
                        <div>Film Exposure</div>
                        <Slider
                            min={-5}
                            max={5}
                            step={0.001}
                            value={userOptions.filmExposure}
                            valueLabelDisplay="auto"
                            onChange={(e: Event, value: number) => {
                                dispatch({
                                    type: 'main/setUserOptions',
                                    payload: { filmExposure: value },
                                })
                            }}
                        />
                        <div>Paper Exposure</div>
                        <Slider
                            min={-2.4}
                            max={1.4}
                            step={0.001}
                            value={userOptions.paperExposure}
                            valueLabelDisplay="auto"
                            onChange={(e: Event, value: number) => {
                                dispatch({
                                    type: 'main/setUserOptions',
                                    payload: { paperExposure: value },
                                })
                            }}
                        />
                        <div>Paper Contrast</div>
                        <Slider
                            min={0.1}
                            max={5}
                            step={0.1}
                            value={userOptions.paperContrast}
                            valueLabelDisplay="auto"
                            onChange={(e: Event, value: number) => {
                                dispatch({
                                    type: 'main/setUserOptions',
                                    payload: { paperContrast: value },
                                })
                            }}
                        />
                        <div>Smoothness</div>
                        <Slider
                            min={0.01}
                            max={0.40}
                            step={0.01}
                            value={userOptions.curveSmoo}
                            valueLabelDisplay="auto"
                            onChange={(e: Event, value: number) => {
                                dispatch({
                                    type: 'main/setUserOptions',
                                    payload: { curveSmoo: value },
                                })
                            }}
                        />
                        <div>Mask Blur</div>
                        <Slider
                            min={0}
                            max={10}
                            step={0.01}
                            value={userOptions.maskBlur}
                            valueLabelDisplay="auto"
                            onChange={(e: Event, value: number) => {
                                dispatch({
                                    type: 'main/setUserOptions',
                                    payload: { maskBlur: value },
                                })
                            }}
                        />
                        <div>Mask Threshold</div>
                        <Slider
                            min={0}
                            max={5}
                            step={0.01}
                            value={userOptions.maskThreshold}
                            valueLabelDisplay="auto"
                            onChange={(e: Event, value: number) => {
                                dispatch({
                                    type: 'main/setUserOptions',
                                    payload: { maskThreshold: value },
                                })
                            }}
                        />
                        <div>Mask Density</div>
                        <Slider
                            min={0}
                            max={0.1}
                            step={0.001}
                            value={userOptions.maskDensity}
                            valueLabelDisplay="auto"
                            onChange={(e: Event, value: number) => {
                                dispatch({
                                    type: 'main/setUserOptions',
                                    payload: { maskDensity: value },
                                })
                            }}
                        />
                        <div>Noise Sigma</div>
                        <Slider
                            min={0}
                            max={0.02}
                            step={0.0001}
                            value={userOptions.noiseSigma}
                            valueLabelDisplay="auto"
                            onChange={(e: Event, value: number) => {
                                dispatch({
                                    type: 'main/setUserOptions',
                                    payload: { noiseSigma: value },
                                })
                            }}
                        />
                        <div>Noise Blur</div>
                        <Slider
                            min={0}
                            max={0.3}
                            step={0.001}
                            value={userOptions.noiseBlur}
                            valueLabelDisplay="auto"
                            onChange={(e: Event, value: number) => {
                                dispatch({
                                    type: 'main/setUserOptions',
                                    payload: { noiseBlur: value },
                                })
                            }}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
