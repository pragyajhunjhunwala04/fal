import "./globals.css";

export const metadata = { title: "fal playground", description: "Generate images with fal.ai FLUX.1 [dev]" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
