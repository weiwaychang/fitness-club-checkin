'use client';
import { useState } from 'react';

/** 顯示一段可複製的文字（例如 LINE 群組貼文範本）。 */
export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <textarea readOnly value={text} rows={7} onFocus={(e) => e.currentTarget.select()}
        style={{ width: '100%', padding: 10, border: '1px solid #c8d3cd', borderRadius: 8, fontSize: '.95rem', fontFamily: 'inherit' }} />
      <button
        type="button"
        className="btn small"
        style={{ marginTop: 6 }}
        onClick={async () => {
          try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
        }}
      >
        {copied ? '已複製' : '複製貼文'}
      </button>
    </div>
  );
}
