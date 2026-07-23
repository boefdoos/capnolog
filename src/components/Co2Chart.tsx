"use client";

import {
  CategoryScale,
  Chart,
  type ChartDataset,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type Plugin,
} from "chart.js";
import { useEffect, useRef } from "react";
import { fmtTime } from "@/lib/format";
import type { Entry } from "@/types/capnolog";

Chart.register(LinearScale, CategoryScale, LineController, LineElement, PointElement, Tooltip, Legend);

interface Props {
  entries: Entry[];
  bandLow: number;
  bandHigh: number;
}

function eventColor(e: Entry): string {
  if (e.type === "marker") return "#F2B84B";
  if (e.type === "sigh") return e.subtype === "success" ? "#4FD1C5" : "#E5735A";
  return "#F2B84B";
}

export default function Co2Chart({ entries, bandLow, bandHigh }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const entriesRef = useRef<Entry[]>(entries);
  entriesRef.current = entries;

  useEffect(() => {
    if (!canvasRef.current) return;

    const markerLinePlugin: Plugin = {
      id: "markerLines",
      afterDatasetsDraw(chart) {
        const events = entriesRef.current.filter((e) => e.type === "marker" || e.type === "sigh");
        if (!events.length) return;
        const { ctx, chartArea, scales } = chart;
        ctx.save();
        events.forEach((m) => {
          const x = scales.x.getPixelForValue(m.tSec);
          if (x < chartArea.left || x > chartArea.right) return;
          const color = eventColor(m);
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x + 6, chartArea.top + 6);
          ctx.lineTo(x, chartArea.top + 12);
          ctx.closePath();
          ctx.fill();
        });
        ctx.restore();
      },
    };

    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: { datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        interaction: { mode: "nearest", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0D1210",
            borderColor: "#223028",
            borderWidth: 1,
            titleColor: "#E7EEEA",
            bodyColor: "#E7EEEA",
            padding: 10,
            callbacks: {
              title: (items) => {
                if (!items.length) return "";
                const raw = items[0].raw as Entry | undefined;
                return raw && raw.idx ? "Ademhaling " + raw.idx : "";
              },
              label: (item) => {
                const raw = item.raw as Entry | undefined;
                if (!raw || raw.idx == null || raw.kpa == null || raw.mmHg == null) return "";
                const lines = [
                  raw.kpa.toFixed(1) + " kPa  \u00b7  " + raw.mmHg.toFixed(0) + " mmHg",
                  "t+" + fmtTime(raw.tSec),
                ];
                if (typeof raw.delta === "number" && raw.delta !== 0) {
                  lines.push((raw.delta > 0 ? "+" : "") + raw.delta.toFixed(1) + " kPa t.o.v. vorige");
                }
                if (typeof raw.rr === "number") {
                  lines.push("RR \u2248 " + raw.rr.toFixed(0) + "/min");
                }
                return lines;
              },
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            title: { display: true, text: "tijd (mm:ss)", color: "#7C8C86", font: { size: 11 } },
            ticks: { color: "#7C8C86", callback: (v) => fmtTime(Number(v)) },
            grid: { color: "rgba(255,255,255,0.04)" },
          },
          y: {
            title: { display: true, text: "kPa", color: "#7C8C86", font: { size: 11 } },
            ticks: { color: "#7C8C86" },
            grid: { color: "rgba(255,255,255,0.04)" },
          },
          y1: {
            position: "right",
            title: { display: true, text: "RR (/min)", color: "#8B93F0", font: { size: 11 } },
            ticks: { color: "#8B93F0" },
            grid: { display: false },
          },
        },
      },
      plugins: [markerLinePlugin],
    });
    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const readings = entries.filter((e) => e.type === "reading" && e.kpa != null);
    const maxT = Math.max(...entries.map((e) => e.tSec), 30) + 10;

    const bandTop: ChartDataset<"line"> = {
      label: "band boven",
      data: [
        { x: 0, y: bandHigh },
        { x: maxT, y: bandHigh },
      ],
      borderColor: "#3A5048",
      borderDash: [4, 4],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
      order: 3,
    };
    const bandBottom: ChartDataset<"line"> = {
      label: "band onder",
      data: [
        { x: 0, y: bandLow },
        { x: maxT, y: bandLow },
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
      label: "ETCO2",
      data: readings.map((r) => ({ x: r.tSec, y: r.kpa as number, ...r })) as unknown as {
        x: number;
        y: number;
      }[],
      borderColor: "#5EEAA0",
      backgroundColor: "rgba(94,234,160,0.15)",
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: "#5EEAA0",
      tension: 0.3,
      fill: false,
      order: 1,
    };
    const rrReadings = readings.filter((r) => typeof r.rr === "number");
    const rrTrace: ChartDataset<"line"> = {
      label: "RR",
      yAxisID: "y1",
      data: rrReadings.map((r) => ({ x: r.tSec, y: r.rr as number, ...r })) as unknown as {
        x: number;
        y: number;
      }[],
      borderColor: "#8B93F0",
      backgroundColor: "rgba(139,147,240,0.12)",
      borderWidth: 1.5,
      borderDash: [2, 2],
      pointRadius: 2,
      pointHoverRadius: 5,
      pointBackgroundColor: "#8B93F0",
      tension: 0.3,
      fill: false,
      order: 0,
    };

    chart.data.datasets = [bandTop, bandBottom, trace, rrTrace];
    if (chart.options.scales?.x) {
      (chart.options.scales.x as { max?: number }).max = maxT;
    }
    chart.update();
  }, [entries, bandLow, bandHigh]);

  return (
    <div className="relative h-56 w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}
