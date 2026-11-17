import "./globals.css";

export const metadata = { title: "fal playground", description: "Generate images, video, audio and 3D with fal.ai models" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
