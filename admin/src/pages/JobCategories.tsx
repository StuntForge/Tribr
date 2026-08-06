import { useEffect, useState } from "react";
import { apiFetch } from "../api";

interface Category {
  id: string;
  name: string;
  active: boolean;
}

export default function JobCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    apiFetch<Category[]>("/api/admin/job-categories").then(setCategories);
  };

  useEffect(load, []);

  const add = async () => {
    if (!newName.trim()) return;
    setError(null);
    try {
      await apiFetch("/api/admin/job-categories", { method: "POST", body: { name: newName.trim() } });
      setNewName("");
      load();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await apiFetch(`/api/admin/job-categories/${id}`, { method: "PATCH", body: { active: !active } });
    load();
  };

  return (
    <div>
      <h2>Job Categories</h2>
      <div className="toolbar">
        <input placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn" onClick={add}>
          Add
        </button>
      </div>
      {error && <div className="error">{error}</div>}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>
                <span className={`badge ${c.active ? "active" : "danger"}`}>{c.active ? "Active" : "Inactive"}</span>
              </td>
              <td>
                <button className="btn secondary" onClick={() => toggleActive(c.id, c.active)}>
                  {c.active ? "Deactivate" : "Reactivate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
