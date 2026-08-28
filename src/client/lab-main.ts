import { startLab } from "../lab/app";

const mount = document.querySelector<HTMLElement>("#lab");
if (!mount) throw new Error("Lab mount is missing");

const dispose = startLab(mount);
if (import.meta.hot) import.meta.hot.dispose(dispose);
