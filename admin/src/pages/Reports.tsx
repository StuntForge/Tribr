import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  reporterName: string | null;
  reportedUserId: string | null;
  reportedUserName: string | null;
  createdAt: string;
}

export default function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [status, setStatus] = useState("OPEN");

  const load = () => {
    apiFetch<ReportRow[]>(`/api/admin/reports?status=${status}`).then(setReports);
  };

  useEffect(load, [status]);

  const resolve = async (id: string, newStatus: "RESOLVED" | "DISMISSED") => {
    await apiFetch(`/api/admin/reports/${id}/resolve`, { method: "POST", body: { status: newStatus } });
    load();
  };

  return (
    <div>
      <h2>Reports</h2>
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
      </div>

      {reports.length === 0 ? (
        <p className="hint">No reports here.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Reason</th>
              <th>Against</th>
              <th>Reported by</th>
              <th>Date</th>
              {status === "OPEN" && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.reason}
                  {r.details && <div className="hint">{r.details}</div>}
                </td>
                <td>
                  {r.reportedUserId ? (
                    <a onClick={() => navigate(`/users/${r.reportedUserId}`)} style={{ cursor: "pointer" }}>
                      {r.reportedUserName ?? "view"}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{r.reporterName ?? "—"}</td>
                <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                {status === "OPEN" && (
                  <td>
                    <div className="toolbar">
                      <button className="btn" onClick={() => resolve(r.id, "RESOLVED")}>
                        Resolve
                      </button>
                      <button className="btn secondary" onClick={() => resolve(r.id, "DISMISSED")}>
                        Dismiss
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
