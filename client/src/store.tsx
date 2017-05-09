import 'babel-polyfill';
import { createStore, applyMiddleware, compose } from 'redux';
import { rootReducer, rootSaga } from './reducer/index';
import createSagaMiddleware from 'redux-saga';
import { initialState } from './state';

const sagaMiddleware = createSagaMiddleware();

const reduxDebugFlag = '__REDUX_DEVTOOLS_EXTENSION_COMPOSE__';
const composeEnhancers = window[reduxDebugFlag] || compose;

export function configureStore() {
    const store = createStore(
        rootReducer, initialState,
        composeEnhancers(
            applyMiddleware(sagaMiddleware)
        )
    );
    sagaMiddleware.run(rootSaga);
    return store;
}