import { useEffect, useState } from "react";
import { apiFetch } from "../api";

interface LogRow {
  id: string;
  adminEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  createdAt: string;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<LogRow[]>([]);

  useEffect(() => {
    apiFetch<LogRow[]>("/api/admin/audit-log").then(setLogs);
  }, []);

  return (
    <div>
      <h2>Audit Log</h2>
      <p className="hint">Every administrative action, timestamped, per business rule 8.11.</p>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Admin</th>
            <th>Action</th>
            <th>Target</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{new Date(l.createdAt).toLocaleString()}</td>
              <td>{l.adminEmail}</td>
              <td>{l.action}</td>
              <td>
                {l.targetType} {l.targetId ? `#${l.targetId.slice(0, 8)}` : ""}
              </td>
              <td className="hint">{l.details ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
