import * as React from 'react';
import { useState } from 'react';
import { PhotoTab } from './photo-tab';
import { TryTab } from './try-tab';
import { Lab2Tab } from './lab2-tab';
/*
import { ProfileTab } from './profile-tab';
import { DevelopTab } from './develop-tab';
import { CouplersTab } from './couplers-tab';
 */
import { SpectraTab } from './spectra-tab';
import { LabTab } from './lab-tab';
import { Tabs, TabPanel, TabCaption } from './tabs';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Stack } from '@mui/material';
import { State } from '../store';
const { dialog, BrowserWindow } = require('electron').remote;

function toggleDevTools() {
    try {
        require('electron').remote.getCurrentWindow().toggleDevTools();
    } catch(e) {
        //alert(e);
    }
}

function SomeButtons(props): React.ReactElement {
    return (
        <div>
            <Button onClick={toggleDevTools} variant="outlined">Toggle dev tools</Button>
        </div>
    );
}

function PhotoTabCaption(props): React.ReactElement {
    const { imagePath, index, onSelected } = props;
    const dispatch = useDispatch();
    let pathDiv: React.ReactElement;
    const pathStyle: React.CSSProperties = {
        overflow: 'hidden',
        width: '200px',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        direction: 'rtl',
        fontSize: '12px',
    };
    pathDiv = (
        <div style={pathStyle} onClick={() => {
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
            }}>
            {imagePath || 'no image'}
        </div>
    );
    return (
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <div onClick={ () => onSelected(index) }>Photo</div>
            {pathDiv}
        </div>
    );
}

function App(): React.ReactElement {
    const [ selected, setSelected ] = useState(0);
    const imagePath = useSelector((state: State) => state.imagePath);
    const onTabSelected = (i: number) => setSelected(i);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh' }}>
            <div style={{ display: 'flex' }}>
                <Tabs selected={selected}>
                    <PhotoTabCaption index={0} onSelected={onTabSelected} imagePath={imagePath}/>
                    <TabCaption index={1} onSelected={onTabSelected} caption="Lab2" />
                    <TabCaption index={2} onSelected={onTabSelected} caption="Spectra" />
                    <TabCaption index={3} onSelected={onTabSelected} caption="Try" />
                    <TabCaption index={4} onSelected={onTabSelected} caption="Lab" />
                </Tabs>
                <SomeButtons imagePath={imagePath}/>
            </div>
            <TabPanel index={0} selected={selected}>
                <PhotoTab imagePath={imagePath} />
            </TabPanel>
            <TabPanel index={1} selected={selected}>
                <Lab2Tab/>
            </TabPanel>
            <TabPanel index={2} selected={selected}>
                <SpectraTab/>
            </TabPanel>
            <TabPanel index={3} selected={selected}>
                <TryTab/>
            </TabPanel>
            <TabPanel index={4} selected={selected}>
                <LabTab/>
            </TabPanel>
        </div>
    );
}

export default App;
