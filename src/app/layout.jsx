import './globals.css';
import './workspace-v2.css';
import './workspace-v3.css';
import './workspace-v4.css';
import './workspace-v5.css';
import './workspace-v6.css';
import './workspace-v7.css';
import './workspace-v8.css';
import './account.css';
import './admin.css';
import './assistant.css';
import './auto-pick.css';
import './workspace-v9.css';

export const metadata = {
  title: 'Nugaom AI Pick — Market Intelligence Workspace',
  description: 'Nugaom AI Pick: พื้นที่สำรวจราคา กราฟ และแผนการเทรดพร้อมแยกข้อมูลจริงกับข้อมูลตัวอย่าง',
  icons: { icon: '/nugaom-mascot.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
