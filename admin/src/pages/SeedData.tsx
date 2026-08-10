import { useState } from "react";
import { apiFetch } from "../api";

interface SeedResult {
  usersCreated: number;
  subscriberCount: number;
  freeCount: number;
  tasksCreated: number;
  groupsCreated: number;
  ratedMemberSlots: number;
  log: string[];
}

interface DeleteResult {
  usersDeleted: number;
  groupsDeleted: number;
  tasksDeleted: number;
  protectedUsers: number;
  skippedGroups: number;
}

export default function SeedData() {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteResult, setDeleteResult] = useState<DeleteResult | null>(null);

  const run = async () => {
    setError(null);
    setRunning(true);
    try {
      const data = await apiFetch<SeedResult>("/api/admin/seed-full-spectrum", { method: "POST" });
      setResult(data);
      setConfirming(false);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setRunning(false);
    }
  };

  const runDelete = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      const data = await apiFetch<DeleteResult>("/api/admin/delete-demo-data", { method: "POST" });
      setDeleteResult(data);
      setConfirmingDelete(false);
    } catch (e: any) {
      setDeleteError(e.message ?? "Something went wrong.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <h2>Seed Demo Data</h2>
      <p className="hint">
        Creates 50 new fake users (mixed Free/Pro) and 20 new fake groups spanning every group state - Recruiting,
        Ready, Working, a Dissolution vote in progress, Completed (with fabricated ratings), and Disbanded - each
        with tasks that carry a stock photo. Safe to run more than once; each run just adds another batch.
      </p>

      <div className="card">
        {error && <div className="error">{error}</div>}

        {result && (
          <p className="hint">
            Created {result.usersCreated} users ({result.subscriberCount} Pro / {result.freeCount} Free),{" "}
            {result.tasksCreated} tasks, and {result.groupsCreated} groups (~{result.ratedMemberSlots} rated member
            slots).
          </p>
        )}

        {!confirming ? (
          <button className="btn" disabled={running} onClick={() => setConfirming(true)}>
            Seed 50 users + 20 groups
          </button>
        ) : (
          <div className="toolbar">
            <span className="hint">This adds real rows to the live database now. Continue?</span>
            <button className="btn" disabled={running} onClick={run}>
              {running ? "Seeding..." : "Confirm seed"}
            </button>
            <button className="btn secondary" disabled={running} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        )}

        {result && result.log.length > 0 && (
          <details style={{ marginTop: 16 }}>
            <summary className="hint" style={{ cursor: "pointer" }}>
              Group-by-group log
            </summary>
            <ul>
              {result.log.map((line, i) => (
                <li key={i} className="hint">
                  {line}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <h2 style={{ marginTop: 32 }}>Delete Demo Data</h2>
      <p className="hint">
        Removes every demo user, task, and group created by any seed run. If a demo user's history is tangled up
        with a real account (e.g. a group a real member joined), that user and their group are left alone instead of
        being force-deleted.
      </p>

      <div className="card">
        {deleteError && <div className="error">{deleteError}</div>}

        {deleteResult && (
          <p className="hint">
            Deleted {deleteResult.usersDeleted} users, {deleteResult.groupsDeleted} groups, and{" "}
            {deleteResult.tasksDeleted} tasks.
            {deleteResult.protectedUsers > 0 &&
              ` Left ${deleteResult.protectedUsers} demo user(s) and ${deleteResult.skippedGroups} group(s) alone because a real account's history depends on them.`}
          </p>
        )}

        {!confirmingDelete ? (
          <button className="btn secondary" disabled={deleting} onClick={() => setConfirmingDelete(true)}>
            Delete all demo data
          </button>
        ) : (
          <div className="toolbar">
            <span className="hint">This permanently deletes demo users, tasks, and groups from the live database. Continue?</span>
            <button className="btn secondary" disabled={deleting} onClick={runDelete}>
              {deleting ? "Deleting..." : "Confirm delete"}
            </button>
            <button className="btn secondary" disabled={deleting} onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
