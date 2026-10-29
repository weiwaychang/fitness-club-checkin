'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_SIDE = 1600;

/** 在瀏覽器端把照片縮到長邊 1600px、JPEG 0.8（約數百 KB），再逐張上傳。 */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((ok, fail) =>
    canvas.toBlob((b) => (b ? ok(b) : fail(new Error('無法處理此圖片'))), 'image/jpeg', 0.8));
}

export default function PhotoUploader({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    let done = 0;
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      setMsg(`上傳中 ${done + 1} / ${files.length}…`);
      try {
        const blob = await shrink(file);
        const fd = new FormData();
        fd.set('sessionId', sessionId);
        fd.set('file', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
        const res = await fetch('/api/admin/photos', { method: 'POST', body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error ?? '上傳失敗');
        done++;
      } catch (e: any) {
        errors.push(`${file.name}：${e.message}`);
      }
    }
    setBusy(false);
    setMsg(`已上傳 ${done} 張${errors.length ? `；失敗：${errors.join('、')}` : ''}`);
    if (input.current) input.current.value = '';
    router.refresh();
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/*" multiple disabled={busy}
        onChange={(e) => onPick(e.target.files)} />
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
