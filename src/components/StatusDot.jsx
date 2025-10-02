import React from "react";

// 固定配列から選択（テンプレ連結禁止）
const COLORS = {
  idle: "bg-slate-300",
  recording: "bg-rose-500",
  paused: "bg-amber-500",
};

export default function StatusDot({ state = "idle", title }) {
  const cls = COLORS[state] ?? COLORS.idle;
  return (
    <span title={title || state} className="inline-flex items-center">
      <span
        className={`inline-block w-6 h-6 rounded-full ${cls} ring-2 ring-white shadow`}
      />
    </span>
  );
}
