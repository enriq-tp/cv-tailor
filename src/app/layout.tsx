import type { Metadata } from "next";
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";
import "./globals.css";

// next/font downloads the fonts at build time and serves them from our own domain:
// the browser never contacts Google (good for privacy and speed).
// Headings: Bricolage Grotesque. Body and UI: Public Sans (very legible at 16 px).
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CV Tailor",
  description:
    "Add your CV and a job posting, then fit your CV to the job. You review the result before you download it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${publicSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-chalk text-ink font-sans text-base">
        {children}
      </body>
    </html>
  );
}
