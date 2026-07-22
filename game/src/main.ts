import './style.css';
import { initialAppState, reduce, type Action, type AppState } from './state/game';
import { bind, bindCreateExtra, render } from './ui/render';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div id="stage3d" class="stage3d" aria-hidden="true"></div>
  <div id="ui-root" class="ui-root"></div>
`;

const stage = document.querySelector<HTMLDivElement>('#stage3d')!;
const uiRoot = document.querySelector<HTMLDivElement>('#ui-root')!;

type SceneApi = { sync: (state: AppState) => void };
let scene3d: SceneApi | null = null;
let sceneLoading: Promise<SceneApi> | null = null;

async function ensureScene(): Promise<SceneApi> {
  if (scene3d) return scene3d;
  if (!sceneLoading) {
    sceneLoading = import('./view3d/ArenaScene').then(({ ArenaScene }) => {
      scene3d = new ArenaScene(stage);
      return scene3d;
    });
  }
  return sceneLoading;
}

let state: AppState = initialAppState();

function dispatch(action: Action) {
  state = reduce(state, action);
  paint();
}

function paint() {
  const mode =
    state.screen === 'combat' || state.screen === 'clash'
      ? 'combat'
      : state.screen === 'title' || state.screen === 'gallery'
        ? 'title'
        : 'ambient';
  app.dataset.mode = mode;

  uiRoot.innerHTML = render(state);
  bind(uiRoot, dispatch);
  if (state.screen === 'create') bindCreateExtra(uiRoot, state, dispatch);

  void ensureScene().then((scene) => scene.sync(state));
}

paint();
