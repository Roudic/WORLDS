import './style.css';
import { initialAppState, reduce, type Action, type AppState } from './state/game';
import { bind, bindCreateExtra, render } from './ui/render';

const app = document.querySelector<HTMLDivElement>('#app')!;
let state: AppState = initialAppState();

function dispatch(action: Action) {
  state = reduce(state, action);
  paint();
}

function paint() {
  app.innerHTML = render(state);
  bind(app, dispatch);
  if (state.screen === 'create') bindCreateExtra(app, state, dispatch);
}

paint();
