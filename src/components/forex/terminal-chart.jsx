import { useMemo, useState } from "react";
import {
  CandlestickChart as ChartIcon,
  Settings2,
  Maximize2,
  Star,
} from "lucide-react";
import CandlestickChart from "../candlestick-chart.jsx";
import { analyzeCandles } from "../../analysis/technical.mjs";
import {
  demoBars,
  demoIndicators,
  demoQuote,
  formatDemoPrice,
} from "./terminal-demo.mjs";
import styles from "./forex-workspace.module.css";

export function Sparkline({ values, negative = false, className = "" }) {
  if (!values?.length) return null;
  const low = Math.min(...values),
    range = Math.max(...values) - low || 1;
  const points = values
    .map(
      (value, index) =>
        `${(index / (values.length - 1 || 1)) * 120},${31 - ((value - low) / range) * 28}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 120 35"
      preserveAspectRatio="none"
      className={`${styles.sparkline} ${className}`}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={negative ? "#ff647c" : "#12dfb0"}
        strokeWidth="1.7"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
export function DemoBadge({ enabled = true }) {
  return (
    <span className={styles.demoBadge}>{enabled ? "DEMO" : "NO FEED"}</span>
  );
}
export function PanelHeading({
  icon: Icon,
  title,
  demo = true,
  action,
  label,
}) {
  return (
    <div className={styles.panelHeading}>
      <h2>
        {Icon && <Icon size={15} />} {title}
      </h2>
      <div>
        {label ? (
          <span className={styles.demoBadge}>{label}</span>
        ) : (
          <DemoBadge enabled={demo} />
        )}
        {action}
      </div>
    </div>
  );
}

export default function TerminalChart({
  instrument,
  instruments,
  onSelect,
  preview,
  favorites,
  onFavorite,
  expanded = false,
}) {
  const [frame, setFrame] = useState("1h");
  const [overlays, setOverlays] = useState(true);
  const [chartStyle, setChartStyle] = useState("candles");
  const bars = useMemo(
    () => (preview ? demoBars(instrument, frame) : null),
    [instrument, frame, preview],
  );
  const analysis = useMemo(
    () => (bars ? analyzeCandles(bars, null, frame) : null),
    [bars, frame],
  );
  const indicators = useMemo(
    () => ({
      ema20: overlays,
      ema50: overlays,
      bollinger: overlays,
      volume: false,
      levels: false,
    }),
    [overlays],
  );
  const secondary = useMemo(() => (bars ? demoIndicators(bars) : null), [bars]);
  const quote = preview ? demoQuote(instrument) : null;
  return (
    <section
      className={`${styles.panel} ${styles.chartPanel} ${expanded ? styles.expandedChart : ""}`}
      aria-labelledby="forex-chart-title"
    >
      <div className={styles.panelHeading}>
        <h2 id="forex-chart-title">
          <ChartIcon size={16} /> Advanced chart
        </h2>
        <DemoBadge enabled={preview} />
      </div>
      <div className={styles.chartToolbar}>
        <select
          aria-label="สินทรัพย์บนกราฟ"
          value={instrument.id}
          onChange={(event) =>
            onSelect(instruments.find((item) => item.id === event.target.value))
          }
        >
          {instruments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.canonical_symbol}
            </option>
          ))}
        </select>
        <div className={styles.timeframes}>
          {[
            ["15m", "15m"],
            ["1h", "1H"],
            ["4h", "4H"],
            ["1d", "1D"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={frame === value}
              onClick={() => setFrame(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className={styles.iconButton}
          aria-label="เปิดหรือปิดอินดิเคเตอร์บนกราฟ"
          aria-pressed={overlays}
          onClick={() => setOverlays((value) => !value)}
        >
          <Settings2 size={16} />
        </button>
        <button
          className={styles.iconButton}
          aria-label="เปลี่ยนกราฟแท่งหรือเส้น"
          aria-pressed={chartStyle === "line"}
          onClick={() =>
            setChartStyle((value) => (value === "line" ? "candles" : "line"))
          }
        >
          <ChartIcon size={16} />
        </button>
        <button
          className={styles.iconButton}
          aria-label={`รายการโปรดกราฟ ${instrument.display_symbol}`}
          aria-pressed={favorites.includes(instrument.id)}
          onClick={() => onFavorite(instrument.id)}
        >
          <Star
            size={15}
            fill={favorites.includes(instrument.id) ? "currentColor" : "none"}
          />
        </button>
      </div>
      <div className={styles.chartCaption}>
        <strong>{instrument.canonical_symbol}</strong>
        <span>
          {instrument.description} · {frame.toUpperCase()}
        </span>
        <b className={styles.positive}>
          {formatDemoPrice(instrument, quote?.price)}
        </b>
      </div>
      <div className={styles.chartContainer}>
        <CandlestickChart
          symbol={
            instrument.category === "metals"
              ? instrument.canonical_symbol
              : instrument.display_symbol
          }
          timeframe={frame}
          bars={bars}
          analysis={analysis}
          indicators={indicators}
          chartStyle={chartStyle}
          source="ข้อมูลตัวอย่าง"
          chartRange="all"
        />
      </div>
      <div className={styles.indicatorPanel}>
        <span>
          RSI 14 <b>{secondary ? secondary.rsi.at(-1).toFixed(2) : "—"}</b>
        </span>
        {secondary ? (
          <Sparkline values={secondary.rsi} className={styles.rsiLine} />
        ) : (
          <span className={styles.waiting}>รอฟีดราคา</span>
        )}
        <small>70 / 30</small>
      </div>
      <div className={styles.indicatorPanel}>
        <span>MACD 12 26 9</span>
        {secondary ? (
          <div className={styles.macdPlot}>
            {secondary.macd.slice(-40).map((value, index) => (
              <i
                key={index}
                style={{
                  height: `${8 + (Math.abs(value) / (Math.max(...secondary.macd.map(Math.abs)) || 1)) * 24}px`,
                  background: value >= 0 ? "#0dbf9b" : "#e35e78",
                }}
              />
            ))}
            <Sparkline values={secondary.signal.slice(-40)} />
          </div>
        ) : (
          <span className={styles.waiting}>รอฟีดราคา</span>
        )}
      </div>
      <div className={styles.chartFoot}>
        {preview
          ? "กราฟจำลอง · 28 ต.ค. 2024 · ไม่ใช่ราคาตลาดหรือสัญญาณซื้อขายจริง"
          : "ยังไม่เชื่อม MT5 · ไม่มีราคาและแท่งกราฟจากโบรกเกอร์"}
        <Maximize2 size={12} />
      </div>
    </section>
  );
}
