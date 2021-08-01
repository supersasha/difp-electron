import React from 'react';
import { PhotoTab } from './photo-tab';
import { ProfileTab } from './profile-tab';
import { DevelopTab } from './develop-tab';
import { CouplersTab } from './couplers-tab';
import { LabTab } from './lab-tab';
import { Tabs } from 'antd';

import 'antd/dist/antd.css';

//import { profile } from './profiler';
//profile();

const { TabPane } = Tabs;

function App() {
    return (
        <Tabs tabPosition="left" type="card">
            <TabPane tab="Photo" key="1">
                <PhotoTab/>
            </TabPane>
            <TabPane tab="Profile" key="2">
                <ProfileTab/>
            </TabPane>
            <TabPane tab="Develop" key="3">
                <DevelopTab/>
            </TabPane>
            <TabPane tab="Couplers" key="4">
                <CouplersTab/>
            </TabPane>
            <TabPane tab="Lab" key="5">
                <LabTab/>
            </TabPane>
        </Tabs>
    );
}
export default App;
