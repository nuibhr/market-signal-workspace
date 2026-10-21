'use client';
import {useState} from 'react';
import {instrumentIdentity} from '../../markets/instrument-identity.mjs';
import styles from '../daytrade/daytrade.module.css';
export default function InstrumentLogo({asset}) {
  const identity=instrumentIdentity(asset),[failed,setFailed]=useState(null);
  return <span className={styles.logo} data-tone={identity.tone} aria-hidden="true">
    <span>{identity.label}</span>
    {identity.url&&failed!==identity.url&&<img src={identity.url} alt="" width="40" height="40" loading="lazy" decoding="async" style={{background:identity.background??'#ffffff'}} referrerPolicy="no-referrer" onError={()=>setFailed(identity.url)}/>}
  </span>;
}
