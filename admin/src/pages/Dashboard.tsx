import { useEffect, useState } from "react";
import { apiFetch } from "../api";

interface Analytics {
  activeUsers: number;
  totalUsers: number;
  activeGroups: number;
  completedTasks: number;
  completedCycles: number;
  subscriberCount: number;
  openReports: number;
  avgCompletionHours: number | null;
}

export default function Dashboard() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    apiFetch<Analytics>("/api/admin/analytics").then(setData);
  }, []);

  if (!data) return <p>Loading…</p>;

  const stats: { label: string; value: string }[] = [
    { label: "Active users", value: String(data.activeUsers) },
    { label: "Total users", value: String(data.totalUsers) },
    { label: "Active groups", value: String(data.activeGroups) },
    { label: "Completed tasks", value: String(data.completedTasks) },
    { label: "Completed cycles", value: String(data.completedCycles) },
    { label: "Subscribers", value: String(data.subscriberCount) },
    { label: "Open reports", value: String(data.openReports) },
    { label: "Avg. cycle time", value: data.avgCompletionHours != null ? `${data.avgCompletionHours}h` : "—" },
  ];

  return (
    <div>
      <h2>Dashboard</h2>
      <p className="hint">Anonymous platform statistics. No personal information is shown here.</p>
      <div className="stat-grid">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <div className="value">{s.value}</div>
            <div className="label">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
