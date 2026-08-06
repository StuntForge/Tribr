import { useEffect, useState } from "react";
import { apiFetch } from "../api";

interface SubRow {
  userId: string;
  userName: string | null;
  userPhone: string;
  status: string;
  currentPeriodEnd: string | null;
}

export default function Subscriptions() {
  const [subs, setSubs] = useState<SubRow[]>([]);

  useEffect(() => {
    apiFetch<SubRow[]>("/api/admin/subscriptions").then(setSubs);
  }, []);

  return (
    <div>
      <h2>Subscriptions</h2>
      {subs.length === 0 ? (
        <p className="hint">No billing accounts yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Renews / Ended</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.userId}>
                <td>{s.userName ?? "—"}</td>
                <td>{s.userPhone}</td>
                <td>
                  <span className={`badge ${s.status === "ACTIVE" ? "active" : "danger"}`}>{s.status}</span>
                </td>
                <td>{s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
