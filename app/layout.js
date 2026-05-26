import "./globals.css";

export const metadata = {
  title: "Project Connect",
  description: "AI-Native Executive Search Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
