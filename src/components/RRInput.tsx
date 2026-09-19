"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Rechtstreeks van het EMMA-scherm afgelezen ademfrequentie (P10), eenmalig
 * per sessiefase, geen bemonsteringstruc nodig zoals bij KpaInput: dit is
 * geen snelle herhaalinvoer tijdens een ademoefening, gewoon één getal
 * aflezen en intikken.
 */
export default function RRInput({
  onLog,
  onLogged,
  refocusToken,
}: {
  onLog: (rrValue: number) => void;
  onLogged?: () => void;
  refocusToken?: number;
}) {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialToken = useRef(refocusToken);

  useEffect(() => {
    if (refocusToken != null && refocusToken !== initialToken.current) inputRef.current?.focus();
  }, [refocusToken]);

  function submit() {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 2);
    const val = parseInt(digits, 10);
    if (Number.isNaN(val) || val <= 0) {
      setInvalid(true);
      setTimeout(() => setInvalid(false), 400);
      return;
    }
    onLog(val);
    setValue("");
    onLogged?.();
  }

  return (
    <div className="panel">
      <label htmlFor="rrInput" className="mb-2 block text-[11px] uppercase tracking-wide text-muted">
        Ademfrequentie van EMMA-scherm (/min)
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id="rrInput"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="13"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.replace(/[^0-9]/g, "").slice(0, 2));
            setInvalid(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          className={
            "min-w-0 flex-1 rounded-lg border bg-[#0D1210] px-3.5 py-2.5 font-mono text-2xl outline-none " +
            (invalid ? "border-danger text-danger" : "border-panel-border text-[#8B93F0] focus:border-trace")
          }
        />
        <button
          onClick={submit}
          className="w-20 shrink-0 rounded-lg border border-[#8B93F0] text-sm font-semibold text-[#8B93F0] active:scale-95"
        >
          Log
        </button>
      </div>
    </div>
  );
}
