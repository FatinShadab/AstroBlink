import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, USER_STORE_KEY, USER_STORE_VERSION, useUserStore } from "./useUserStore";

describe("useUserStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.setState({
      user: null,
      settings: DEFAULT_SETTINGS,
      classifications: [],
      trainingDone: {},
      batch: null,
    });
  });

  it("uses the astroblink:v1 key and version 1", () => {
    expect(USER_STORE_KEY).toBe("astroblink:v1");
    expect(USER_STORE_VERSION).toBe(1);
    expect(useUserStore.persist.getOptions().name).toBe("astroblink:v1");
    expect(useUserStore.persist.getOptions().version).toBe(1);
  });

  it("updates one setting without touching the others", () => {
    useUserStore.getState().setReducedMotion(true);
    const { settings } = useUserStore.getState();
    expect(settings.reducedMotion).toBe(true);
    expect(settings.blinkFps).toBe(DEFAULT_SETTINGS.blinkFps);
  });

  it("starts with defaults that respect the 2 frames-per-second cap", () => {
    expect(DEFAULT_SETTINGS.blinkFps).toBe(1);
    expect(DEFAULT_SETTINGS.reducedMotion).toBe(false);
  });
});
