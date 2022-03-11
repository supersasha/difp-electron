import * as React from 'react';
import { useState } from 'react';
import { Matrix } from '../matrix';

//import { ColorSliders } from './color-sliders';
import { Tabs, TabPanel } from './tabs';

export function TryTab(props): React.ReactElement {
    const [ selected, setSelected ] = useState(0);
    return (
        <>
            <Tabs selected={selected} onSelected={(i) => setSelected(i)}>
                <span>Tab1</span>
                <span>Tab2</span>
                <span>Tab3</span>
            </Tabs>
            <TabPanel index={0} selected={selected}>
                Panel 1
            </TabPanel>
            <TabPanel index={1} selected={selected}>
                Panel 2
            </TabPanel>
            <TabPanel index={2} selected={selected}>
                Panel 3
            </TabPanel>
        </>
    );
}
