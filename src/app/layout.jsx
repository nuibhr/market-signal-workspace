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
import './coaches.css';
import './community.css';
import './assistant.css';
import './auto-pick.css';
import './workspace-v9.css';
import './market-pages.css';
import './focus-performance.css';
import './signal-desk.css';
import './monitor.css';
import './liquid-glass.css';
import './magic-ui-theme.css';
import AssistantProvider from '../components/assistant-provider.jsx';
import MonitorProvider from '../components/monitor/monitor-provider.jsx';
import SharedDataNotice from '../components/shared-data-notice.jsx';

export const metadata = {
  title: 'Nugaom AI Pick — Market Intelligence Workspace',
  description: 'Nugaom AI Pick: พื้นที่สำรวจราคา กราฟ และแผนการเทรดพร้อมแยกข้อมูลจริงกับข้อมูลตัวอย่าง',
  icons: { icon: '/nugaom-mascot.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Prompt:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body data-theme="dark"><MonitorProvider><AssistantProvider><SharedDataNotice/>{children}</AssistantProvider></MonitorProvider></body>
    </html>
  );
}
