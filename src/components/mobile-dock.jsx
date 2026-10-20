'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Home, Scale, User, Zap } from 'lucide-react';

const DOCK_ITEMS = [
  { label: 'หน้าหลัก', href: '/', icon: Home },
  { label: 'ตลาด', href: '/markets', icon: Compass },
  { label: 'Daytrade', href: '/daytrade', icon: Zap },
  { label: 'คุมเสี่ยง', href: '/risk', icon: Scale },
  { label: 'บัญชี', href: '/account', icon: User },
];

export default function MobileDock() {
  const pathname = usePathname();

  return (
    <nav className="ng-mobile-dock" aria-label="แถบนำทางด่วนบนมือถือ">
      <div className="ng-mobile-dock-inner">
        {DOCK_ITEMS.map((item) => {
          const IconComponent = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`ng-dock-item ${isActive ? 'is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="ng-dock-icon-wrap">
                <IconComponent size={20} />
              </div>
              <span className="ng-dock-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
