import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Switch, Slider } from 'antd';
import { Photo } from './photo';
import { Plot } from './plot';
import 'antd/dist/antd.css';

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
    const blurRadius = useSelector(state => state.blurRadius);
    const maskThreshold = useSelector(state => state.maskThreshold);
    const maskDensity = useSelector(state => state.maskDensity);

    return (
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
                            type: 'main/loadImage',
                            payload: path, //'/home/supersasha/Downloads/P7250010.ORF'
                        });
                    }}>Load image</Button>
                </div>
                <div>
                    <div>Red &#x2194; Cyan</div>
                    <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={userOptions.color_corr[0]}
                        onChange={value => {
                            dispatch({
                                type: 'main/setColor',
                                payload: [0, value],
                            })
                        }}
                    />
                    <div>Green &#x2194; Magenta</div>
                    <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={userOptions.color_corr[1]}
                        onChange={value => {
                            dispatch({
                                type: 'main/setColor',
                                payload: [1, value],
                            })
                        }}
                    />
                    <div>Blue &#x2194; Yellow</div>
                    <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={userOptions.color_corr[2]}
                        onChange={value => {
                            dispatch({
                                type: 'main/setColor',
                                payload: [2, value],
                            })
                        }}
                    />
                    <div>Film Exposure</div>
                    <Slider
                        min={-5}
                        max={5}
                        step={0.1}
                        value={userOptions.film_exposure}
                        onChange={value => {
                            dispatch({
                                type: 'main/setFilmExposure',
                                payload: value,
                            })
                        }}
                    />
                    <div>Paper Contrast</div>
                    <Slider
                        min={0.1}
                        max={4}
                        step={0.1}
                        value={userOptions.paper_contrast}
                        onChange={value => {
                            dispatch({
                                type: 'main/setPaperContrast',
                                payload: value,
                            })
                        }}
                    />
                    <div>Smoothness</div>
                    <Slider
                        min={0.01}
                        max={0.40}
                        step={0.01}
                        value={userOptions.curve_smoo}
                        onChange={value => {
                            dispatch({
                                type: 'main/setSmoothness',
                                payload: value,
                            })
                        }}
                    />
                    <div>Mask Blur</div>
                    <Slider
                        min={0}
                        max={10}
                        step={0.01}
                        value={blurRadius}
                        onChange={value => {
                            dispatch({
                                type: 'main/setBlurRadius',
                                payload: value,
                            })
                        }}
                    />
                    <div>Mask Threshold</div>
                    <Slider
                        min={0}
                        max={5}
                        step={0.1}
                        value={maskThreshold}
                        onChange={value => {
                            dispatch({
                                type: 'main/setMaskThreshold',
                                payload: value,
                            })
                        }}
                    />
                    <div>Mask Density</div>
                    <Slider
                        min={0}
                        max={3}
                        step={0.01}
                        value={maskDensity}
                        onChange={value => {
                            dispatch({
                                type: 'main/setMaskDensity',
                                payload: value,
                            })
                        }}
                    />
                </div>
                <Plot />
            </div>
        </div>
    );
}
export default App;
