import * as React from 'react';
import { useState } from 'react';
import { Matrix } from '../matrix';

import { ColorSliders } from './color-sliders';

export function TryTab(props): React.ReactElement {
    const [ color, setColor ] = useState(Matrix.fromArray([[0, 0, 0]]));
    return <ColorSliders
        labels={['Red', 'Green', 'Blue']}
        color={color}
        onChange={setColor}
    />;
}
