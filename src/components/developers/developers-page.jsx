'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  Braces,
  Check,
  Code2,
  Copy,
  Cpu,
  Layers,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import { analyzeMarketStructure } from '../../developers/structure.mjs';
import MobileDock from '../mobile-dock.jsx';
import SoundMonitorPill from '../monitor/sound-monitor-pill.jsx';
import ProToolsNav from '../pro-tools-nav.jsx';
import '../../app/landing.css';
import '../../app/market-pages.css';

const SAMPLE_BULLISH = Array.from({ length: 30 }, (_, i) => ({
  time: 1700000000 + i * 3600,
  open: Math.round((100 + i * 1.2) * 10) / 10,
  high: Math.round((102 + i * 1.2) * 10) / 10,
  low: Math.round((99.5 + i * 1.2) * 10) / 10,
  close: Math.round((101.5 + i * 1.2) * 10) / 10,
  volume: 1500 + i * 100,
}));

const SAMPLE_BEARISH = Array.from({ length: 30 }, (_, i) => ({
  time: 1700000000 + i * 3600,
  open: Math.round((150 - i * 1.1) * 10) / 10,
  high: Math.round((151 - i * 1.1) * 10) / 10,
  low: Math.round((148 - i * 1.1) * 10) / 10,
  close: Math.round((148.5 - i * 1.1) * 10) / 10,
  volume: 1800 + i * 80,
}));

