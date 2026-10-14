import type { Metadata } from "next";
import "./globals.css";
import "./portal-refinements.css";
import "./auth.css";
import "./users.css";
import "./conversations.css";
import "./compliance.css";

export const metadata: Metadata = {
  title: "Booran Motor Group | New-lead conversation portal",
  description: "New lead SMS journeys and customer conversation portal for Booran Motor Group.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
