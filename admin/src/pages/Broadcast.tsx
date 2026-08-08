import { useState } from "react";
import { apiFetch } from "../api";

export default function Broadcast() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const send = async () => {
    setError(null);
    setSending(true);
    try {
      const result = await apiFetch<{ ok: true; recipientCount: number }>("/api/admin/broadcast", {
        method: "POST",
        body: { title: title.trim(), body: body.trim() },
      });
      setMessage(`Sent to ${result.recipientCount} user${result.recipientCount === 1 ? "" : "s"}.`);
      setTitle("");
      setBody("");
      setConfirming(false);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  const canSend = title.trim().length > 0 && body.trim().length > 0;

  return (
    <div>
      <h2>Broadcast</h2>
      <p className="hint">Send an in-app announcement to every active user's notification centre.</p>

      <div className="card">
        <div className="field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New feature: group calendars" maxLength={200} />
        </div>
        <div className="field">
          <label>Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={2000} placeholder="What do you want users to know?" />
        </div>

        {error && <div className="error">{error}</div>}
        {message && <p className="hint">{message}</p>}

        {!confirming ? (
          <button className="btn" disabled={!canSend} onClick={() => setConfirming(true)}>
            Send announcement
          </button>
        ) : (
          <div className="toolbar">
            <span className="hint">Send this to every active user now?</span>
            <button className="btn" disabled={sending} onClick={send}>
              {sending ? "Sending..." : "Confirm send"}
            </button>
            <button className="btn secondary" disabled={sending} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
