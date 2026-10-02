'use client';
import { useState } from 'react';
import Image from 'next/image';
export default function MemberAvatar({ account, size = 40 }) {
  const [failedSource, setFailedSource] = useState(null);
  const source = typeof account?.pictureUrl === 'string' && account.pictureUrl.startsWith('https://') ? account.pictureUrl : null;
  if (source && source !== failedSource) return <img src={source} width={size} height={size}
    alt={`รูปโปรไฟล์ ${account.displayName || 'สมาชิก'}`} referrerPolicy="no-referrer" decoding="async"
    style={{ objectFit: 'cover', borderRadius: 'inherit' }} onError={() => setFailedSource(source)} />;
  return <Image src="/nugaom-mascot.png" width={size} height={size} alt="" />;
}
