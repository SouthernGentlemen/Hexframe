import { startLab } from "../lab/app";
import { readGameSession } from "../game/session";
import { startFrontApp } from "./front-app";
import "./styles/front.css";

const mount = document.querySelector<HTMLElement>("#lab");
if (!mount) throw new Error("Game mount is missing");

let dispose = (): void => undefined;
const session = readGameSession(new URL(window.location.href));
void (session ? startLab(mount) : startFrontApp(mount)).then((teardown) => { dispose = teardown; });
if (import.meta.hot) import.meta.hot.dispose(() => dispose());
