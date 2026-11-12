/**
 * Certificate canvas (design §8.10, architecture §10): A4 landscape at 300 dpi, 2480 × 1754 px.
 * Light tokens only: the certificate is the one light surface (design §2).
 */
export const CERT_W = 2480;
export const CERT_H = 1754;

export interface CertificateText {
  brand: string;
  title: string;
  name: string;
  body: string; // "has checked N fields…", already filled in
  projectsLabel: string;
  projects: string[];
  dateLabel: string;
  dateText: string;
  credit: string;
}

export interface CertificateColours {
  paper: string;
  ink: string;
  muted: string;
  accent: string;
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x + r * 0.5, y - r * 0.5, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

/** Draws the certificate onto a 2480×1754 canvas. The brand mark is geometric; no NASA marks (rules §2.3). */
export function drawCertificate(
  ctx: CanvasRenderingContext2D,
  text: CertificateText,
  c: CertificateColours,
): void {
  ctx.fillStyle = c.paper;
  ctx.fillRect(0, 0, CERT_W, CERT_H);

  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(120, 120, CERT_W - 240, CERT_H - 240);
  ctx.lineWidth = 2;
  ctx.strokeRect(150, 150, CERT_W - 300, CERT_H - 300);

  ring(ctx, 260, 260, 42, c.accent);
  ctx.fillStyle = c.ink;
  ctx.textAlign = "left";
  ctx.font = '600 56px "Space Grotesk", system-ui, sans-serif';
  ctx.fillText(text.brand, 330, 285);

  ctx.textAlign = "center";
  ctx.fillStyle = c.accent;
  ctx.font = '600 64px "Space Grotesk", system-ui, sans-serif';
  ctx.fillText(text.title, CERT_W / 2, 440);

  ctx.fillStyle = c.ink;
  ctx.font = '600 150px "Space Grotesk", system-ui, sans-serif';
  ctx.fillText(text.name, CERT_W / 2, 700, CERT_W - 400);

  ctx.fillStyle = c.muted;
  ctx.font = "400 54px Inter, system-ui, sans-serif";
  ctx.fillText(text.body, CERT_W / 2, 830, CERT_W - 400);

  ctx.fillStyle = c.ink;
  ctx.font = "500 44px Inter, system-ui, sans-serif";
  ctx.fillText(text.projectsLabel, CERT_W / 2, 1000);
  ctx.fillStyle = c.muted;
  ctx.font = "400 40px Inter, system-ui, sans-serif";
  ctx.fillText(text.projects.join("  ·  "), CERT_W / 2, 1060, CERT_W - 400);

  ctx.fillStyle = c.ink;
  ctx.font = "500 40px Inter, system-ui, sans-serif";
  ctx.fillText(`${text.dateLabel}: ${text.dateText}`, CERT_W / 2, 1400);

  ctx.fillStyle = c.muted;
  ctx.font = "400 36px Inter, system-ui, sans-serif";
  ctx.fillText(text.credit, CERT_W / 2, 1560, CERT_W - 400);
}
