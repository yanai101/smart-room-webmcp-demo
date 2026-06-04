import { initScene, updateSceneFromRoomState } from './scene';
import { subscribeRoomState } from './room/roomState';
import { registerWebMcpTools } from './webmcp/registerWebMcpTools';
import { exposeSmartRoomTestApi } from './testing/exposeTestApi';
import { initNavigation } from './ui/navigation';
import { initFinalSlide } from './ui/finalSlide';
import { initSpeakerMode } from './ui/speakerMode';
import { renderStage } from './stages/renderStage';

const canvas = document.getElementById('room') as HTMLCanvasElement;

initScene(canvas);
subscribeRoomState(updateSceneFromRoomState);

exposeSmartRoomTestApi();
registerWebMcpTools();

initFinalSlide();
initSpeakerMode();
initNavigation();
renderStage(0);
