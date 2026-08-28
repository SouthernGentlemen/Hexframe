import { startLab } from "../lab/app";

const mount = document.querySelector<HTMLElement>("#lab");
if (!mount) throw new Error("Game mount is missing");

let dispose = (): void => undefined;
void startLab(mount).then((teardown) => { dispose = teardown; });
if (import.meta.hot) import.meta.hot.dispose(() => dispose());