export default function DevelopersPage() {
  const [activeTab, setActiveTab] = useState('curl');
  const [jsonInput, setJsonInput] = useState(JSON.stringify(SAMPLE_BULLISH, null, 2));
  const [result, setResult] = useState(() => analyzeMarketStructure(SAMPLE_BULLISH));
  const [copied, setCopied] = useState(false);

  const handlePreset = (type) => {
    const data = type === 'bullish' ? SAMPLE_BULLISH : SAMPLE_BEARISH;
    const str = JSON.stringify(data, null, 2);
    setJsonInput(str);
    setResult(analyzeMarketStructure(data));
  };

  const handleAnalyze = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const res = analyzeMarketStructure(parsed);
      setResult(res);
    } catch (err) {
      setResult({
        status: 'error',
        code: 'PARSE_FAILED',
        message: 'JSON ไม่ถูกต้อง: ' + err.message,
      });
    }
  };

  const copyCode = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const curlSnippet = `curl -X POST http://127.0.0.1:3100/api/developers/structure \\
  -H "Content-Type: application/json" \\
  -d '${jsonInput.replace(/\n/g, '').slice(0, 150)}...'`;

  const pythonSnippet = `import requests

url = "http://127.0.0.1:3100/api/developers/structure"
candles = ${jsonInput}

response = requests.post(url, json={"candles": candles})
data = response.json()
print("Trend:", data["structure"]["trend"])
print("Plan:", data["plan"])`;

  const mql5Snippet = `// MQL5 WebRequest Snippet for Expert Advisors (MT5)
string url = "http://127.0.0.1:3100/api/developers/structure";
string headers = "Content-Type: application/json\\r\\n";
char postData[], resultData[];
string resultHeaders;

string jsonBody = "{\\"candles\\": [...]}";
StringToCharArray(jsonBody, postData);

int res = WebRequest("POST", url, headers, 3000, postData, resultData, resultHeaders);
if (res == 200) {
   Print("Structure analysis received successfully!");
}`;

  return (
    <div className="ng-market-page">
      <header className="ng-market-header">
        <div className="ng-market-header-inner">
          <div className="ng-brand-area">
            <Link href="/#pro-analysis-suite" className="ng-back-link" title="กลับสู่หน้ารวมเครื่องมือสถาบัน">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <span className="ng-page-badge">DEVELOPER API PLAYGROUND</span>
              <h1 className="ng-page-title">SMC Structure API สำหรับบอท &amp; EA</h1>
            </div>
          </div>
          <div className="ng-header-right">
            <SoundMonitorPill />
            <Link href="/risk" className="ng-account-pill">
              คำนวณขนาดไม้
            </Link>
          </div>
        </div>
      </header>

      {/* Pro Suite Quick Switcher Bar */}
      <ProToolsNav current="developers" />

      <main className="ng-market-content">
        {/* Banner */}
        <div className="ng-dev-banner">
          <div className="ng-dev-banner-left">
            <div className="ng-dev-icon-circle">
              <Braces size={24} className="ng-text-accent" />
            </div>
            <div>
              <h3>Bring Your Own Candles — ส่งแท่งเทียนมา รับโครงสร้างตลาดกลับไป</h3>
              <p>
                ส่งแท่งเทียนที่คุณมี 40 - 500 แท่ง รับ Swing High/Low, BOS/CHoCH, Order Block, FVG,
                และแผนเทรด 2R กลับเป็น JSON ทันที ปราศจากการดึงราคาแทนหรือเก็บข้อมูลส่วนบุคคล
              </p>
            </div>
          </div>
          <div className="ng-dev-banner-right">
            <span className="ng-latency-pill"><Zap size={14} /> Latency ~15ms</span>
          </div>
        </div>

        {/* Playground Grid: Left Input & Code, Right Output */}
        <div className="ng-calc-grid">
          {/* Left Column: JSON Input & Presets */}
          <section className="ng-calc-card">
            <div className="ng-card-heading">
              <div className="ng-card-icon-title">
                <Code2 size={20} className="ng-text-accent" />
                <h2>ชุดแท่งเทียนทดสอบ (OHLCV Input)</h2>
              </div>
              <div className="ng-pill-group">
                <button
                  type="button"
                  className="ng-preset-pill is-active"
                  onClick={() => handlePreset('bullish')}
                >
                  Bullish Preset
                </button>
                <button
                  type="button"
                  className="ng-preset-pill"
                  onClick={() => handlePreset('bearish')}
                >
                  Bearish Preset
                </button>
              </div>
            </div>

            <div className="ng-json-editor-wrap">
              <textarea
                className="ng-json-textarea"
                rows={16}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                spellCheck={false}
              />
            </div>

            <div className="ng-editor-actions">
              <button
                type="button"
                className="ng-action-primary-btn"
                onClick={handleAnalyze}
              >
                <Send size={15} />
                <span>ยิงคำขอวิเคราะห์ (Analyze Structure)</span>
              </button>
            </div>

            {/* Code Snippets Tabs */}
            <div className="ng-snippets-box">
              <div className="ng-snippets-nav">
                <span className="ng-snippets-title">ตัวอย่างโค้ดพร้อมใช้:</span>
                <div className="ng-snippets-tabs">
                  {['curl', 'python', 'mql5'].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`ng-snip-tab ${activeTab === tab ? 'is-active' : ''}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ng-snippet-code-wrap">
                <pre className="ng-code-pre">
                  <code>
                    {activeTab === 'curl' && curlSnippet}
                    {activeTab === 'python' && pythonSnippet}
                    {activeTab === 'mql5' && mql5Snippet}
                  </code>
                </pre>
                <button
                  type="button"
                  className="ng-copy-btn"
                  onClick={() => {
                    const txt = activeTab === 'curl' ? curlSnippet : activeTab === 'python' ? pythonSnippet : mql5Snippet;
                    copyCode(txt);
                  }}
                  title="คัดลอกโค้ด"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </section>

          {/* Right Column: Visual Analysis & JSON Response */}
          <section className="ng-calc-card ng-results-card">
            <div className="ng-card-heading">
              <div className="ng-card-icon-title">
                <Layers size={20} className="ng-text-accent" />
                <h2>ผลการวิเคราะห์โครงสร้าง (Structure Response)</h2>
              </div>
              <span className="ng-status-badge">
                {result.status === 'success' ? '200 OK' : 'ERROR'}
              </span>
            </div>

            {result.status === 'success' ? (
              <div className="ng-results-body">
                {/* Visual Highlights */}
                <div className="ng-metrics-2x2">
                  <div className="ng-metric-box">
                    <span className="ng-box-kicker">แนวโน้มตลาด (Trend)</span>
                    <strong className="ng-box-val ng-text-accent">
                      {result.structure?.trend?.toUpperCase()}
                    </strong>
                    <small>โซน: {result.structure?.currentZone}</small>
                  </div>
                  <div className="ng-metric-box">
                    <span className="ng-box-kicker">จุดสมดุล (Equilibrium)</span>
                    <strong className="ng-box-val">{result.structure?.equilibrium}</strong>
                    <small>High: {result.structure?.swingHigh} / Low: {result.structure?.swingLow}</small>
                  </div>
                  <div className="ng-metric-box ng-box-gain">
                    <span className="ng-box-kicker">แผนเทรดอัตโนมัติ</span>
                    <strong className="ng-box-val">
                      {result.plan?.bias} @ {result.plan?.entryPrice}
                    </strong>
                    <small>Target: {result.plan?.targetPrice} ({result.plan?.riskRewardRatio})</small>
                  </div>
                  <div className="ng-metric-box">
                    <span className="ng-box-kicker">Order Blocks / FVG</span>
                    <strong className="ng-box-val">
                      {result.structure?.orderBlocks?.length || 0} OB / {result.structure?.fairValueGaps?.length || 0} FVG
                    </strong>
                    <small>คัดเฉพาะโซนที่มีนัยสำคัญ</small>
                  </div>
                </div>

                {/* Pretty JSON Response */}
                <div className="ng-json-response-box">
                  <div className="ng-json-header">
                    <span>JSON RESPONSE (APPLICATION/JSON)</span>
                    <button
                      type="button"
                      className="ng-copy-mini-btn"
                      onClick={() => copyCode(JSON.stringify(result, null, 2))}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      <span>คัดลอก JSON</span>
                    </button>
                  </div>
                  <pre className="ng-response-pre">
                    <code>{JSON.stringify(result, null, 2)}</code>
                  </pre>
                </div>
              </div>
            ) : (
              <div className="ng-error-box">
                <p>{result.message}</p>
              </div>
            )}

            <div className="ng-calc-footer">
              <span className="ng-calc-note">
                * Endpoint: <code>POST /api/developers/structure</code> รองรับการเรียกจากบอทหรือ EA ภายนอกได้ทันที
              </span>
              <Link href="/calendar" className="ng-action-link">
                ไปยังปฏิทินเศรษฐกิจ <ArrowUpRight size={14} />
              </Link>
            </div>
          </section>
        </div>
      </main>

      <MobileDock />
    </div>
  );
}
