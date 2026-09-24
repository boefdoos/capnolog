"use client";

import {
  CategoryScale,
  Chart,
  Filler,
  type ChartDataset,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useRef } from "react";
import type { BaselineBand, Trend } from "@/lib/useAverages";
import { CART_GOAL_KPA_HIGH, CART_GOAL_KPA_LOW } from "@/types/capnolog";

// Filler is nodig voor de ingekleurde band en doelzone (fill: "-1").
Chart.register(LinearScale, CategoryScale, LineController, LineElement, PointElement, Tooltip, Filler);

export default function TrendChart({
  trend,
  band,
  nulmetingMeanKpa = null,
  title = "Evolutie (30 dagen)",
  large = false,
}: {
  trend: Trend;
  band: BaselineBand;
  // Bevroren nulmetingsgemiddelde (P12): het vertrekpunt, blijft zichtbaar
  // ook als de nulmetingen zelf buiten het venster van 30 dagen vallen.
  nulmetingMeanKpa?: number | null;
  title?: string;
  // Hoger op het Trajectscherm, waar de grafiek om te bestuderen is.
  large?: boolean;
}) {
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
          legend: { display: false },
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
              label: (item) => {
                const value = `${(item.parsed.y as number).toFixed(1)} kPa`;
                if (item.dataset.label === "Rustcontrole") return `Rustcontrole · ${value}`;
                if (item.dataset.label === "Nulmeting") return `Nulmeting · ${value}`;
                if (item.dataset.label === "CART-doel") return `CART-doel · ${value}`;
                return value;
              },
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            ticks: {
              color: "#9AA8A2",
              font: { size: 11 },
              callback: (v) => new Date(Number(v)).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }),
            },
            grid: { display: false },
          },
          y: {
            ticks: { color: "#9AA8A2", font: { size: 11 } },
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
    const xs = [...trend.cart, ...trend.rustcontrole, ...trend.nulmeting].map((p) => p.date);
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
      label: "CART",
      data: trend.cart.map((p) => ({ x: p.date, y: p.avgKpa })),
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
    // Losse punten, geen lijn: enkele sporadische momenten over maanden
    // verbinden zou een continu verloop suggereren dat er niet is.
    const rustTrace: ChartDataset<"line"> = {
      label: "Rustcontrole",
      data: trend.rustcontrole.map((p) => ({ x: p.date, y: p.avgKpa })),
      showLine: false,
      borderColor: "transparent",
      pointStyle: "rectRot",
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: "#F2B84B",
      order: 0,
    };
    // Vast trajectdoel (P3), beweegt nooit mee met de data: normocapnie
    // volgens het CART-protocol, niet Thomas' persoonlijke referentieband.
    const goalTop: ChartDataset<"line"> = {
      label: "CART-doel",
      data: [
        { x: minX, y: CART_GOAL_KPA_HIGH },
        { x: maxX, y: CART_GOAL_KPA_HIGH },
      ],
      borderColor: "#4FD1C5",
      borderDash: [2, 3],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
      order: 5,
    };
    const goalBottom: ChartDataset<"line"> = {
      label: "CART-doel",
      data: [
        { x: minX, y: CART_GOAL_KPA_LOW },
        { x: maxX, y: CART_GOAL_KPA_LOW },
      ],
      borderColor: "#4FD1C5",
      borderDash: [2, 3],
      borderWidth: 1,
      pointRadius: 0,
      fill: "-1",
      backgroundColor: "rgba(79,209,197,0.07)",
      order: 4,
    };

    const nulTrace: ChartDataset<"line"> = {
      label: "Nulmeting",
      data: trend.nulmeting.map((p) => ({ x: p.date, y: p.avgKpa })),
      showLine: false,
      borderColor: "transparent",
      pointRadius: 3.5,
      pointHoverRadius: 5,
      pointBackgroundColor: "#8B93F0",
      order: 0,
    };
    const nulLine: ChartDataset<"line"> | null =
      nulmetingMeanKpa == null
        ? null
        : {
            label: "Nulmeting",
            data: [
              { x: minX, y: nulmetingMeanKpa },
              { x: maxX, y: nulmetingMeanKpa },
            ],
            borderColor: "#8B93F0",
            borderDash: [6, 4],
            borderWidth: 1,
            pointRadius: 0,
            fill: false,
            order: 6,
          };

    chart.data.datasets = [goalTop, goalBottom, bandTop, bandBottom, trace, rustTrace, nulTrace];
    if (nulLine) chart.data.datasets.push(nulLine);
    chart.update();
  }, [trend, band, nulmetingMeanKpa]);

  return (
    <div className="panel">
      <div className="mb-1 text-xs uppercase tracking-wide text-muted">{title}</div>
      <div className={"relative w-full " + (large ? "h-64" : "h-40")}>
        <canvas ref={canvasRef} />
        {trend.cart.length < 2 && trend.rustcontrole.length === 0 && trend.nulmeting.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted">
            Nog te weinig sessies voor een evolutiebeeld.
          </div>
        )}
      </div>
      <Legend
        items={[
          trend.cart.length > 0 && { color: "#5EEAA0", label: "Oefensessie" },
          trend.rustcontrole.length > 0 && { color: "#F2B84B", label: "Rustcontrole" },
          (trend.nulmeting.length > 0 || nulmetingMeanKpa != null) && { color: "#8B93F0", label: "Nulmeting" },
          { color: "#4FD1C5", label: "CART-doel", zone: true },
          { color: "#5EEAA0", label: "Jouw band", zone: true },
        ]}
      />
    </div>
  );
}

type LegendItem = { color: string; label: string; zone?: boolean } | false;

/** Legende onder de grafiek: zonder uitleg zijn de drie stippellijnen niet
 * uit elkaar te houden (docs/ui_doorlichting.md B6). */
function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted">
      {items.filter((i): i is Exclude<LegendItem, false> => Boolean(i)).map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span
            className={i.zone ? "inline-block h-2.5 w-3.5 rounded-sm border border-dashed" : "inline-block h-2 w-2 rounded-full"}
            style={i.zone ? { borderColor: i.color, backgroundColor: i.color + "22" } : { backgroundColor: i.color }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
