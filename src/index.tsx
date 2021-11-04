import * as React from 'react';
import * as ReactDOM from 'react-dom';
import './index.css';
import App from './comps/app';
import { Provider } from 'react-redux';
import { store } from './store';

ReactDOM.render(
    <React.StrictMode>
        <Provider store={store}>
            <App />
        </Provider>
    </React.StrictMode>,
    document.getElementById('root')
);
