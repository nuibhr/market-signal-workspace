"use client";
import { useEffect, useRef } from "react";
// Forex-only chart adapter: honours terminal digits/point without touching the shared chart.
export default function Mt5PriceChart({ instrument, bars, chartStyle, plan = null, sourceLabel = 'MT5' }) {
  const container = useRef(null);
  useEffect(() => {
    let chart,
      observer,
      cancelled = false;
    (async () => {
      const { createChart, CandlestickSeries, LineSeries, ColorType } =
        await import("lightweight-charts");
      if (cancelled || !container.current) return;
      chart = createChart(container.current, {
        width: container.current.clientWidth,
        height: 355,
        layout: {
          background: { type: ColorType.Solid, color: "#09111d" },
          textColor: "#8291a8",
          fontFamily: "system-ui",
        },
        grid: {
          vertLines: { color: "#172334" },
          horzLines: { color: "#172334" },
        },
        timeScale: { timeVisible: true, secondsVisible: false },
        localization: { locale: "en-GB" },
      });
      const priceFormat = {
        type: "price",
        precision: instrument.digits ?? 5,
        minMove: instrument.point ?? 1e-5,
      };
      const series = chart.addSeries(
        chartStyle === "line" ? LineSeries : CandlestickSeries,
        chartStyle === "line"
          ? { color: "#12dfb0", priceFormat }
          : {
              upColor: "#12dfb0",
              downColor: "#ff647c",
              borderVisible: false,
              wickUpColor: "#12dfb0",
              wickDownColor: "#ff647c",
              priceFormat,
            },
      );
      series.setData(
        chartStyle === "line"
          ? bars.map((bar) => ({ time: bar.time, value: bar.close }))
          : bars,
      );
      if(plan) for(const [title,price,color] of [["Entry",plan.entry,"#8cb4ff"],["SL",plan.stop,"#ff8798"],["TP 2R",plan.target,"#67e7b8"]]) {
        if(Number.isFinite(price))series.createPriceLine({price,color,lineWidth:1,lineStyle:2,axisLabelVisible:true,title});
      }
      chart.timeScale().fitContent();
      observer = new ResizeObserver(() => {
        if (container.current)
          chart.applyOptions({ width: container.current.clientWidth });
      });
      observer.observe(container.current);
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      chart?.remove();
    };
  }, [instrument.digits, instrument.point, bars, chartStyle, plan]);
  return (
    <div
      ref={container}
      style={{ height: 355, width: "100%" }}
      aria-label={`กราฟ ${sourceLabel} ${instrument.broker_symbol} เวลา UTC`}
    />
  );
}
