import * as React from 'react';

export interface TabsProps {
    selected: number;
    onSelected?: (index: number) => void;
    children: React.ReactChild[];
}

export function Tabs(props: TabsProps): React.ReactElement {
    const { selected, onSelected, children } = props;
    return (
        <div style={{ flex: '0 0',  display: 'flex' }}>
            {
                children.map((t, i) => {
                    const style = {
                        borderBottom: i === selected ? '2px solid blue' : '',
                        margin: '10px',
                        cursor: 'pointer',
                    };
                    return (
                        <div key={i} style={style}>{t}</div>
                    );
                })
            }
        </div>
    );
}

export interface TabPanelProps {
    index: number;
    selected: number;
    children: React.ReactNode;
}

export function TabPanel(props: TabPanelProps): React.ReactElement {
    const { index, selected, children } = props;
    const style = {
        display: index === selected ? 'block' : 'none',
        width: '100%',
        height: '100%',
    };
    return (
        <div style={style}>
            { children }
        </div>
    );
}

export interface TabCaptionProps {
    index: number;
    caption: string;
    onSelected: (index: number) => void;
}

export function TabCaption(props: TabCaptionProps) {
    const { index, caption, onSelected } = props;
    const style: React.CSSProperties = { whiteSpace: 'nowrap' };
    return (
        <div style={style} onClick={ () => onSelected(index) }>{caption}</div>
    );
}
