import * as React from 'react';
import { ProfilePlot } from './plot';

export function ProfileTab(): React.ReactElement {
    return (
        <>
            <div style={{ display: 'flex' }}>
                <ProfilePlot containerStyle={{ flex: '1 100px', height: '400px' }}
                    path="./data/b29-50d.json"
                    title="Couplers"
                    what="couplers"
                />
                <ProfilePlot containerStyle={{ flex: '1 100px', height: '400px' }}
                    path="./data/b29-50d.json"
                    title="Matrix of reflection"
                    what="mtx_refl"
                />
            </div>
            <div style={{ display: 'flex' }}>
                <ProfilePlot containerStyle={{ flex: '1 100px', height: '400px' }}
                    path="./data/b29-50d.json"
                    title="Film dyes"
                    what="film_dyes"
                />
                <ProfilePlot containerStyle={{ flex: '1 100px', height: '400px' }}
                    path="./data/b29-50d.json"
                    title="Film sense"
                    what="film_sense"
                    yrange={[-4, -2.5]}
                />
            </div>
            <div style={{ display: 'flex' }}>
                <ProfilePlot containerStyle={{ flex: '1 100px', height: '400px' }}
                    path="./data/b29-50d.json"
                    title="Paper dyes"
                    what="paper_dyes"
                />
                <ProfilePlot containerStyle={{ flex: '1 100px', height: '400px' }}
                    path="./data/b29-50d.json"
                    title="Paper sense"
                    what="paper_sense"
                    yrange={[-4, -2.4]}
                />
            </div>
        </>
    )
}
