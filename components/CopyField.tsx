'use client';
import { useState } from 'react';

export default function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="row">
      <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="btn small"
        onClick={async () => {
          try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
        }}
      >
        {copied ? '已複製' : '複製'}
      </button>
    </div>
  );
}
