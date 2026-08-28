import { startFrontApp } from "./front-app";
import "./styles/front.css";

const mount = document.querySelector<HTMLElement>("#app");
if (!mount) throw new Error("Title mount is missing");

let dispose = (): void => undefined;
void startFrontApp(mount).then((teardown) => { dispose = teardown; });
if (import.meta.hot) import.meta.hot.dispose(() => dispose());
