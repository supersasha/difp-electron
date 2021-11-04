import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Slider } from 'antd';
import { Photo } from './photo';
const { dialog, BrowserWindow } = require('electron').remote;
import { State } from './store';

import 'antd/dist/antd.css';

function toggleDevTools() {
    try {
        require('electron').remote.getCurrentWindow().toggleDevTools();
    } catch(e) {
        //alert(e);
    }
}

export function PhotoTab(): React.ReactElement {
    const dispatch = useDispatch();
    const imagePath = useSelector((state: State) => state.imagePath);
    const userOptions = useSelector((state: State) => state.userOptions);

    return (
        <>
            <div style={{display: 'flex', width: '100%'}}>
                <Photo />
                <div style={{backgroundColor: '#eee', padding: '20px'}}>
                    <div>
                        <div>{imagePath || 'No image loaded'}</div>
                        <Button onClick={toggleDevTools}>Toggle dev tools</Button>
                        <Button onClick={() => {
                            const res = dialog.showOpenDialogSync(BrowserWindow.getFocusedWindow(), {
                                defaultPath: imagePath,
                                properties: ['openFile'],
                            });
                            if (!res) {
                                return;
                            }
                            const [path] = res;
                            dispatch({
                                type: 'main/setImagePath',
                                payload: path,
                            });
                        }}>Load image</Button>
                    </div>
                    <div>
                        <div>Red &#x2194; Cyan</div>
                        <Slider
                            min={0}
                            max={3}
                            step={0.001}
                            value={userOptions.colorCorr[0]}
                            onChange={(value: number) => {
                                dispatch({
                                    type: 'main/setColor',
                                    payload: { red: value },
                                })
                            }}
                        />
                        <div>Green &#x2194; Magenta</div>
                        <Slider
                            min={0}
                            max={3}
                            step={0.001}
                            value={userOptions.colorCorr[1]}
                            onChange={(value: number) => {
                                dispatch({
                                    type: 'main/setColor',
                                    payload: { green: value },
                                })
                            }}
                        />
                        <div>Blue &#x2194; Yellow</div>
                        <Slider
                            min={0}
                            max={3}
                            step={0.001}
                            value={userOptions.colorCorr[2]}
                            onChange={(value: number) => {
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
                            step={0.1}
                            value={userOptions.filmExposure}
                            onChange={(value: number) => {
                                dispatch({
                                    type: 'main/setUserOptions',
                                    payload: { filmExposure: value },
                                })
                            }}
                        />
                        <div>Paper Exposure</div>
                        <Slider
                            min={-5}
                            max={5}
                            step={0.001}
                            value={userOptions.paperExposure}
                            onChange={(value: number) => {
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
                            onChange={(value: number) => {
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
                            onChange={(value: number) => {
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
                            onChange={(value: number) => {
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
                            onChange={(value: number) => {
                                dispatch({
                                    type: 'main/setUserOptions',
                                    payload: { maskThreshold: value },
                                })
                            }}
                        />
                        <div>Mask Density</div>
                        <Slider
                            min={0}
                            max={3}
                            step={0.001}
                            value={userOptions.maskDensity}
                            onChange={(value: number) => {
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
                            onChange={(value: number) => {
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
                            onChange={(value: number) => {
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
