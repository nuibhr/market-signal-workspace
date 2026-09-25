import './globals.css';

export const metadata = {
  title: 'NOVA — Market Intelligence Workspace',
  description: 'A chart-led, evidence-first trading research workspace.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
