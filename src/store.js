import { createStore } from 'redux';
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    imagePath: undefined,
    userOptions: {
        color_corr: [0.0, 0.0, 0.0],
        film_exposure: -1.6,
        paper_contrast: 1.8,
        curve_smoo: 0.15
    },
    blurRadius: 0,
    maskThreshold: 0.9,
    maskDensity: 0,
};

const rootSlice = createSlice({
    'name': 'main',
    initialState,
    reducers: {
        loadImage(state, action) {
            state.imagePath = action.payload;
        },

        setFilmExposure(state, action) {
            state.userOptions.film_exposure = action.payload;
        },

        setColor(state, action) {
            state.userOptions.color_corr[action.payload[0]] = action.payload[1];
        },

        setPaperContrast(state, action) {
            state.userOptions.paper_contrast = action.payload;
        },

        setSmoothness(state, action) {
            state.userOptions.curve_smoo = action.payload;
        },

        setBlurRadius(state, action) {
            state.blurRadius = action.payload;
        },
        setMaskThreshold(state, action) {
            state.maskThreshold = action.payload;
        },
        setMaskDensity(state, action) {
            state.maskDensity = action.payload;
        },
    }
});

export const store = createStore(rootSlice.reducer);
