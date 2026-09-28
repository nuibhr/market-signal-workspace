'use client';

import SignalPlanBuilder from './signal-plan-builder.jsx';
import TradePlanCard from './trade-plan-card.jsx';

function format(value, digits = 2) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
}

export default function AnalysisRail({ asset, analysis, tradePlan, tradePlanState, aiState, aiResult, sourceState, barsCount = 0, latestDay, timeframe = '1D', timeframeId = '1d', freshness, currentPrice, sourceLabel, onOpenAutomation, onOpenContact }) {
  const connected = Boolean(analysis);
  const current = connected && freshness === 'recent';
  const trend = analysis?.trend === 'up' ? 'แนวโน้มขาขึ้น' : analysis?.trend === 'down' ? 'แนวโน้มขาลง' : 'แกว่งในกรอบ';
  const aiUnavailableMessage = aiState === 'MEMBERSHIP_REQUIRED' ? 'สรุปด้วย AI สำหรับสมาชิก เข้าสู่ระบบ LINE และแจ้งเลขพอร์ตเพื่อทดลอง 14 วัน'
    : aiState === 'MARKET_NOT_SUPPORTED' ? 'กราฟและกติกาคำนวณจากแท่งจริงแล้ว · สรุป AI ในเครื่องยังรองรับเฉพาะหุ้นไทยและ DR'
    : aiState === 'MODEL_TIMEOUT' ? 'โมเดลในเครื่องใช้เวลานานเกินกำหนด แผนจากกติกาด้านบนยังอ่านได้'
    : aiState === 'INVALID_MODEL_RESPONSE' ? 'โมเดลตอบไม่ครบตามรูปแบบ จึงไม่แสดงข้อความที่อาจคลาดเคลื่อน'
      : aiState === 'LOCAL_MODEL_ONLY' ? 'AI ในเครื่องเปิดเฉพาะหน้าเว็บที่รันบน Mac เครื่องนี้'
        : 'โมเดลในเครื่องยังไม่พร้อม แผนจากกติกาด้านบนยังอ่านได้';
  return <aside className="insight-rail" aria-label="การวิเคราะห์สินทรัพย์ที่เลือก">
    <article id="section-signals" className="panel technical-rail">
      <div className="rail-kicker"><span>AI ANALYSIS / {asset.symbol}</span><span className="rail-mode">{current ? aiResult ? 'QWEN3 LOCAL' : 'RULE ENGINE' : connected ? 'HISTORICAL' : barsCount > 0 ? 'INSUFFICIENT' : 'NO FEED'}</span></div>
      <h2>ภาพเทคนิคจากกราฟ</h2>
      {connected ? <>
        <div className={`analysis-trend ${analysis.trend}`}><i /> <span>{trend}</span><small>{timeframe} · {latestDay}</small></div>
        {!current && <div className="analysis-plan"><span className="analysis-label">HISTORICAL DATA</span><strong>พักแผนจนกว่าจะมีแท่งล่าสุด</strong><p>ข้อมูลแท่งนี้เก่าเกินเกณฑ์สำหรับแผนใหม่ ตัวเลขด้านล่างแสดงเพื่ออ่านกราฟย้อนหลังเท่านั้น</p></div>}
        {current && <div className="ai-narrative" aria-live="polite"><div className="ai-narrative-heading"><span>✦ &nbsp; AI ANALYST · LOCAL</span><small>{aiResult ? aiResult.model : aiState === 'loading' ? 'กำลังประมวลผล' : 'ไม่พร้อมใช้งาน'}</small></div>{aiResult ? <><strong>{aiResult.narrative.summary}</strong><p><b>ข้อจำกัด:</b> {aiResult.narrative.risk}</p></> : aiState === 'loading' ? <div className="ai-skeleton" aria-busy="true" aria-label="กำลังเขียนสรุป AI"><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /></div> : <p>{aiUnavailableMessage}</p>}</div>}
        <div className="analysis-divider" />
        <div className="analysis-section-heading"><span>แนวรับ · แนวต้าน</span><small>Swing ล่าสุด 90 แท่ง</small></div>
        <div className="sr-grid"><div className="support"><small>SUPPORT</small><strong>{format(analysis.support)}</strong></div><div className="resistance"><small>RESISTANCE</small><strong>{format(analysis.resistance)}</strong></div></div>
        <div className="analysis-section-heading"><span>อินดิเคเตอร์</span><small>คำนวณจากแท่ง {timeframe}</small></div>
        <div className="indicator-metrics"><div><span>EMA 20 / 50</span><strong>{format(analysis.ema20)} <em>/</em> {format(analysis.ema50)}</strong></div><div><span>RSI 14</span><strong>{format(analysis.rsi14, 1)}</strong></div><div><span>MACD Histogram</span><strong className={analysis.macdHistogram >= 0 ? 'positive' : 'negative'}>{format(analysis.macdHistogram, 3)}</strong></div></div>
        <div className="analysis-section-heading"><span>จุดสแกน</span><small>ตาม symbol ที่เลือก</small></div>
        <div className="scan-events">{current ? analysis.events.map(event => <div key={event.label} className={`scan-event ${event.tone}`}><i /><span>{event.label}</span></div>) : <div className="scan-event flat"><i /><span>พักการสแกนเพราะข้อมูลย้อนหลังเก่า</span></div>}</div>
        <p className="analysis-disclosure">อินดิเคเตอร์คำนวณจากแท่งจริง · โมเดล AI ในเครื่องช่วยเขียนสรุปเท่านั้น · แผนเทคนิค 3 กรอบเวลาแสดงด้านล่าง</p>
      </> : sourceState === 'loading' && (asset.feed === 'settrade-daily' || asset.id === 'us' && timeframeId === '1d') ? <div className="rail-loading-skeleton" aria-busy="true" aria-label={`กำลังวิเคราะห์ ${asset.symbol}`}><div className="rail-loading-title"><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /></div><div className="rail-loading-plan"><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /></div><div className="rail-loading-levels"><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /></div></div> : <div className="analysis-no-feed"><div className="analysis-no-feed-icon">◇</div><strong>{barsCount > 0 ? `ข้อมูลยังไม่พอสำหรับ ${asset.symbol}` : `รอแท่งราคาของ ${asset.symbol}`}</strong><p>{barsCount > 0 ? `มีแท่ง ${timeframe} ${barsCount} แท่ง; ต้องมีอย่างน้อย 50 แท่งเพื่อคำนวณ EMA50 และแผน` : asset.feed === 'settrade-daily' || asset.id === 'us' && timeframeId === '1d' ? `ฟีด ${timeframe} ยังไม่พร้อมสำหรับ symbol นี้` : 'หมวดนี้อยู่ในรายการค้นหาแล้ว รอเชื่อมข้อมูลราคาเพื่อเปิดแผนและจุดสแกน'}</p><span>แนวรับ แนวต้าน และ AI analysis จะไม่คำนวณจากราคาตัวอย่าง</span></div>}
    </article>
    <TradePlanCard plan={tradePlan} state={tradePlanState} asset={asset} />
    <SignalPlanBuilder asset={asset} timeframe={timeframeId} tradePlan={tradePlan} freshness={freshness} currentPrice={currentPrice} sourceLabel={sourceLabel} />
    <article className="panel workflow-card"><div className="rail-kicker">SIGNAL LIFECYCLE</div><h3>จากจุดสแกน ถึงผลจริง</h3><div className="workflow-step"><i className={`step-dot ${current ? 'done' : ''}`} /><span>01&nbsp; ราคาและอินดิเคเตอร์</span><b>{current ? 'พร้อม' : connected ? 'ข้อมูลเก่า' : 'รอฟีด'}</b></div><div className="workflow-step"><i className={`step-dot ${tradePlan?.tradeAllowed ? 'done' : ''}`} /><span>02&nbsp; แผนเทคนิค 3 กรอบเวลา</span><b>{tradePlan?.tradeAllowed ? 'พร้อมเฝ้ารอ' : tradePlan ? 'WAIT' : 'รอข้อมูล'}</b></div><div className="workflow-step"><i className="step-dot" /><span>03&nbsp; AutoPick แจ้งเข้า / TP / SL</span><b>{asset.id === 'thai' ? 'นำร่อง' : 'รอฟีด'}</b></div><div className="workflow-step"><i className="step-dot" /><span>04&nbsp; Ledger สัญญาณ</span><b>{asset.id === 'thai' ? 'นำร่อง' : 'รอฟีด'}</b></div><button onClick={onOpenAutomation}>ดู AutoPick <span>↗</span></button></article>
    <button className="rail-contact" onClick={onOpenContact}><span>✦</span><span><strong>คุยกับทีม</strong><small>นักวิเคราะห์ / การตลาด · DEMO</small></span><b>↗</b></button>
  </aside>;
}
