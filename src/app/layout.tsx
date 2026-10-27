import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "CRM · Alpha Link GPS", template: "%s · CRM Alpha Link GPS" },
  description: "CRM de Alpha Link GPS: ventas, instalación, soporte y cobro. Mockup con datos ficticios.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0f1a21" };

// Mismo tema que el sitio (oscuro por defecto, claro opcional) y la misma clave,
// para que la elección se comparta cuando ambos vivan en el mismo dominio.
const themeScript = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("alg-theme-v2");if(t==="dark"||t==="light")d.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CL"
      data-theme="dark"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-bg text-ink">{children}</body>
    </html>
  );
}
