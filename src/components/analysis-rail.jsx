'use client';

import TradePlanCard from './trade-plan-card.jsx';

function format(value, digits = 2) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
}

export default function AnalysisRail({ asset, analysis, tradePlan, tradePlanState, aiState, aiResult, sourceState, barsCount = 0, latestDay, timeframe = '1D', timeframeId = '1d', freshness, onOpenAutomation }) {
  const connected = Boolean(analysis);
  const current = connected && freshness === 'recent';
  const trend = analysis?.trend === 'up' ? 'แนวโน้มขาขึ้น' : analysis?.trend === 'down' ? 'แนวโน้มขาลง' : 'แกว่งในกรอบ';
  const aiUnavailableMessage = 'ยังไม่มีบทสรุป AI สำหรับกราฟนี้';
  return <aside className="insight-rail" aria-label="การวิเคราะห์สินทรัพย์ที่เลือก">
    <article id="section-signals" className="panel technical-rail">
      <div className="rail-kicker"><span>AI ANALYSIS / {asset.symbol}</span><span className="rail-mode">{current ? 'ล่าสุด' : connected ? 'ย้อนหลัง' : 'รอข้อมูล'}</span></div>
      <h2>ภาพเทคนิคจากกราฟ</h2>
      {connected ? <>
        <div className={`analysis-trend ${analysis.trend}`}><i /> <span>{trend}</span><small>{timeframe} · {latestDay}</small></div>
        {!current && <div className="analysis-plan"><span className="analysis-label">HISTORICAL DATA</span><strong>พักแผนจนกว่าจะมีแท่งล่าสุด</strong><p>ข้อมูลแท่งนี้เก่าเกินเกณฑ์สำหรับแผนใหม่ ตัวเลขด้านล่างแสดงเพื่ออ่านกราฟย้อนหลังเท่านั้น</p></div>}
        {current && <div className="ai-narrative" aria-live="polite"><div className="ai-narrative-heading"><span>✦ &nbsp; บทสรุปตลาด</span><small>{aiState === 'loading' ? 'กำลังประมวลผล' : aiResult ? 'พร้อมอ่าน' : 'รอสรุป'}</small></div>{aiResult ? <><strong>{aiResult.narrative.summary}</strong><p><b>ข้อจำกัด:</b> {aiResult.narrative.risk}</p></> : aiState === 'loading' ? <div className="ai-skeleton" aria-busy="true" aria-label="กำลังเขียนสรุป AI"><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /></div> : <p>{aiUnavailableMessage}</p>}</div>}
        <div className="analysis-divider" />
        <div className="analysis-section-heading"><span>แนวรับ · แนวต้าน</span><small>Traditional Pivot · {analysis.levels?.period === 'month' ? 'เดือนก่อน' : analysis.levels?.period === 'week' ? 'สัปดาห์ก่อน' : 'วันก่อน'}</small></div>
        <div className="sr-grid"><div className="support"><small>SUPPORT</small><strong>{format(analysis.support)}</strong></div><div className="resistance"><small>RESISTANCE</small><strong>{format(analysis.resistance)}</strong></div></div>
        {analysis.levels?.rrPlan && <div className="analysis-plan"><strong>เป้าแผน 1:2 · {format(analysis.levels.rrPlan.target)}</strong><p>อ้างอิงเข้า {format(analysis.levels.rrPlan.entry)} · Stop {format(analysis.levels.rrPlan.stop)} · {analysis.levels.rrPlan.blocked ? 'รอ: มีแนวต้านขวางก่อนถึงเป้า' : 'รอยืนยันเงื่อนไขเข้า'}</p></div>}<details className="customer-indicators"><summary>ดูอินดิเคเตอร์บนกราฟ</summary>
        <div className="indicator-metrics"><div><span>EMA 20 / 50</span><strong>{format(analysis.ema20)} <em>/</em> {format(analysis.ema50)}</strong></div><div><span>RSI 14</span><strong>{format(analysis.rsi14, 1)}</strong></div><div><span>MACD Histogram</span><strong className={analysis.macdHistogram >= 0 ? 'positive' : 'negative'}>{format(analysis.macdHistogram, 3)}</strong></div></div>
        </details><div className="analysis-section-heading"><span>ภาพรวมจังหวะ</span></div>
        <div className="scan-events">{current ? analysis.events.map(event => <div key={event.label} className={`scan-event ${event.tone}`}><i /><span>{event.label}</span></div>) : <div className="scan-event flat"><i /><span>พักการสแกนเพราะข้อมูลย้อนหลังเก่า</span></div>}</div>
        <p className="analysis-disclosure">ระดับราคาอ้างอิงจากกราฟ · อ่านจุดเข้าที่ยืนยันแล้วในสัญญาณระบบ</p>
      </> : sourceState === 'loading' && (asset.feed === 'settrade-daily' || asset.id === 'us' && timeframeId === '1d') ? <div className="rail-loading-skeleton" aria-busy="true" aria-label={`กำลังวิเคราะห์ ${asset.symbol}`}><div className="rail-loading-title"><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /></div><div className="rail-loading-plan"><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /></div><div className="rail-loading-levels"><i className="ui-skeleton-line" /><i className="ui-skeleton-line" /></div></div> : <div className="analysis-no-feed"><div className="analysis-no-feed-icon">◇</div><strong>{barsCount > 0 ? `ข้อมูลยังไม่พอสำหรับ ${asset.symbol}` : `รอแท่งราคาของ ${asset.symbol}`}</strong><p>{barsCount > 0 ? `มีแท่ง ${timeframe} ${barsCount} แท่ง; ต้องมีอย่างน้อย 50 แท่งเพื่อคำนวณ EMA50 และแผน` : asset.feed === 'settrade-daily' || asset.id === 'us' && timeframeId === '1d' ? `ฟีด ${timeframe} ยังไม่พร้อมสำหรับ symbol นี้` : 'หมวดนี้อยู่ในรายการค้นหาแล้ว รอเชื่อมข้อมูลราคาเพื่อเปิดแผนและจุดสแกน'}</p><span>แนวรับ แนวต้าน และ AI analysis จะไม่คำนวณจากราคาตัวอย่าง</span></div>}
    </article>
    <TradePlanCard plan={tradePlan} state={tradePlanState} asset={asset} />
    <article className="panel workflow-card"><h3>ติดตามสัญญาณจากระบบ</h3><p>ดูหุ้นที่ระบบจับตา ราคาเข้า เป้าหมาย และผลลัพธ์ที่บันทึกไว้</p><button onClick={onOpenAutomation}>ดูสัญญาณล่าสุด ↗</button></article>
  </aside>;
}
