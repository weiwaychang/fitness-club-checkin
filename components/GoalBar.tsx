/** 社團本月共同目標進度（不含任何個人資料）。 */
export type GoalView = {
  month: string; targetCheckins: number; targetMembers: number; checkins: number; members: number;
};

function Bar({ label, value, target }: { label: string; value: number; target: number }) {
  if (target <= 0) return null;
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 10, background: '#e4ece8', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#3f7d58', borderRadius: 6 }} />
      </div>
      <p className="muted" style={{ margin: '4px 0 0' }}>{label} {value} / {target}（{pct}%）{value >= target ? ' 🎉 已達成' : ''}</p>
    </div>
  );
}

export default function GoalBar({ goal }: { goal: GoalView }) {
  return (
    <div className="card">
      <strong>社團 {Number(goal.month.slice(5))} 月目標</strong>
      <Bar label="人次" value={goal.checkins} target={goal.targetCheckins} />
      <Bar label="參與人數" value={goal.members} target={goal.targetMembers} />
    </div>
  );
}
