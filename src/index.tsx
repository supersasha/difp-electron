import * as React from 'react';
import * as ReactDOM from 'react-dom';
import './index.css';
import App from './comps/app';
import { Provider } from 'react-redux';
import { store } from './store';
import * as nlopt from 'nlopt-js';
//import { FocusStyleManager } from '@blueprintjs/core';
import "@fontsource/roboto";

import { theme } from './comps/theme';
import { ThemeProvider, CssBaseline } from '@mui/material';


async function main() {
    await nlopt.ready;
    //FocusStyleManager.onlyShowFocusOnTabs();
    ReactDOM.render(
        <React.StrictMode>
            <Provider store={store}>
                <ThemeProvider theme={theme}>
                    <CssBaseline />
                    <App />
                </ThemeProvider>
            </Provider>
        </React.StrictMode>,
        document.getElementById('root')
    );
}

main();
