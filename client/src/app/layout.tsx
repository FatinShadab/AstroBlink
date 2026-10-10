import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AstroBlink — Spot the Next Pluto",
  description:
    "A citizen-science blink comparator for NASA's SPHEREx mission. " +
    "Help discover moving objects, brown dwarfs, and candidate planets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-astro-bg text-white antialiased min-h-screen">
        {/* TODO: Add navigation bar — see ARCHITECTURE.md §2.1 */}
        <main>{children}</main>
      </body>
    </html>
  );
}
