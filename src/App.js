import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Switch, Slider, Tabs } from 'antd';
import { Photo } from './photo';
import { Plot } from './plot';
import 'antd/dist/antd.css';

//import { profile } from './profiler';
//profile();

const { TabPane } = Tabs;
const { dialog, BrowserWindow } = require('electron').remote;

function toggleDevTools() {
    try {
        require('electron').remote.getCurrentWindow().toggleDevTools();
    } catch(e) {
        //alert(e);
    }
}

function App() {
    const dispatch = useDispatch();
    const imagePath = useSelector(state => state.imagePath);
    const userOptions = useSelector(state => state.userOptions);

    return (
        <Tabs tabPosition="left" type="card">
            <TabPane tab="main" key="1">
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
                                max={1}
                                step={0.01}
                                value={userOptions.colorCorr[0]}
                                onChange={value => {
                                    dispatch({
                                        type: 'main/setColor',
                                        payload: { red: value },
                                    })
                                }}
                            />
                            <div>Green &#x2194; Magenta</div>
                            <Slider
                                min={0}
                                max={1}
                                step={0.01}
                                value={userOptions.colorCorr[1]}
                                onChange={value => {
                                    dispatch({
                                        type: 'main/setColor',
                                        payload: { green: value },
                                    })
                                }}
                            />
                            <div>Blue &#x2194; Yellow</div>
                            <Slider
                                min={0}
                                max={1}
                                step={0.01}
                                value={userOptions.colorCorr[2]}
                                onChange={value => {
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
                                onChange={value => {
                                    dispatch({
                                        type: 'main/setUserOptions',
                                        payload: { filmExposure: value },
                                    })
                                }}
                            />
                            <div>Paper Contrast</div>
                            <Slider
                                min={0.1}
                                max={4}
                                step={0.1}
                                value={userOptions.paperContrast}
                                onChange={value => {
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
                                onChange={value => {
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
                                onChange={value => {
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
                                onChange={value => {
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
                                step={0.01}
                                value={userOptions.maskDensity}
                                onChange={value => {
                                    dispatch({
                                        type: 'main/setUserOptions',
                                        payload: { maskDensity: value },
                                    })
                                }}
                            />
                            <div>Noise Sigma</div>
                            <Slider
                                min={0}
                                max={0.2}
                                step={0.001}
                                value={userOptions.noiseSigma}
                                onChange={value => {
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
                                onChange={value => {
                                    dispatch({
                                        type: 'main/setUserOptions',
                                        payload: { noiseBlur: value },
                                    })
                                }}
                            />
                        </div>
                    </div>
                </div>
            </TabPane>
            <TabPane tab="graphs">
                <Plot containerStyle={{ width: '100%', height: '400px' }}/>
            </TabPane>
        </Tabs>
    );
}
export default App;
