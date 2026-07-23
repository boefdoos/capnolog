"use client";

import {
  CategoryScale,
  Chart,
  type ChartDataset,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useRef } from "react";
import type { BaselineBand, TrendPoint } from "@/lib/useAverages";

Chart.register(LinearScale, CategoryScale, LineController, LineElement, PointElement, Tooltip);

export default function TrendChart({ trend, band }: { trend: TrendPoint[]; band: BaselineBand }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: { datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        interaction: { mode: "nearest", intersect: false },
        plugins: {
          tooltip: {
            backgroundColor: "#0D1210",
            borderColor: "#223028",
            borderWidth: 1,
            titleColor: "#E7EEEA",
            bodyColor: "#E7EEEA",
            padding: 8,
            callbacks: {
              title: (items) => {
                if (!items.length) return "";
                const d = new Date(Number(items[0].parsed.x));
                return d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
              },
              label: (item) => `${(item.parsed.y as number).toFixed(1)} kPa`,
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            ticks: {
              color: "#7C8C86",
              font: { size: 10 },
              callback: (v) => new Date(Number(v)).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }),
            },
            grid: { display: false },
          },
          y: {
            ticks: { color: "#7C8C86", font: { size: 10 } },
            grid: { color: "rgba(255,255,255,0.04)" },
          },
        },
      },
    });
    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const xs = trend.map((p) => p.date);
    const minX = xs.length ? Math.min(...xs) : Date.now() - 30 * 24 * 60 * 60 * 1000;
    const maxX = xs.length ? Math.max(...xs) : Date.now();

    const bandTop: ChartDataset<"line"> = {
      data: [
        { x: minX, y: band.high },
        { x: maxX, y: band.high },
      ],
      borderColor: "#3A5048",
      borderDash: [4, 4],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
      order: 3,
    };
    const bandBottom: ChartDataset<"line"> = {
      data: [
        { x: minX, y: band.low },
        { x: maxX, y: band.low },
      ],
      borderColor: "#3A5048",
      borderDash: [4, 4],
      borderWidth: 1,
      pointRadius: 0,
      fill: "-1",
      backgroundColor: "rgba(94,234,160,0.06)",
      order: 2,
    };
    const trace: ChartDataset<"line"> = {
      data: trend.map((p) => ({ x: p.date, y: p.avgKpa })),
      borderColor: "#5EEAA0",
      backgroundColor: "rgba(94,234,160,0.15)",
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: "#5EEAA0",
      tension: 0.25,
      fill: false,
      order: 1,
    };

    chart.data.datasets = [bandTop, bandBottom, trace];
    chart.update();
  }, [trend, band]);

  if (trend.length < 2) {
    return (
      <div className="panel">
        <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">Evolutie (30 dagen)</div>
        <div className="py-4 text-center text-xs text-muted">
          Nog te weinig sessies voor een evolutiebeeld.
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">Evolutie (30 dagen)</div>
      <div className="relative h-40 w-full">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
