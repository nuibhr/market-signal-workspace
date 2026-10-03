'use client';

import { useEffect, useMemo, useRef } from 'react';
const EMPTY_LINES = Object.freeze([]);
const TIMEFRAME_LABELS = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1D' };

export default function CandlestickChart({ symbol, timeframe = '1d', bars = null, analysis = null, indicators = {}, chartStyle = 'candles', chartRange = 'recent', loading = false, source = 'ตลาด', timeZone = 'Asia/Bangkok', priceLines = EMPTY_LINES }) {
  const containerRef = useRef(null);
  const candles = useMemo(() => bars ?? [], [bars]);

  useEffect(() => {
    let chart;
    let cancelled = false;
    let observer;

    async function mountChart() {
      if (!containerRef.current) return;
      const { createChart, CandlestickSeries, HistogramSeries, LineSeries, ColorType, LineStyle, TickMarkType } = await import('lightweight-charts');
      if (cancelled || !containerRef.current) return;

      const container = containerRef.current;
      const thaiIntraday = Boolean(bars && timeframe !== '1d');
      const clock = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
      const day = new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: 'short' });
      const fullTime = new Intl.DateTimeFormat('th-TH', { timeZone, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
      chart = createChart(container, {
        width: container.clientWidth,
        height: 355,
        layout: { background: { type: ColorType.Solid, color: '#09111d' }, textColor: '#8291a8', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', fontSize: 11 },
        grid: { vertLines: { color: '#172334' }, horzLines: { color: '#172334' } },
        crosshair: { vertLine: { color: '#47c8bd', labelBackgroundColor: '#16323a' }, horzLine: { color: '#47c8bd', labelBackgroundColor: '#16323a' } },
        rightPriceScale: { borderColor: '#223047', scaleMargins: { top: 0.08, bottom: 0.22 } },
        timeScale: { borderColor: '#223047', timeVisible: true, secondsVisible: false, rightOffset: 3,
          ...(thaiIntraday ? { tickMarkFormatter: (time, type) => {
            if (typeof time !== 'number') return null;
            const date = new Date(time * 1000);
            return type === TickMarkType.Time || type === TickMarkType.TimeWithSeconds ? clock.format(date)
              : type === TickMarkType.Year ? new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric' }).format(date) : day.format(date);
          } } : {}) },
        localization: { locale: 'en-US', ...(thaiIntraday ? { timeFormatter: time => typeof time === 'number' ? fullTime.format(new Date(time * 1000)) : String(time) } : {}) },
      });
      const precision = symbol.includes('/') ? symbol.endsWith('/JPY') ? 3 : 5 : (candles.at(-1)?.close ?? 1) < 1 ? 4 : 2;
      const priceFormat = { type: 'price', precision, minMove: 10 ** -precision };
      const series = chartStyle === 'line'
        ? chart.addSeries(LineSeries, { color: '#6bdac3', lineWidth: 2, priceFormat })
        : chart.addSeries(CandlestickSeries, {
          upColor: '#53d6aa', downColor: '#fa7185', borderUpColor: '#53d6aa', borderDownColor: '#fa7185', wickUpColor: '#53d6aa', wickDownColor: '#fa7185',
          priceFormat,
        });
      series.setData(chartStyle === 'line' ? candles.map(bar => ({ time: bar.time, value: bar.close })) : candles);
      if (indicators.volume) {
        const volume = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
          lastValueVisible: false,
          priceLineVisible: false,
        });
        volume.setData(candles.map(bar => ({ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? '#53d6aa4d' : '#fa71854d' })));
        chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      }
      if (analysis && bars) {
        const addOverlay = (data, color, width = 1) => {
          const overlay = chart.addSeries(LineSeries, { color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
          overlay.setData(data);
        };
        if (indicators.ema20) addOverlay(analysis.ema20Series, '#f0bc72', 2);
        if (indicators.ema50) addOverlay(analysis.ema50Series, '#9e91f5', 2);
        if (indicators.sma20) addOverlay(analysis.sma20Series, '#7daaf4', 2);
        if (indicators.vwap && analysis.vwapSeries?.length) addOverlay(analysis.vwapSeries, '#f8ca62', 2);
        if (indicators.donchian) {
          addOverlay(analysis.donchianUpperSeries, '#ee93b8');
          addOverlay(analysis.donchianLowerSeries, '#ee93b8');
        }
        if (indicators.bollinger) {
          addOverlay(analysis.bollingerUpperSeries, '#7091e7');
          addOverlay(analysis.bollingerLowerSeries, '#7091e7');
        }
        if (indicators.levels) {
          const pivot = analysis.levels?.pivots?.standard;
          if (pivot) for (const key of ['s3','s2','s1','pivot','r1','r2','r3']) {
            if (Number.isFinite(pivot[key]) && pivot[key] > 0) series.createPriceLine({ price: pivot[key], color: key.startsWith('s') ? '#55cba9' : key.startsWith('r') ? '#f1ad73' : '#b6a5e8', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: key === 'pivot' ? 'P' : key.toUpperCase() });
          }
          const rr = analysis.levels?.rrPlan;
          if (rr) for (const [title, price, color] of [['SL · ATR', rr.stop, '#fa7185'], ['TP · 2R', rr.target, '#7daaf4']]) series.createPriceLine({ price, color, lineWidth: 2, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title });
        }
      }
      for (const line of priceLines) {
        if (Number.isFinite(line.price) && line.price > 0) series.createPriceLine({ price: line.price, title: line.title, color: line.color, lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true });
      }
      if (candles.length) {
        if (chartRange === 'all') chart.timeScale().fitContent();
        else chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 90), to: candles.length + 3 });
      }

      observer = new ResizeObserver(entries => {
        const width = entries[0]?.contentRect.width;
        if (width) chart?.applyOptions({ width });
      });
      observer.observe(container);
    }

    mountChart();
    return () => {
      cancelled = true;
      observer?.disconnect();
      chart?.remove();
    };
  }, [candles, analysis, bars, indicators, timeframe, chartStyle, chartRange, symbol, timeZone, priceLines]);

  return <div className="chart-surface"><div ref={containerRef} className="chart-canvas" aria-label={`${bars ? 'Market' : 'Unavailable'} ${TIMEFRAME_LABELS[timeframe]} ${chartStyle === 'line' ? 'line' : 'candlestick'} chart for ${symbol}`} />{loading ? <div className="chart-loading-skeleton" aria-busy="true" aria-label={`กำลังโหลดกราฟ ${symbol} ${TIMEFRAME_LABELS[timeframe]}`}><div className="chart-skeleton-head"><span className="ui-skeleton-line" /><span className="ui-skeleton-line" /></div><div className="chart-skeleton-grid">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--bar-height': `${36 + ((index * 19) % 50)}%`, '--bar-offset': `${(index * 13) % 31}%` }} />)}</div><span className="chart-skeleton-caption">กำลังอ่านแท่ง {TIMEFRAME_LABELS[timeframe]} จาก {source}…</span></div> : !bars && <div className="chart-empty"><strong>ยังไม่มีแท่งราคาสำหรับกราฟนี้</strong><span>เลือกสินทรัพย์อื่น หรือรอเชื่อมแหล่งข้อมูลราคา</span></div>}</div>;
}
