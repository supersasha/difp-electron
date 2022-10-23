import * as React from 'react';
import { Slider } from '@mui/material';

export interface LightSourceControlsProps {
    daylightTemp: number;
    onChange: (temp: number) => void;
    caption?: string;
}

export function LightSourceControls(props: LightSourceControlsProps): React.ReactElement {
    const { daylightTemp, onChange, caption } = props;
    return (
        <>
            <div>
                {caption || 'Light source'}:
            </div>
            <div style={{ width: '350px' }}>
                <Slider
                    min={4000}
                    max={10000}
                    step={100}
                    value={daylightTemp}
                    onChange={(_event, value) => {
                        onChange(value as number);
                    }}
                    marks={[
                        {
                            value: 5000,
                            label: 'D50'
                        },
                        {
                            value: 5500,
                            label: 'D55'
                        },
                        {
                            value: 6500,
                            label: 'D65'
                        },
                        {
                            value: 7500,
                            label: 'D75'
                        },
                    ]}
                    valueLabelDisplay="on"
                />
            </div>
        </>
    );
}
