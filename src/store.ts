import { createStore } from 'redux';
import { createSlice } from '@reduxjs/toolkit';

export interface UserOptions {
    colorCorr: [number, number, number];
    filmExposure: number;
    paperExposure: number;
    paperContrast: number;
    curveSmoo: number;
    maskBlur: number;
    maskThreshold: number;
    maskDensity: number;
    noiseSigma: number;
    noiseBlur: number;
    raw: boolean;
}

export interface State {
    imagePath?: string;
    userOptions: UserOptions;
}

const initialState: State = {
    imagePath: undefined,
    userOptions: {
        colorCorr: [0.0, 0.23, 0.1],
        filmExposure: 0,//-1.6,
        paperExposure: 0.23,
        paperContrast: 4.0,//1.8,
        curveSmoo: 0.15,//0.15,
        maskBlur: 0.0,
        maskThreshold: 0.9,
        maskDensity: 0.0,
        noiseSigma: 0.0, //0.01,
        noiseBlur: 0.046,
        raw: false,
    },
};

const rootSlice = createSlice({
    'name': 'main',
    initialState,
    reducers: {
        setImagePath(state, action) {
            state.imagePath = action.payload;
        },

        setUserOptions(state, action) {
            state.userOptions = { ...state.userOptions, ...action.payload };
        },

        setColor(state, action) {
            if (action.payload.red !== undefined) {
                state.userOptions.colorCorr[0] = action.payload.red;
            }
            if (action.payload.green !== undefined) {
                state.userOptions.colorCorr[1] = action.payload.green;
            }
            if (action.payload.blue !== undefined) {
                state.userOptions.colorCorr[2] = action.payload.blue;
            }
        },
    }
});

export const store = createStore(rootSlice.reducer);
