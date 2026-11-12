/** LINE 頭像；沒有頭像時顯示名稱第一個字。 */
export default function Avatar({ url, name, size = 36 }: { url?: string | null; name?: string | null; size?: number }) {
  const base = {
    width: size, height: size, borderRadius: '50%', flex: 'none' as const, display: 'inline-block',
    verticalAlign: 'middle', marginRight: 8,
  };
  if (url) {
    return <img src={url} alt="" width={size} height={size} referrerPolicy="no-referrer" style={{ ...base, objectFit: 'cover' }} />;
  }
  return (
    <span style={{
      ...base, background: '#d9e8e0', color: '#2f6b4f', textAlign: 'center',
      lineHeight: `${size}px`, fontSize: size * 0.45, fontWeight: 600,
    }}>{(name ?? '').trim().slice(0, 1) || '?'}</span>
  );
}
