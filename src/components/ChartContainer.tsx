import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
  ColorType,
  ISeriesApi,
  IChartApi,
  Time,
} from 'lightweight-charts';
import { AllIndicatorCalculations, Candle, ConsensusResult } from '../types.ts';
import { Eye, EyeOff, Maximize2, Database } from 'lucide-react';

interface ChartContainerProps {
  candles: Candle[];
  indicators: AllIndicatorCalculations | null;
  consensus: ConsensusResult | null;
  currentTickPrice: number;
  latestTickCandle?: Candle | null;
  onOpenAuditModal?: () => void;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  candles,
  indicators,
  consensus,
  currentTickPrice,
  latestTickCandle,
  onOpenAuditModal,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Series refs
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const supertrendSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMidSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const markerPluginRef = useRef<any>(null);

  // Overlay visibility toggles
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showEma200, setShowEma200] = useState(true);
  const [showSupertrend, setShowSupertrend] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);
  const [showVolume, setShowVolume] = useState(true);

  // Crosshair hover state
  const [hoverData, setHoverData] = useState<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } | null>(null);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    container.innerHTML = '';

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' },
        textColor: '#94a3b8',
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.4)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.4)' },
      },
      crosshair: {
        vertLine: {
          color: '#64748b',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1e293b',
        },
        horzLine: {
          color: '#64748b',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1e293b',
        },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
    });

    chartRef.current = chart;

    // 1. Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });
    candleSeriesRef.current = candleSeries;

    // 2. Volume series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', // Separate pane overlay
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // 3. EMA 20 (Cyan)
    const ema20Series = chart.addSeries(LineSeries, {
      color: '#06b6d4',
      lineWidth: 2,
      title: 'EMA 20',
      priceLineVisible: false,
    });
    ema20SeriesRef.current = ema20Series;

    // 4. EMA 50 (Amber)
    const ema50Series = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      title: 'EMA 50',
      priceLineVisible: false,
    });
    ema50SeriesRef.current = ema50Series;

    // 5. EMA 200 (Purple)
    const ema200Series = chart.addSeries(LineSeries, {
      color: '#c084fc',
      lineWidth: 2,
      title: 'EMA 200',
      priceLineVisible: false,
    });
    ema200SeriesRef.current = ema200Series;

    // 6. Supertrend
    const supertrendSeries = chart.addSeries(LineSeries, {
      color: '#10b981',
      lineWidth: 2,
      title: 'Supertrend',
      priceLineVisible: false,
    });
    supertrendSeriesRef.current = supertrendSeries;

    // 7. Bollinger Upper & Lower
    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: '#38bdf8',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
    });
    bbUpperSeriesRef.current = bbUpperSeries;

    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: '#38bdf8',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
    });
    bbLowerSeriesRef.current = bbLowerSeries;

    const bbMidSeries = chart.addSeries(LineSeries, {
      color: '#64748b',
      lineWidth: 1,
      lineStyle: 1,
      priceLineVisible: false,
    });
    bbMidSeriesRef.current = bbMidSeries;

    // Crosshair listener
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHoverData(null);
        return;
      }
      const data = param.seriesData.get(candleSeries) as any;
      if (data && 'open' in data) {
        setHoverData({
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          volume: (param.seriesData.get(volumeSeries) as any)?.value || 0,
        });
      }
    });

    // Resize observer
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Update Data & Overlays when candles or indicators change
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || candles.length === 0) return;

    // Prepare Candlestick data
    const candleData = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeriesRef.current.setData(candleData);

    // Prepare Volume data
    if (volumeSeriesRef.current) {
      const volumeData = candles.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)',
      }));
      volumeSeriesRef.current.setData(showVolume ? volumeData : []);
    }

    if (indicators) {
      // EMA 20
      if (ema20SeriesRef.current) {
        const ema20Data = candles
          .map((c, i) => ({ time: c.time as Time, value: indicators.ema20[i] }))
          .filter((d) => !isNaN(d.value));
        ema20SeriesRef.current.setData(showEma20 ? ema20Data : []);
      }

      // EMA 50
      if (ema50SeriesRef.current) {
        const ema50Data = candles
          .map((c, i) => ({ time: c.time as Time, value: indicators.ema50[i] }))
          .filter((d) => !isNaN(d.value));
        ema50SeriesRef.current.setData(showEma50 ? ema50Data : []);
      }

      // EMA 200
      if (ema200SeriesRef.current) {
        const ema200Data = candles
          .map((c, i) => ({ time: c.time as Time, value: indicators.ema200[i] }))
          .filter((d) => !isNaN(d.value));
        ema200SeriesRef.current.setData(showEma200 ? ema200Data : []);
      }

      // Supertrend
      if (supertrendSeriesRef.current) {
        const stData = candles
          .map((c, i) => {
            const isBull = indicators.supertrend.trend[i] === 'bull';
            const val = isBull ? indicators.supertrend.lower[i] : indicators.supertrend.upper[i];
            return { time: c.time as Time, value: val };
          })
          .filter((d) => !isNaN(d.value));

        supertrendSeriesRef.current.setData(showSupertrend ? stData : []);
        // Dynamically color supertrend line based on current trend
        const currentTrend = indicators.supertrend.trend[candles.length - 1];
        supertrendSeriesRef.current.applyOptions({
          color: currentTrend === 'bull' ? '#10b981' : '#f43f5e',
        });
      }

      // Bollinger Bands
      if (bbUpperSeriesRef.current && bbLowerSeriesRef.current && bbMidSeriesRef.current) {
        const upperData = candles
          .map((c, i) => ({ time: c.time as Time, value: indicators.bollinger.upper[i] }))
          .filter((d) => !isNaN(d.value));
        const lowerData = candles
          .map((c, i) => ({ time: c.time as Time, value: indicators.bollinger.lower[i] }))
          .filter((d) => !isNaN(d.value));
        const midData = candles
          .map((c, i) => ({ time: c.time as Time, value: indicators.bollinger.middle[i] }))
          .filter((d) => !isNaN(d.value));

        bbUpperSeriesRef.current.setData(showBollinger ? upperData : []);
        bbLowerSeriesRef.current.setData(showBollinger ? lowerData : []);
        bbMidSeriesRef.current.setData(showBollinger ? midData : []);
      }
    }

    // Update signal markers
    if (consensus && candleSeriesRef.current) {
      const markers: any[] = [];
      const lastCandle = candles[candles.length - 1];
      if (consensus.signal === 'CONFIRMED_BUY') {
        markers.push({
          time: lastCandle.time as Time,
          position: 'belowBar',
          color: '#10b981',
          shape: 'arrowUp',
          text: `INST. BUY (${consensus.bullishScore}/10)`,
          size: 2,
        });
      } else if (consensus.signal === 'CONFIRMED_SELL') {
        markers.push({
          time: lastCandle.time as Time,
          position: 'aboveBar',
          color: '#f43f5e',
          shape: 'arrowDown',
          text: `INST. SELL (${consensus.bearishScore}/10)`,
          size: 2,
        });
      }

      try {
        if (!markerPluginRef.current) {
          markerPluginRef.current = createSeriesMarkers(candleSeriesRef.current, markers);
        } else {
          markerPluginRef.current.setMarkers(markers);
        }
      } catch {
        // Fallback marker handling
      }
    }
  }, [
    candles,
    indicators,
    consensus,
    showEma20,
    showEma50,
    showEma200,
    showSupertrend,
    showBollinger,
    showVolume,
  ]);

  // Handle live tick update (non-repainting live candle + volume update)
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    if (latestTickCandle) {
      try {
        candleSeriesRef.current.update({
          time: latestTickCandle.time as Time,
          open: latestTickCandle.open,
          high: latestTickCandle.high,
          low: latestTickCandle.low,
          close: latestTickCandle.close,
        });
        if (volumeSeriesRef.current && showVolume) {
          volumeSeriesRef.current.update({
            time: latestTickCandle.time as Time,
            value: latestTickCandle.volume,
            color: latestTickCandle.close >= latestTickCandle.open ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)',
          });
        }
      } catch {
        // Ignored
      }
      return;
    }

    // Fallback to currentTickPrice if latestTickCandle is not provided yet
    if (candles.length > 0 && currentTickPrice > 0) {
      const lastCandle = candles[candles.length - 1];
      if (lastCandle) {
        candleSeriesRef.current.update({
          time: lastCandle.time as Time,
          open: lastCandle.open,
          high: Math.max(lastCandle.high, currentTickPrice),
          low: Math.min(lastCandle.low, currentTickPrice),
          close: currentTickPrice,
        });
      }
    }
  }, [latestTickCandle, currentTickPrice, showVolume, candles]);

  const fitContent = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  const currentClose = hoverData ? hoverData.close : (candles[candles.length - 1]?.close || 0);
  const currentOpen = hoverData ? hoverData.open : (candles[candles.length - 1]?.open || 0);
  const currentHigh = hoverData ? hoverData.high : (candles[candles.length - 1]?.high || 0);
  const currentLow = hoverData ? hoverData.low : (candles[candles.length - 1]?.low || 0);
  const currentVol = hoverData ? hoverData.volume : (candles[candles.length - 1]?.volume || 0);

  return (
    <div className="relative flex flex-col h-full bg-[#090d16] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Chart Top Control & Indicator Bar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800/80 gap-2 z-10">
        {/* Live Candle OHLC Readout */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <div>
            <span className="text-slate-500">O: </span>
            <span className="text-slate-200">
              {currentOpen < 0.0001 ? currentOpen.toFixed(8) : currentOpen < 1 ? currentOpen.toFixed(4) : currentOpen.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">H: </span>
            <span className="text-emerald-400">
              {currentHigh < 0.0001 ? currentHigh.toFixed(8) : currentHigh < 1 ? currentHigh.toFixed(4) : currentHigh.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">L: </span>
            <span className="text-rose-400">
              {currentLow < 0.0001 ? currentLow.toFixed(8) : currentLow < 1 ? currentLow.toFixed(4) : currentLow.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">C: </span>
            <span className={currentClose >= currentOpen ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {currentClose < 0.0001 ? currentClose.toFixed(8) : currentClose < 1 ? currentClose.toFixed(4) : currentClose.toFixed(2)}
            </span>
          </div>
          <div className="hidden sm:block">
            <span className="text-slate-500">Vol: </span>
            <span className="text-slate-300">{currentVol.toFixed(2)}</span>
          </div>
        </div>

        {/* Overlay Visibility Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <button
            onClick={() => setShowEma20(!showEma20)}
            className={`px-2 py-0.5 rounded font-mono text-[11px] transition cursor-pointer flex items-center gap-1 border ${
              showEma20
                ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-800/40 text-slate-500 border-slate-700/40 line-through'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#06b6d4]"></span>
            EMA 20
          </button>

          <button
            onClick={() => setShowEma50(!showEma50)}
            className={`px-2 py-0.5 rounded font-mono text-[11px] transition cursor-pointer flex items-center gap-1 border ${
              showEma50
                ? 'bg-amber-950/60 text-amber-300 border-amber-500/50'
                : 'bg-slate-800/40 text-slate-500 border-slate-700/40 line-through'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span>
            EMA 50
          </button>

          <button
            onClick={() => setShowEma200(!showEma200)}
            className={`px-2 py-0.5 rounded font-mono text-[11px] transition cursor-pointer flex items-center gap-1 border ${
              showEma200
                ? 'bg-purple-950/60 text-purple-300 border-purple-500/50'
                : 'bg-slate-800/40 text-slate-500 border-slate-700/40 line-through'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#c084fc]"></span>
            EMA 200
          </button>

          <button
            onClick={() => setShowSupertrend(!showSupertrend)}
            className={`px-2 py-0.5 rounded font-mono text-[11px] transition cursor-pointer flex items-center gap-1 border ${
              showSupertrend
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
                : 'bg-slate-800/40 text-slate-500 border-slate-700/40 line-through'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
            Supertrend
          </button>

          <button
            onClick={() => setShowBollinger(!showBollinger)}
            className={`px-2 py-0.5 rounded font-mono text-[11px] transition cursor-pointer flex items-center gap-1 border ${
              showBollinger
                ? 'bg-sky-950/60 text-sky-300 border-sky-500/50'
                : 'bg-slate-800/40 text-slate-500 border-slate-700/40 line-through'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#38bdf8]"></span>
            Bollinger
          </button>

          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2 py-0.5 rounded font-mono text-[11px] transition cursor-pointer flex items-center gap-1 border ${
              showVolume
                ? 'bg-slate-800 text-slate-300 border-slate-700'
                : 'bg-slate-800/40 text-slate-500 border-slate-700/40 line-through'
            }`}
          >
            Vol
          </button>

          {onOpenAuditModal && (
            <button
              onClick={onOpenAuditModal}
              className="px-2 py-0.5 rounded font-mono text-[11px] bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/50 transition cursor-pointer flex items-center gap-1 shadow-xs shadow-emerald-500/20"
              title="Audit and inspect all 500 Real Historical Candles"
            >
              <Database className="w-3 h-3 text-emerald-400" />
              <span>500 Candles Audit</span>
            </button>
          )}

          <button
            onClick={fitContent}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
            title="Fit Chart to Viewport"
            aria-label="Fit chart"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Lightweight Chart Container Element */}
      <div
        ref={chartContainerRef}
        className="flex-1 w-full min-h-[460px] md:min-h-[520px]"
        style={{ minHeight: '480px' }}
      />
    </div>
  );
};
