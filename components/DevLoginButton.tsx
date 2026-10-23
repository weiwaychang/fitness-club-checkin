'use client';
import { useRouter } from 'next/navigation';

export default function DevLoginButton({ userId, label, next }: { userId: string; label: string; next: string }) {
  const router = useRouter();
  return (
    <button
      className="btn small"
      onClick={async () => {
        await fetch('/api/auth/line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mock: userId }),
        });
        router.push(next);
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
