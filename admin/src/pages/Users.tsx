import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

interface UserRow {
  id: string;
  phone: string;
  firstName: string | null;
  status: string;
  subscriptionTier: string;
  createdAt: string;
  reportCount: number;
}

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (status) params.set("status", status);
    apiFetch<UserRow[]>(`/api/admin/users?${params}`)
      .then(setUsers)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div>
      <h2>Users</h2>
      <div className="toolbar">
        <input placeholder="Search name or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
        </select>
        <button className="btn" onClick={load}>
          Search
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Reports</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="clickable" onClick={() => navigate(`/users/${u.id}`)}>
                <td>{u.firstName ?? "—"}</td>
                <td>{u.phone}</td>
                <td>
                  <span className={`badge ${u.status === "ACTIVE" ? "active" : "danger"}`}>{u.status}</span>
                </td>
                <td>{u.subscriptionTier}</td>
                <td>{u.reportCount}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
