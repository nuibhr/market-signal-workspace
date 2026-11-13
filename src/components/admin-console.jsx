'use client';
import { useState } from 'react';
import CoachHub from './coach-dashboard.jsx';
import AdminTelegramVip from './admin/admin-telegram-vip.jsx';
import Image from 'next/image';
import { Activity, ArrowLeft, ArrowRight, Check, CircleAlert, Copy, History, LayoutDashboard, LogOut, Radio, RefreshCw, Search, ShieldCheck, UserPlus, Users, Wallet, X } from 'lucide-react';
import { useAdminResource } from './use-admin-resource.mjs';
import { AuditList, date, LaunchPanel, MARKET_NAMES, MemberDialog, MemberIdentity, Pager, ResourceNotice, ReviewDialog, SIGNAL_NAMES, SignalsPanel, Status, SystemPanel } from './admin-operations-ui.jsx';
const DEFAULT_NAV = [
  ['overview', 'ภาพรวม', LayoutDashboard],
  ['members', 'สมาชิก', Users],
  ['renewals', 'ต่ออายุ', Wallet],
  ['partner_leads', 'ลูกค้าเปิดพอร์ต / ยืนยัน VIP', UserPlus],
  ['telegram', 'ยิงสัญญาณ Telegram VIP', Radio],
  ['signals', 'สัญญาณและผลลัพธ์', Activity],
  ['coaches', 'พอร์ตโค้ช', Users],
  ['audit', 'ประวัติรายการ', History],
  ['system', 'สถานะระบบ', ShieldCheck],
];
const ERRORS={FORBIDDEN:'บัญชีนี้ไม่มีสิทธิผู้ดูแล',PORTFOLIO_MISMATCH:'เลขพอร์ตไม่ตรงกับที่สมาชิกแจ้ง',INVALID_PORTFOLIO:'กรุณาตรวจรูปแบบเลขพอร์ต',PORTFOLIO_NOT_VERIFIED:'ต้องตรวจบัญชีหุ้นให้ผ่านก่อน',REQUEST_UNAVAILABLE:'รายการถูกจัดการไปแล้ว กรุณารีเฟรช',INVALID_CREDIT_AMOUNT:'เครดิตต้องเป็นจำนวนเต็ม 1–1,000',INVALID_REQUEST_ID:'รหัสรายการไม่ตรงกับรายการเดิม กรุณาเปิดรายการใหม่',INVALID_NOTE:'หมายเหตุยาวเกินกำหนด',CODE_UNAVAILABLE:'โค้ดถูกใช้ ยกเลิก หรือหมดอายุแล้ว',PAYMENT_CONFIRMATION_REQUIRED:'กรุณายืนยันการรับชำระก่อน',RATE_LIMITED:'ทำรายการถี่เกินไป กรุณารอสักครู่'};
function SectionTitle({title,detail,onRefresh,loading}){return <div className="admin-section-title"><div><h2>{title}</h2><p>{detail}</p></div><button className="account-secondary" onClick={onRefresh} disabled={loading}><RefreshCw size={16}/>{loading?'กำลังโหลด':'รีเฟรช'}</button></div>;}
export default function AdminConsole({ initialBrokerRole = null }){
  const isBrokerStaff = Boolean(initialBrokerRole && !initialBrokerRole.isSuper);
  const [tab, setTab] = useState(isBrokerStaff ? 'partner_leads' : 'overview');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [leadBrokerFilter, setLeadBrokerFilter] = useState(isBrokerStaff ? initialBrokerRole.brokerId : 'all');
  const [leadTypeFilter, setLeadTypeFilter] = useState('all');
  const [leadStatusFilter, setLeadStatusFilter] = useState('all');
  const [renewalState, setRenewalState] = useState('pending');
  const [renewalPage, setRenewalPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [signalMarket, setSignalMarket] = useState('all');
  const [signalStatus, setSignalStatus] = useState('all');
  const [signalPage, setSignalPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [detailVersion, setDetailVersion] = useState(0);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [issued, setIssued] = useState(null);
  const [copied, setCopied] = useState(false);

  const memberParams = new URLSearchParams({ q: search, filter, page: String(page), renewalState, renewalPage: String(renewalPage) });
  const members = useAdminResource(isBrokerStaff ? null : `/api/admin/memberships?${memberParams}`);

  const leadParams = new URLSearchParams();
  if (leadBrokerFilter !== 'all') leadParams.set('brokerId', leadBrokerFilter);
  if (leadTypeFilter !== 'all') leadParams.set('leadType', leadTypeFilter);
  if (leadStatusFilter !== 'all') leadParams.set('status', leadStatusFilter);
  const partnerLeads = useAdminResource(`/api/admin/partner-leads?${leadParams.toString()}`, tab === 'overview' || tab === 'partner_leads');

  const system = useAdminResource(isBrokerStaff ? null : '/api/admin/system', !isBrokerStaff && (tab === 'overview' || tab === 'system'));
  const audit = useAdminResource(isBrokerStaff ? null : `/api/admin/audit?page=${auditPage}`, !isBrokerStaff && tab === 'audit');
  const signals = useAdminResource(isBrokerStaff ? null : `/api/admin/signals?${new URLSearchParams({ market: signalMarket, status: signalStatus, page: String(signalPage) })}`, !isBrokerStaff && tab === 'signals');

  const data = members?.data, summary = data?.summary;
  const navList = isBrokerStaff
    ? [['partner_leads', `ลูกค้า ${initialBrokerRole.brokerName}`, UserPlus]]
    : DEFAULT_NAV;
  function review(value){setError('');setMessage('');setDraft({...value,body:{...value.body,operationId:crypto.randomUUID()}});}
  async function act(body){
    if(busy)return;setBusy(true);setError('');setMessage('');
    try{
      const response=await fetch('/api/admin/memberships',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
      const payload=await response.json();
      if(!response.ok){setError(ERRORS[payload.error]||'ทำรายการไม่สำเร็จ กรุณารีเฟรชข้อมูล');return;}
      setMessage(`${draft.title}สำเร็จ · ${draft.memberName}`);
      if(payload.code){setIssued({code:payload.code,id:payload.codeId,name:draft.memberName});setCopied(false);setSelected(null);}
      setDraft(null);setDetailVersion(value=>value+1);members.reload();audit.reload();
    }catch{setError(['issue-code','grant-ai-credits'].includes(body.action)?'ยังไม่ได้รับคำตอบจากเซิร์ฟเวอร์ กดยืนยันรายการเดิมอีกครั้งได้ ระบบจะไม่ทำซ้ำ':'ยังไม่ได้รับคำตอบจากเซิร์ฟเวอร์ กรุณาปิดหน้าต่างและรีเฟรชตรวจสถานะก่อนทำรายการอีกครั้ง');}
    finally{setBusy(false);}
  }
  function openPending(){setTab('members');setFilter('pending');setSearch('');setQuery('');setPage(1);}
  function refresh(){members.reload();if(tab==='overview'||tab==='system')system.reload();if(tab==='audit')audit.reload();if(tab==='signals')signals.reload();}
  async function copyCode(){try{await navigator.clipboard.writeText(issued.code);setCopied(true);}catch{setError('คัดลอกไม่ได้ กรุณาเลือกโค้ดแล้วคัดลอกด้วยตนเอง');}}
  return <div className="account-page admin-page admin-operations">
    <header className="account-topbar">
      <a className="account-brand" href="/"><span><Image src="/nugaom-mascot.png" width={38} height={38} alt=""/></span><span><strong>Nugaom AI Pick</strong><small>ศูนย์ดูแลลูกค้า</small></span></a>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <a className="account-back" href="/account"><ArrowLeft size={16}/>บัญชีของฉัน</a>
        <button
          type="button"
          className="account-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/account';
          }}
        >
          <LogOut size={15}/> ออกจากระบบ
        </button>
      </div>
    </header>
    <div className="account-hero"><div className="account-hero-inner"><span className="account-kicker">สำหรับผู้ดูแล</span><h1>จัดการลูกค้า <em>และดูแลสัญญาณ</em></h1><p>ข้อมูลสมาชิกจาก LINE รายการต่ออายุ และเหตุการณ์สแกนจากระบบเดียวกัน</p></div></div>
    <div className="account-layout"><aside className="account-nav"><span className="account-nav-label">{isBrokerStaff ? 'เจ้าหน้าที่ บล.' : 'ศูนย์ควบคุม'}</span>{navList.map(([id,label,Icon])=><button key={id} className={tab===id?'selected':''} onClick={()=>{setTab(id);setError('');}}><Icon size={18}/>{label}{id==='members'&&summary?.pendingPortfolios>0&&<i>{summary.pendingPortfolios}</i>}{id==='renewals'&&summary?.pendingRenewals>0&&<i>{summary.pendingRenewals}</i>}{id==='partner_leads'&&partnerLeads?.data?.summary?.newLeads>0&&<i>{partnerLeads.data.summary.newLeads}</i>}</button>)}{!isBrokerStaff&&<a className="admin-nav-link" href="/team"><Users size={17}/>กล่องงานทีมและชุมชน</a>}<a className="admin-nav-link" href="/"><ArrowLeft size={17}/>กลับหน้าตลาด</a></aside>
      <main className="account-main">
        {!draft&&error&&<div className="account-alert error" role="alert"><CircleAlert size={17}/>{error}</div>}{message&&<div className="account-alert success" role="status"><Check size={17}/>{message}</div>}
        {issued&&<div className="account-issued" role="status"><div className="admin-issued-head"><strong>โค้ดรายเดือนของ {issued.name}</strong><button className="account-secondary" onClick={()=>setIssued(null)} aria-label="ซ่อนโค้ด"><X size={16}/></button></div><code>{issued.code}</code><span>อ้างอิง {issued.id?.slice(0,8)} · ใช้ได้หนึ่งครั้งภายใน 30 วัน ระบบเก็บเฉพาะแฮชของโค้ด ส่งให้สมาชิกผ่านช่องทางที่คุณดูแล</span><button className="account-secondary" onClick={copyCode}><Copy size={15}/>{copied?'คัดลอกแล้ว':'คัดลอกโค้ด'}</button></div>}
        {tab==='overview'&&<>
          <section className="account-card"><SectionTitle title="ภาพรวมงานวันนี้" detail={`ข้อมูลสมาชิกอัปเดต ${date(data?.updatedAt)}`} onRefresh={refresh} loading={members?.loading||system?.loading}/><ResourceNotice resource={members}/>{summary&&<><div className="admin-stat-grid"><article><span>ลูกค้า LINE ทั้งหมด</span><strong>{summary.total}</strong><small>รวมคนที่ยังไม่แจ้งพอร์ต</small></article><article><span>กำลังทดลองใช้ฟรี</span><strong>{summary.trials}</strong><small>สิทธิทดลอง 14 วัน</small></article><article><span>สมาชิกที่มีสิทธิ</span><strong>{summary.subscribers}</strong><small>ต่ออายุแล้ว</small></article><article><span>สิทธิหมดอายุ</span><strong>{summary.expired}</strong><small>รอต่ออายุ</small></article></div><div className="admin-queue-grid"><button onClick={openPending}><span><ShieldCheck size={20}/>บัญชีหุ้นรอตรวจ</span><strong>{summary.pendingPortfolios}</strong><ArrowRight size={18}/></button><button onClick={()=>{setTab('renewals');setRenewalState('pending');setRenewalPage(1);}}><span><Wallet size={20}/>คำขอต่ออายุ</span><strong>{summary.pendingRenewals}</strong><ArrowRight size={18}/></button><button onClick={()=>{setTab('partner_leads');}}><span><UserPlus size={20}/>ลูกค้าเปิดพอร์ต / ยืนยัน VIP</span><strong>{partnerLeads.data?.summary?.newLeads ?? 0}</strong><ArrowRight size={18}/></button></div><p className="admin-explainer">ลูกค้าที่ยังไม่แจ้งพอร์ต / ต้องแจ้งใหม่ {summary.onboarding} คน ตรวจบัญชีหุ้นจากหลักฐานก่อนออกโค้ดหรืออนุมัติสมาชิก</p></>}</section>
          <ResourceNotice resource={system}/>{system?.data&&<><LaunchPanel launch={system.data.launch}/><section className="account-card"><SectionTitle title="สัญญาณที่กำลังติดตาม" detail="แสดงสถานะจากบันทึกระบบ" onRefresh={system.reload} loading={system.loading}/><div className="admin-stat-grid compact"><article><span>รอเข้าเงื่อนไข</span><strong>{system.data.outcomes.WAITING_FOR_ENTRY||0}</strong></article><article><span>เข้าแล้ว ยังติดตาม</span><strong>{system.data.outcomes.OPEN||0}</strong></article><article><span>ถึงเป้าหมาย</span><strong>{system.data.outcomes.TARGET||0}</strong></article><article><span>รอตรวจข้อมูล</span><strong>{(system.data.outcomes.REVIEW||0)+(system.data.outcomes.AMBIGUOUS||0)}</strong></article></div><button className="account-secondary" onClick={()=>setTab('signals')}>ดูราคาเข้า–ออกและผลลัพธ์<ArrowRight size={16}/></button></section></>}
        </>}
        {tab==='members'&&<section className="account-card"><SectionTitle title="สมาชิกทั้งหมด" detail="ค้นหาลูกค้า LINE และจัดการสิทธิจากรายละเอียดสมาชิก" onRefresh={members.reload} loading={members.loading}/><div className="admin-toolbar"><form className="admin-search" onSubmit={event=>{event.preventDefault();setSearch(query.trim());setPage(1);}}><Search size={17}/><input aria-label="ค้นหาสมาชิก" value={query} maxLength={80} onChange={event=>setQuery(event.target.value)} placeholder="ชื่อ โบรกเกอร์ หรือเลขพอร์ต 4 หลักท้าย"/><button className="account-secondary">ค้นหา</button></form><label>สถานะ<select value={filter} onChange={event=>{setFilter(event.target.value);setPage(1);}}><option value="all">ทั้งหมด</option><option value="pending">รอตรวจพอร์ต</option><option value="trial">กำลังทดลอง</option><option value="subscriber">สมาชิก</option><option value="expired">หมดอายุ</option><option value="onboarding">ยังไม่แจ้งพอร์ต</option><option value="portfolio-fix">ต้องแจ้งใหม่</option></select></label></div><ResourceNotice resource={members}/>{data&&<><div className="admin-member-list">{data.members.map(member=><article key={member.id}><MemberIdentity member={member}/><div className="admin-member-meta"><Status value={member.tier}>{member.tierLabel}</Status><small>{member.portfolio_status==='pending'?'รอตรวจพอร์ต':member.portfolio_status==='verified'?'บัญชีหุ้นยืนยันแล้ว':'ยังไม่ยืนยันบัญชีหุ้น'}</small><small>เครดิต AI {member.ai_credits}</small></div><button className="account-secondary" onClick={()=>setSelected(member.id)} disabled={members.loading}>ดูและจัดการ<ArrowRight size={15}/></button></article>)}</div>{!data.members.length&&<p className="account-empty">ไม่พบสมาชิกในตัวกรองนี้</p>}<Pager data={data} onPage={setPage} loading={members.loading}/></>}</section>}
        {tab==='renewals'&&<section className="account-card"><SectionTitle title="คำขอต่ออายุ" detail="อนุมัติหลังตรวจยอดรับชำระจริง สิทธิเดิมที่เหลืออยู่จะต่อเนื่อง" onRefresh={members.reload} loading={members.loading}/><div className="admin-toolbar"><label>รายการ<select value={renewalState} onChange={event=>{setRenewalState(event.target.value);setRenewalPage(1);}}><option value="pending">รอตรวจ</option><option value="approved">อนุมัติแล้ว</option><option value="rejected">ปฏิเสธแล้ว</option><option value="all">ทั้งหมด</option></select></label></div><ResourceNotice resource={members}/>{data&&<><div className="admin-renewal-list">{data.renewals.map(item=><article key={item.id}><div><strong>{item.display_name}</strong><p>{item.broker} · ••{item.portfolio_last4}</p><small>ขอเมื่อ {date(item.created_at)}</small>{item.resolved_at&&<small>จัดการ {date(item.resolved_at)} · {item.resolved_by_name}</small>}</div><div className="admin-row-actions"><Status value={item.status}>{({pending:'รอตรวจ',approved:'อนุมัติแล้ว',rejected:'ปฏิเสธแล้ว'})[item.status]}</Status><button className="account-secondary" onClick={()=>setSelected(item.member_id)}>รายละเอียดสมาชิก</button>{item.status==='pending'&&<><button className="account-primary" disabled={members.loading} onClick={()=>review({body:{action:'approve-renewal',requestId:item.id},title:'อนุมัติต่ออายุ',detail:'เปิดสิทธิอีก 30 วันหลังตรวจยอดชำระแล้ว',memberName:item.display_name})}>ตรวจยอดและเปิดสิทธิ</button><button className="account-secondary" disabled={members.loading} onClick={()=>review({body:{action:'reject-renewal',requestId:item.id},title:'ปฏิเสธคำขอต่ออายุ',detail:'สิทธิเดิมยังคงอยู่ ลูกค้าสามารถส่งคำขอใหม่ได้',memberName:item.display_name})}>ปฏิเสธคำขอ</button></>}</div></article>)}</div>{!data.renewals.length&&<p className="account-empty">ไม่มีคำขอในตัวกรองนี้</p>}<Pager data={{total:data.renewalTotal,page:data.renewalPage,pageSize:data.renewalPageSize}} onPage={setRenewalPage} loading={members.loading}/></>}</section>}
        {tab==='partner_leads'&&<section className="account-card">
          <SectionTitle
            title={isBrokerStaff ? `รายชื่อลูกค้า บล. ${initialBrokerRole.brokerName}` : 'รายชื่อลูกค้าเปิดพอร์ต & แจ้งเลขพอร์ต VIP (Pi, Trinity, ASL)'}
            detail={isBrokerStaff ? 'ข้อมูลเฉพาะของโบรคเกอร์ท่าน (Multi-Tenant Isolation) พร้อมแจ้งเตือนแบบเรียลไทม์' : 'ข้อมูลบันทึกลง SQLite partner_account_leads พร้อมแยกสถานะพอร์ตและยิงแจ้งเตือน Telegram ทันที'}
            onRefresh={partnerLeads.reload}
            loading={partnerLeads.loading}
          />
          <ResourceNotice resource={partnerLeads}/>
          {partnerLeads.data&&<>
            {isBrokerStaff && (
              <div style={{ padding: '12px 16px', borderRadius: '14px', background: 'rgba(56, 189, 248, 0.1)', color: '#7dd3fc', fontSize: '12px', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🛡️</span>
                <span>ระบบ Multi-Tenant จำกัดสิทธิ์: ท่านสามารถเข้าดูและจัดการได้เฉพาะรายชื่อลูกค้าของ {initialBrokerRole.brokerName} เท่านั้น</span>
              </div>
            )}

            <div className="admin-stat-grid compact" style={{marginBottom:'16px'}}>
              <article><span>รายการทั้งหมด</span><strong>{partnerLeads.data.summary?.totalLeads||0}</strong></article>
              <article><span>รอติดต่อ (ใหม่)</span><strong style={{color:'#f59e0b'}}>{partnerLeads.data.summary?.newLeads||0}</strong></article>
              <article><span>ติดต่อแล้ว</span><strong style={{color:'#38bdf8'}}>{partnerLeads.data.summary?.contactedLeads||0}</strong></article>
              <article><span>อนุมัติ/เปิดพอร์ตแล้ว</span><strong style={{color:'#10b981'}}>{partnerLeads.data.summary?.openedLeads||0}</strong></article>
              <article><span>👤 มีพอร์ตแล้ว (ยืนยันสิทธิ์)</span><strong style={{color:'#34d399'}}>{partnerLeads.data.summary?.existingPortLeads||0}</strong></article>
              <article><span>✨ ขอเปิดบัญชีใหม่</span><strong style={{color:'#818cf8'}}>{partnerLeads.data.summary?.newAccountLeads||0}</strong></article>
              {!isBrokerStaff&&<>
                <article><span>บล.พาย (003)</span><strong style={{color:'#c084fc'}}>{partnerLeads.data.summary?.piLeads||0}</strong></article>
                <article><span>บล.ทรีนีตี้ (022)</span><strong style={{color:'#38bdf8'}}>{partnerLeads.data.summary?.trinityLeads||0}</strong></article>
                <article><span>บล.เอเอสแอล (050)</span><strong style={{color:'#fbbf24'}}>{partnerLeads.data.summary?.aslLeads||0}</strong></article>
              </>}
            </div>

            {/* Liquid Glass Multi-Filter Toolbar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', margin: '14px 0 18px', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', backdropFilter: 'blur(16px)' }}>
              {!isBrokerStaff && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <small style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, marginRight: '4px' }}>โบรคเกอร์:</small>
                  {[
                    ['all', 'ทั้งหมด'],
                    ['003', '🥧 บล.พาย (003)'],
                    ['022', '🌟 บล.ทรีนีตี้ (022)'],
                    ['050', '⚡ บล.เอเอสแอล (050)'],
                  ].map(([bVal, bLabel]) => (
                    <button
                      key={bVal}
                      type="button"
                      onClick={() => setLeadBrokerFilter(bVal)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '9999px',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: leadBrokerFilter === bVal ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.05)',
                        color: leadBrokerFilter === bVal ? '#38bdf8' : '#94a3b8',
                        boxShadow: leadBrokerFilter === bVal ? '0 0 14px rgba(56,189,248,0.25)' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {bLabel}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <small style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, marginRight: '4px' }}>ประเภท:</small>
                {[
                  ['all', 'ทั้งหมด'],
                  ['existing_port', '👤 มีพอร์ตแล้ว (ยืนยันเลขพอร์ต)'],
                  ['new_account', '✨ ขอเปิดบัญชีใหม่'],
                ].map(([tVal, tLabel]) => (
                  <button
                    key={tVal}
                    type="button"
                    onClick={() => setLeadTypeFilter(tVal)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '9999px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: leadTypeFilter === tVal ? 'rgba(52,211,153,0.22)' : 'rgba(255,255,255,0.05)',
                      color: leadTypeFilter === tVal ? '#34d399' : '#94a3b8',
                      boxShadow: leadTypeFilter === tVal ? '0 0 14px rgba(52,211,153,0.25)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {tLabel}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <small style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, marginRight: '4px' }}>สถานะ:</small>
                {[
                  ['all', 'ทั้งหมด'],
                  ['new', '⏳ รอติดต่อ'],
                  ['contacted', '📞 ติดต่อแล้ว'],
                  ['account_opened', '👑 สำเร็จแล้ว'],
                ].map(([sVal, sLabel]) => (
                  <button
                    key={sVal}
                    type="button"
                    onClick={() => setLeadStatusFilter(sVal)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '9999px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: leadStatusFilter === sVal ? 'rgba(168,85,247,0.22)' : 'rgba(255,255,255,0.05)',
                      color: leadStatusFilter === sVal ? '#c084fc' : '#94a3b8',
                      boxShadow: leadStatusFilter === sVal ? '0 0 14px rgba(168,85,247,0.25)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {sLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-renewal-list">
              {(partnerLeads.data.leads||[]).map(lead=>{
                let interestsList=[];
                try{interestsList=JSON.parse(lead.interests||'[]');}catch{interestsList=[];}
                return <article key={lead.id} style={{ borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: 'none', backdropFilter: 'blur(16px)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                      <span style={{
                        background: lead.broker_id==='003'?'rgba(168,85,247,0.18)':lead.broker_id==='050'?'rgba(245,158,11,0.18)':'rgba(34,211,238,0.18)',
                        color: lead.broker_id==='003'?'#c084fc':lead.broker_id==='050'?'#fbbf24':'#38bdf8',
                        border: 'none',
                        fontSize:'10px',
                        fontWeight:800,
                        padding:'3px 8px',
                        borderRadius:'9999px'
                      }}>
                        [{lead.broker_id}] {lead.broker_name}
                      </span>
                      {lead.lead_type === 'existing_port' ? (
                        <span style={{
                          background: 'rgba(16,185,129,0.18)',
                          color: '#34d399',
                          border: 'none',
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '9999px'
                        }}>
                          👤 มีพอร์ตแล้ว: <b>{lead.account_no || 'ไม่ระบุ'}</b>
                        </span>
                      ) : (
                        <span style={{
                          background: 'rgba(56,189,248,0.14)',
                          color: '#38bdf8',
                          border: 'none',
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '9999px'
                        }}>
                          ✨ ขอเปิดบัญชีใหม่
                        </span>
                      )}
                      <strong style={{ fontSize: '15px' }}>{lead.full_name}</strong>
                    </div>
                    <p style={{margin:'6px 0 4px', fontSize: '13px'}}>
                      📞 <b>{lead.phone}</b> {lead.line_id?`· LINE: ${lead.line_id}`:''} {lead.email?`· ${lead.email}`:''}
                    </p>
                    {interestsList.length>0&&<small style={{display:'block',color:'#94a3b8', marginTop:'2px'}}>🎯 สนใจ: {interestsList.join(', ')}</small>}
                    {lead.notes&&<small style={{display:'block',color:'#cbd5e1', marginTop:'2px'}}>📝 หมายเหตุ: {lead.notes}</small>}
                    <small style={{display:'block',color:'#64748b', marginTop:'4px'}}>ยื่นเมื่อ {date(lead.created_at)}</small>
                  </div>
                  <div className="admin-row-actions">
                    <Status value={lead.status==='account_opened'?'subscriber':lead.status==='contacted'?'trial':'pending'}>
                      {lead.status==='new'?'รอติดต่อ':lead.status==='contacted'?'ติดต่อแล้ว':lead.status==='account_opened'?(lead.lead_type==='existing_port'?'ยืนยันสิทธิ์แล้ว':'เปิดพอร์ตแล้ว'):lead.status}
                    </Status>
                    <button className="account-secondary" onClick={async()=>{try{await navigator.clipboard.writeText(`${lead.full_name} | โทร: ${lead.phone}${lead.line_id?` | LINE: ${lead.line_id}`:''}${lead.account_no?` | เลขพอร์ต: ${lead.account_no}`:''}`);setMessage(`คัดลอกข้อมูลติดต่อของ ${lead.full_name} แล้ว`);}catch{}}}>
                      <Copy size={14}/> คัดลอกติดต่อ
                    </button>
                    {!isBrokerStaff&&<button className="account-secondary" onClick={()=>{setTab('members');setFilter('all');setQuery(lead.full_name||'');setSearch((lead.full_name||'').trim());setPage(1);}}>
                      ค้นหาสมาชิก & ออกโค้ด VIP
                    </button>}
                    {lead.status==='new'&&<button className="account-primary" onClick={async()=>{await fetch('/api/admin/partner-leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:lead.id,status:'contacted'})});partnerLeads.reload();}}>ทำเครื่องหมาย: ติดต่อแล้ว</button>}
                    {lead.status==='contacted'&&<button className="account-primary" onClick={async()=>{await fetch('/api/admin/partner-leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:lead.id,status:'account_opened'})});partnerLeads.reload();}}>ทำเครื่องหมาย: {lead.lead_type==='existing_port'?'ยืนยันสิทธิ์ VIP สำเร็จ':'เปิดพอร์ตสำเร็จ'}</button>}
                  </div>
                </article>;
              })}
            </div>
            {!(partnerLeads.data.leads||[]).length&&<p className="account-empty">ไม่พบรายการในตัวกรองนี้</p>}
          </>}
        </section>}
        {tab==='telegram'&&<section className="account-card"><SectionTitle title="ศูนย์ยิงสัญญาณ Telegram VIP" detail="ส่งสัญญาณด่วน บรอดแคสต์ประกาศสำคัญ และตรวจสอบสถานะบอท" onRefresh={fetchBotStatus=>null} loading={false}/><AdminTelegramVip /></section>}
        {tab==='signals'&&<section className="account-card"><SectionTitle title="สัญญาณและผลลัพธ์" detail="ตรวจราคาเข้าจริงในบันทึก ราคาออก และลำดับแจ้งเตือน" onRefresh={signals.reload} loading={signals.loading}/><div className="admin-toolbar"><label>ตลาด<select value={signalMarket} onChange={event=>{setSignalMarket(event.target.value);setSignalPage(1);}}><option value="all">ทุกตลาด</option>{Object.entries(MARKET_NAMES).map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label><label>สถานะ<select value={signalStatus} onChange={event=>{setSignalStatus(event.target.value);setSignalPage(1);}}><option value="all">ทุกสถานะ</option>{Object.entries(SIGNAL_NAMES).map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label></div><ResourceNotice resource={signals}/>{signals.data&&<SignalsPanel data={signals.data} onPage={setSignalPage} loading={signals.loading}/>}</section>}
        {tab==='coaches'&&<section className="account-card"><CoachHub mode="admin"/></section>}
        {tab==='audit'&&<section className="account-card"><SectionTitle title="ประวัติรายการ" detail="ดูว่าใครจัดการสิทธิและเครดิตให้ลูกค้าคนไหน เมื่อไร" onRefresh={audit.reload} loading={audit.loading}/><ResourceNotice resource={audit}/>{audit.data&&<><AuditList events={audit.data.events}/><Pager data={audit.data} onPage={setAuditPage} loading={audit.loading}/></>}</section>}
        {tab==='system'&&<section className="account-card"><SectionTitle title="สถานะระบบและจุดที่ต้องแก้" detail={`อัปเดต ${date(system.data?.updatedAt)}`} onRefresh={system.reload} loading={system.loading}/><ResourceNotice resource={system}/>{system.data&&<SystemPanel system={system.data}/>}</section>}
      </main>
    </div><footer className="account-footer"><span>© 2026 Nugaom AI Pick</span><span>ข้อมูลนี้เปิดให้เฉพาะผู้ดูแลที่กำหนดในระบบ</span></footer>
    {selected&&<MemberDialog key={selected} id={selected} version={detailVersion} message={message} onClose={()=>setSelected(null)} onReview={review}/>}
    {draft&&<ReviewDialog key={draft.body.operationId} draft={draft} busy={busy} error={error} onClose={()=>{setDraft(null);setError('');}} onConfirm={act}/>}
  </div>;
}
