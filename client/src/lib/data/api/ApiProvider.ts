import type { SkyDataProvider } from "../provider";

const NOT_YET = "Live archive data is not available yet.";

/** Same interface, backed by a future server (architecture §5.4). Stub until the backend exists. */
export const apiProvider: SkyDataProvider = {
  kind: "api",
  async getField() {
    throw new Error(NOT_YET);
  },
  async getFramePixels() {
    throw new Error(NOT_YET);
  },
  async getSpectrum() {
    throw new Error(NOT_YET);
  },
  async getProjectQueue() {
    throw new Error(NOT_YET);
  },
};
