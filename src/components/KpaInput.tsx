"use client";

import { useRef, useState } from "react";
import { digitsFromInput, formatDigits } from "@/lib/format";
import { DEVICE_MAX_KPA, DEVICE_MIN_KPA } from "@/types/capnolog";

export default function KpaInput({ onLog }: { onLog: (kpa: number) => void }) {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleInput(raw: string) {
    const digits = digitsFromInput(raw);
    setValue(formatDigits(digits));
    setInvalid(false);
  }

  function submit() {
    const val = parseFloat(value);
    if (Number.isNaN(val) || value === "") {
      setInvalid(true);
      setTimeout(() => setInvalid(false), 400);
      return;
    }
    if (val < DEVICE_MIN_KPA || val > DEVICE_MAX_KPA) {
      const ok = window.confirm(
        `${val.toFixed(1)} kPa ligt buiten het meetbereik van de EMMA (${DEVICE_MIN_KPA.toFixed(
          1
        )}\u2013${DEVICE_MAX_KPA.toFixed(1)} kPa). Mogelijk een tikfout. Toch loggen?`
      );
      if (!ok) {
        inputRef.current?.focus();
        return;
      }
    }
    onLog(val);
    setValue("");
    inputRef.current?.focus();
  }

  return (
    <div className="panel">
      <label htmlFor="kpaInput" className="mb-2 block text-[11px] uppercase tracking-wide text-muted">
        ETCO2 (kPa)
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id="kpaInput"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="4.2"
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          className={
            "min-w-0 flex-1 rounded-lg border bg-[#0D1210] px-3.5 py-2.5 font-mono text-2xl text-trace outline-none " +
            (invalid ? "border-danger text-danger" : "border-panel-border focus:border-trace")
          }
        />
        <button
          onClick={submit}
          className="rounded-lg bg-trace px-4 text-sm font-semibold text-[#06120B] active:scale-95"
        >
          Log
        </button>
      </div>
    </div>
  );
}
