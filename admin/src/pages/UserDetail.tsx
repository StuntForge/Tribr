import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api";

interface UserDetailData {
  id: string;
  phone: string;
  firstName: string | null;
  age: number | null;
  gender: string | null;
  status: string;
  subscriptionTier: string;
  createdAt: string;
  skills: string[];
  tools: string[];
  groups: { id: string; name: string; state: string; isLeader: boolean }[];
  reportsReceived: { id: string; reason: string; details: string | null; status: string; reporterName: string | null; createdAt: string }[];
  reportsMadeCount: number;
  subscription: { status: string; currentPeriodEnd: string | null } | null;
}

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserDetailData | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    apiFetch<UserDetailData>(`/api/admin/users/${id}`).then(setUser);
  };

  useEffect(load, [id]);

  const act = async (action: "suspend" | "ban" | "reinstate") => {
    setError(null);
    if (action !== "reinstate" && !reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/admin/users/${id}/${action}`, { method: "POST", body: action === "reinstate" ? undefined : { reason } });
      setReason("");
      load();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const resolveReport = async (reportId: string, status: "RESOLVED" | "DISMISSED") => {
    await apiFetch(`/api/admin/reports/${reportId}/resolve`, { method: "POST", body: { status } });
    load();
  };

  if (!user) return <p>Loading…</p>;

  return (
    <div>
      <button className="btn secondary" onClick={() => navigate("/users")} style={{ marginBottom: 16 }}>
        ← Back to users
      </button>
      <h2>{user.firstName ?? "Unnamed user"}</h2>

      <div className="card">
        <p>
          <strong>Phone:</strong> {user.phone} &nbsp; <strong>Age:</strong> {user.age ?? "—"} &nbsp;{" "}
          <strong>Gender:</strong> {user.gender ?? "—"}
        </p>
        <p>
          <strong>Status:</strong> <span className={`badge ${user.status === "ACTIVE" ? "active" : "danger"}`}>{user.status}</span>
          &nbsp; <strong>Plan:</strong> {user.subscriptionTier}
          {user.subscription?.currentPeriodEnd && ` (renews ${new Date(user.subscription.currentPeriodEnd).toLocaleDateString()})`}
        </p>
        <p>
          <strong>Joined:</strong> {new Date(user.createdAt).toLocaleDateString()} &nbsp; <strong>Reports made:</strong>{" "}
          {user.reportsMadeCount}
        </p>
        {user.skills.length > 0 && (
          <p>
            <strong>Skills:</strong> {user.skills.join(", ")}
          </p>
        )}
        {user.tools.length > 0 && (
          <p>
            <strong>Tools:</strong> {user.tools.join(", ")}
          </p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Moderation</h3>
        <div className="field">
          <label>Reason (required to suspend or ban)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="toolbar">
          {user.status !== "ACTIVE" && (
            <button className="btn" disabled={busy} onClick={() => act("reinstate")}>
              Reinstate
            </button>
          )}
          {user.status !== "SUSPENDED" && (
            <button className="btn secondary" disabled={busy} onClick={() => act("suspend")}>
              Suspend
            </button>
          )}
          {user.status !== "BANNED" && (
            <button className="btn danger" disabled={busy} onClick={() => act("ban")}>
              Ban
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Groups</h3>
        {user.groups.length === 0 ? (
          <p className="hint">Not a member of any groups.</p>
        ) : (
          <ul>
            {user.groups.map((g) => (
              <li key={g.id}>
                {g.name} {g.isLeader && "(leader)"} — {g.state}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Reports against this user</h3>
        {user.reportsReceived.length === 0 ? (
          <p className="hint">No reports.</p>
        ) : (
          user.reportsReceived.map((r) => (
            <div key={r.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
              <p>
                <strong>{r.reason}</strong> — reported by {r.reporterName ?? "unknown"} on {new Date(r.createdAt).toLocaleDateString()}
              </p>
              {r.details && <p className="hint">{r.details}</p>}
              <p>
                Status: <span className="badge">{r.status}</span>
              </p>
              {r.status === "OPEN" && (
                <div className="toolbar">
                  <button className="btn" onClick={() => resolveReport(r.id, "RESOLVED")}>
                    Mark resolved
                  </button>
                  <button className="btn secondary" onClick={() => resolveReport(r.id, "DISMISSED")}>
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
