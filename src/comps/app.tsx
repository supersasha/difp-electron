import * as React from 'react';
import { useState } from 'react';
import { PhotoTab } from './photo-tab';
import { TryTab } from './try-tab';
import { Lab2Tab } from './lab2-tab';
import { ProfileTab } from './profile-tab';
import { DevelopTab } from './develop-tab';
import { CouplersTab } from './couplers-tab';
import { SpectraTab } from './spectra-tab';
import { LabTab } from './lab-tab';
import { Tab, Tabs, Box } from '@mui/material';
//import { TabPanel, TabList, TabContext } from '@mui/lab';
//import { Once } from './once';

function MyTabPanel(props) {
    const { name, value, children } = props;
    return (
        <div style={{
            display: name === value ? 'block' : 'none',
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: '100px',
        }}>
            {children}
        </div>
    );
}

function App(): React.ReactElement {
    const [tabSelected, setTabSelected] = useState('photo-tab');
    function handleTabChange(e: React.SyntheticEvent, newValue: string) {
        void e;
        setTabSelected(newValue);
    }
    return (
        <Box sx={{ display: 'flex' }}>
            <Tabs value={tabSelected} onChange={handleTabChange} orientation="vertical">
                <Tab label="Photo" value="photo-tab" />
                <Tab label="Lab2" value="lab2-tab" />
                <Tab label="Spectra" value="spectra-tab" />
                <Tab label="Try" value="try-tab" />
                <Tab label="Lab" value="lab-tab" />
            </Tabs>
            <MyTabPanel name="photo-tab" value={tabSelected}>
                <PhotoTab/>
            </MyTabPanel>
            <MyTabPanel name="lab2-tab" value={tabSelected}>
                <Lab2Tab />
            </MyTabPanel>
            <MyTabPanel name="spectra-tab" value={tabSelected}>
                <SpectraTab />
            </MyTabPanel>
            <MyTabPanel name="try-tab" value={tabSelected}>
                <TryTab/>
            </MyTabPanel>
            <MyTabPanel name="lab-tab" value={tabSelected}>
                <LabTab/>
            </MyTabPanel>
        </Box>

        /*
        <Box sx={{ display: 'flex', flexGrow: 1, flexBasis: '100px' }}>
            <TabContext value={tabSelected}>
                <TabList onChange={handleTabChange} orientation="vertical">
                    <Tab label="Photo" value="photo-tab" />
                    <Tab label="Profile" value="profile-tab" />
                    <Tab label="Lab" value="lab-tab" />
                </TabList>
                <TabPanel value="photo-tab" sx={{ padding: 0 }}>
                    <Once component={PhotoTab} unit="PhotoTab" />
                </TabPanel>
                <TabPanel value="profile-tab"><ProfileTab/></TabPanel>
                <TabPanel value="lab-tab"><LabTab/></TabPanel>
            </TabContext>
        </Box>
        */
    );
}

export default App;
