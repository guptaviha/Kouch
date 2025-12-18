import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import { PWAWrapper } from "@/components/pwa-wrapper";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

/**
 * Exporting this metadata object is enough for Next.JS to pick it up for the page and SEO.
 */
export const metadata: Metadata = {
    title: "Kouch",
    description: "couch player games for the insane.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <Script async src="http://localhost:3000/script.js" data-website-id=""></Script>
            <body className={inter.className}>
                <PWAWrapper>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        {children}
                    </ThemeProvider>
                </PWAWrapper>
            </body>
        </html>
    );
}
