import { Button, Switch, Slider, Tabs } from 'antd';
import React, { useState } from 'react';
import 'antd/dist/antd.css';

import { xyzToSrgb, srgbToXyz, Developer } from './profiler';
import { Matrix } from './matrix';
import { linspace, Spectrum31Plot } from './plot';
import { fill } from './generators';

export function CouplersTab(props) {
    const [coupler, setCoupler] = useState([...fill(31, 0)]);
    const [hCyan, setHCyan] = useState(0);
    const [hMagenta, setHMagenta] = useState(0);
    const [hYellow, setHYellow] = useState(0);
    
    const dev = new Developer();
    dev.makeCouplersFromMatrix(Matrix.fromArray([coupler, coupler, coupler]));
    dev.setup();
    
    const h = Matrix.fromArray([[hCyan, hMagenta, hYellow]]);
    const [devFilmDyes, devFilmCouplers] = dev.developFilmSep(h);
    const devFilm = devFilmDyes.add(devFilmCouplers);

    return (
        <>
            <div style={{ display: 'flex', width: '100%', height: '100px' }}>
                {
                    [...linspace(0, 30, 31)].map(i =>
                        (
                            <div key={i}>
                                <Slider
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={coupler[i]}
                                    onChange={v => {
                                        const newCoupler = [...coupler];
                                        newCoupler[i] = v;
                                        setCoupler(newCoupler);
                                    }}
                                    vertical
                                />
                                {i*10 + 400}
                            </div>
                        )
                    )
                }
            </div>
            <div style={{ display: 'flex', marginTop: '30px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: '40px' }}>
                    <div style={{ width: '200px' }}>
                        <div>H_cyan</div>
                        <Slider
                            min={-5}
                            max={0}
                            step={0.01}
                            value={hCyan}
                            onChange={setHCyan}
                        />
                    </div>
                    <div style={{ width: '200px' }}>
                        <div>H_magenta</div>
                        <Slider
                            min={-5}
                            max={0}
                            step={0.01}
                            value={hMagenta}
                            onChange={setHMagenta}
                        />
                    </div>
                    <div style={{ width: '200px' }}>
                        <div>H_yellow</div>
                        <Slider
                            min={-5}
                            max={0}
                            step={0.01}
                            value={hYellow}
                            onChange={setHYellow}
                        />
                    </div>
                </div>
                <div style={{ display: 'flex' }}>
                    <Spectrum31Plot containerStyle={{ width: '800px', height: '600px' }}
                        yrange={[-0.1, 4]}
                        data={[
                            {
                                ys: devFilmDyes.row(0).toFlatArray(),
                                style: 'cyan',
                            },
                            {
                                ys: devFilmCouplers.row(0).toFlatArray(),
                                style: 'red',
                            },
                            {
                                ys: devFilm.row(0).toFlatArray(),
                                style: 'black',
                            },
                        ]}
                    />
                </div>
            </div>
        </>
    );
}
