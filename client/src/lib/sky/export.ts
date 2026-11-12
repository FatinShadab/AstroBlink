/** Save a canvas as PNG, scaled up with hard pixels so astronomy pixels stay sharp. Browser only. */
export function downloadCanvasPng(source: HTMLCanvasElement, fileName: string, scale = 8): void {
  const out = document.createElement("canvas");
  out.width = source.width * scale;
  out.height = source.height * scale;
  const ctx = out.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, out.width, out.height);
  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

/** Public embed snippet for the current viewer state (design §10, architecture §10). */
export function embedSnippet(origin: string, search: string): string {
  return `<iframe src="${origin}/embed${search}" width="600" height="400" style="border:0" title="AstroBlink sky viewer" loading="lazy"></iframe>`;
}
