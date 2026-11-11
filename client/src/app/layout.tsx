import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Bengali, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/Providers";
import { LANG_COOKIE } from "@/lib/i18n/lang";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const notoBengali = Noto_Sans_Bengali({
  variable: "--font-noto-sans-bengali",
  subsets: ["bengali"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AstroBlink",
    template: "%s · AstroBlink",
  },
  description:
    "Watch NASA SPHEREx infrared images blink, spot moving stars and new worlds. Simulated sky is labelled.",
  applicationName: "AstroBlink",
};

export const viewport: Viewport = {
  themeColor: "#070a12",
  colorScheme: "dark",
};

/*
 * Language before first paint. Reading cookies() in this root layout would make every route
 * dynamic and break static prerendering under Cache Components, so the cookie is read by a tiny
 * inline script instead. The persisted store takes over after hydration (LangProvider).
 */
const applyLangCookie = `(function(){try{var m=document.cookie.match(/(?:^|; )${LANG_COOKIE}=(en|bn)/);if(m){document.documentElement.lang=m[1];}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} ${notoBengali.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-text-primary">
        <script dangerouslySetInnerHTML={{ __html: applyLangCookie }} />
        <Providers initialLang="en">{children}</Providers>
      </body>
    </html>
  );
}
