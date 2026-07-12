"use client";

export default function EventButtons({
  onMarkComplaint,
  onSigh,
}: {
  onMarkComplaint: () => void;
  onSigh: (subtype: "success" | "fail") => void;
}) {
  return (
    <div className="panel">
      <label className="mb-2 block text-[11px] uppercase tracking-wide text-muted">Gebeurtenissen</label>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onMarkComplaint}
          className="rounded-lg border border-amber px-3.5 py-2.5 text-sm font-semibold text-amber active:scale-95"
        >
          Markeer klacht
        </button>
        <button
          onClick={() => onSigh("success")}
          className="rounded-lg border border-teal px-3.5 py-2.5 text-sm font-semibold text-teal active:scale-95"
        >
          Zucht: geslaagd
        </button>
        <button
          onClick={() => onSigh("fail")}
          className="rounded-lg border border-danger px-3.5 py-2.5 text-sm font-semibold text-danger active:scale-95"
        >
          Zucht: mislukt
        </button>
      </div>
    </div>
  );
}
