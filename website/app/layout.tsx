import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SHAI Studio | AI-Native Websites & Social",
  description: "SHAI Studio builds AI-native websites and social media for small businesses, live in about two weeks.",
  metadataBase: new URL("https://shaicompanies.com"),
  openGraph: { title: "SHAI Studio", description: "They look you up before they walk in. Win that moment.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
