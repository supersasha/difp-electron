import Konva from 'konva';
import React, { useRef, useEffect, useState } from 'react';

export function Plot(props) {
    const defaultProps = {
        width: 320,
        height: 200,
    };
    const _props = { ...defaultProps, props };
    const elemRef = useRef(null);
    const [stage, setStage] = useState(null);

    useEffect(() => {
        const stage = new Konva.Stage({
            container: elemRef.current,
            width: _props.width,
            height: _props.height,
        });
        setStage(stage);
        return () => { 
            console.log('Removing stage');
            setStage(null);
        };
    }, []);

    useEffect(() => {
        if (!stage) {
            return;
        }
        console.log('Stage:', stage);
        //stage.clear();
        const layer = new Konva.Layer();
        const rect = new Konva.Rect({
            x: 10.5,
            y: 10.5,
            width: 30,
            height: 20,
            stroke: 'black',
            strokeWidth: 1,
        });
        layer.add(rect);
        stage.add(layer);
        //layer.draw();
        //stage.draw();
        return () => {
            console.log('Removing layer');
            layer.destroy();
        };
    });

    return <div ref={elemRef} />;
}
