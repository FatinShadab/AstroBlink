/**
 * Turn 8-bit grey frames into canvases (architecture §8). Pure helpers first;
 * the DOM canvas helper is at the bottom and runs only in the browser.
 */

/** Grey → RGBA bytes. Alpha is always 255. */
export function greyToRgba(grey: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(grey.length * 4);
  for (let i = 0, j = 0; i < grey.length; i++, j += 4) {
    const g = grey[i];
    out[j] = g;
    out[j + 1] = g;
    out[j + 2] = g;
    out[j + 3] = 255;
  }
  return out;
}

/** Build an offscreen canvas at native frame size. Browser only. */
export function makeFrameCanvas(
  grey: Uint8ClampedArray,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  const rgba = greyToRgba(grey);
  ctx.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
  return canvas;
}
