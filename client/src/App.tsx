import { FormEvent, useEffect, useMemo, useState } from "react";
import "./index.css";

type StatusState = "paid" | "overdue" | "due_soon" | "upcoming";

type Person = {
  id: string;
  name: string;
  phone: string;
  room: string;
  rentAmount: number;
  dueDay: number;
  notes: string;
  payments: { month: string; amount: number; paidAt: string }[];
  status: {
    state: StatusState;
    due: string;
    month: string;
  };
};

type Summary = {
  totalPeople: number;
  paid: number;
  overdue: number;
  dueSoon: number;
  upcoming: number;
  expected: number;
  collected: number;
  outstanding: number;
  month: string;
};

type Reminder = {
  id: string;
  name: string;
  room: string;
  phone: string;
  rentAmount: number;
  state: "overdue" | "due_soon";
  due: string;
};

type Draft = {
  name: string;
  phone: string;
  room: string;
  rentAmount: string;
  dueDay: string;
  notes: string;
};

const emptyDraft: Draft = {
  name: "",
  phone: "",
  room: "",
  rentAmount: "",
  dueDay: "1",
  notes: "",
};

function money(n: number) {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function labelFor(state: StatusState) {
  if (state === "paid") return "Paid";
  if (state === "overdue") return "Overdue";
  if (state === "due_soon") return "Due soon";
  return "Upcoming";
}

export default function App() {
  const [people, setPeople] = useState<Person[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  async function refresh() {
    const [peopleRes, summaryRes, remindersRes] = await Promise.all([
      fetch("/api/people"),
      fetch("/api/summary"),
      fetch("/api/reminders"),
    ]);
    setPeople(await peopleRes.json());
    setSummary(await summaryRes.json());
    setReminders(await remindersRes.json());
    setLoading(false);
  }

  useEffect(() => {
    refresh().catch(() => {
      setLoading(false);
      setToast("Could not reach Inzu server. Run Start Inzu.");
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (reminders.length === 0) return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      const overdue = reminders.filter((r) => r.state === "overdue").length;
      const soon = reminders.filter((r) => r.state === "due_soon").length;
      new Notification("Inzu rent reminder", {
        body:
          overdue > 0
            ? `${overdue} overdue · ${soon} due soon`
            : `${soon} rent payment(s) due soon`,
      });
    }
  }, [reminders]);

  const monthLabel = useMemo(() => {
    if (!summary?.month) return "";
    const [y, m] = summary.month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("en", {
      month: "long",
      year: "numeric",
    });
  }, [summary]);

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setModalOpen(true);
  }

  function openEdit(person: Person) {
    setEditing(person);
    setDraft({
      name: person.name,
      phone: person.phone,
      room: person.room,
      rentAmount: String(person.rentAmount || ""),
      dueDay: String(person.dueDay || 1),
      notes: person.notes || "",
    });
    setModalOpen(true);
  }

  async function savePerson(e: FormEvent) {
    e.preventDefault();
    const body = {
      name: draft.name,
      phone: draft.phone,
      room: draft.room,
      rentAmount: Number(draft.rentAmount) || 0,
      dueDay: Number(draft.dueDay) || 1,
      notes: draft.notes,
    };

    const res = await fetch(editing ? `/api/people/${editing.id}` : "/api/people", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setToast(err.error || "Could not save");
      return;
    }

    setModalOpen(false);
    setToast(editing ? "Person updated" : "Person added");
    await refresh();
  }

  async function markPaid(person: Person) {
    await fetch(`/api/people/${person.id}/pay`, { method: "POST" });
    setToast(`Marked ${person.name} as paid`);
    await refresh();
  }

  async function undoPaid(person: Person) {
    const month = person.status.month;
    await fetch(`/api/people/${person.id}/pay/${month}`, { method: "DELETE" });
    setToast(`Payment undone for ${person.name}`);
    await refresh();
  }

  async function removePerson(person: Person) {
    if (!window.confirm(`Remove ${person.name} from Inzu?`)) return;
    await fetch(`/api/people/${person.id}`, { method: "DELETE" });
    setToast(`${person.name} removed`);
    await refresh();
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setToast("This browser does not support notifications");
      return;
    }
    const permission = await Notification.requestPermission();
    setToast(
      permission === "granted"
        ? "Reminders enabled on this computer"
        : "Notifications were not allowed"
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <h1 className="brand">Inzu</h1>
        <p>
          Record the people in your house, track monthly rent, and get clear
          reminders when payment is due — free, simple, and made for home use.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={openCreate}>
            Add person
          </button>
          <button className="btn btn-secondary" onClick={enableNotifications}>
            Turn on reminders
          </button>
        </div>
      </header>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>This month</h2>
            <p>{monthLabel || "Loading house summary..."}</p>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <span>People</span>
            <strong>{summary?.totalPeople ?? "—"}</strong>
          </div>
          <div className="stat">
            <span>Paid</span>
            <strong>{summary?.paid ?? "—"}</strong>
          </div>
          <div className="stat">
            <span>Overdue</span>
            <strong>{summary?.overdue ?? "—"}</strong>
          </div>
          <div className="stat">
            <span>Still owed</span>
            <strong className="money">
              {summary ? money(summary.outstanding) : "—"}
            </strong>
          </div>
        </div>
      </section>

      {reminders.length > 0 && (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Reminders</h2>
              <p>People who need a follow-up today</p>
            </div>
          </div>
          <div className="reminders">
            {reminders.map((r) => (
              <div key={r.id} className={`reminder ${r.state}`}>
                <div>
                  <strong>{r.name}</strong>
                  <p>
                    {r.room ? `Room ${r.room} · ` : ""}
                    Due {r.due} · {money(r.rentAmount)}
                    {r.phone ? ` · ${r.phone}` : ""}
                  </p>
                </div>
                <span className={`badge ${r.state}`}>{labelFor(r.state)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>People in the house</h2>
            <p>Tap Paid when rent for this month is received</p>
          </div>
          <button className="btn btn-quiet" onClick={openCreate}>
            + Add
          </button>
        </div>

        {loading ? (
          <div className="empty">Loading...</div>
        ) : people.length === 0 ? (
          <div className="empty">
            No one recorded yet. Add the first person living in the house.
          </div>
        ) : (
          <div className="people">
            {people.map((person) => (
              <article key={person.id} className="person-card">
                <div>
                  <h3>{person.name}</h3>
                  <p>
                    {person.room ? `Room ${person.room}` : "No room set"}
                    {person.phone ? ` · ${person.phone}` : ""}
                  </p>
                  <p>
                    Rent {money(person.rentAmount)} · Due day {person.dueDay}
                  </p>
                </div>
                <div>
                  <span className={`badge ${person.status.state}`}>
                    {labelFor(person.status.state)}
                  </span>
                </div>
                <div className="actions">
                  {person.status.state === "paid" ? (
                    <button className="btn btn-quiet" onClick={() => undoPaid(person)}>
                      Undo paid
                    </button>
                  ) : (
                    <button className="btn btn-ok" onClick={() => markPaid(person)}>
                      Mark paid
                    </button>
                  )}
                  <button className="btn btn-quiet" onClick={() => openEdit(person)}>
                    Edit
                  </button>
                  <button className="btn btn-danger" onClick={() => removePerson(person)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? "Edit person" : "Add person"}</h2>
            <form className="form-grid" onSubmit={savePerson}>
              <label>
                Full name
                <input
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Aline Uwase"
                />
              </label>
              <div className="form-row">
                <label>
                  Phone
                  <input
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                    placeholder="0788..."
                  />
                </label>
                <label>
                  Room / unit
                  <input
                    value={draft.room}
                    onChange={(e) => setDraft({ ...draft, room: e.target.value })}
                    placeholder="Room 2"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Monthly rent (RWF)
                  <input
                    type="number"
                    min="0"
                    value={draft.rentAmount}
                    onChange={(e) => setDraft({ ...draft, rentAmount: e.target.value })}
                    placeholder="150000"
                  />
                </label>
                <label>
                  Due day each month
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={draft.dueDay}
                    onChange={(e) => setDraft({ ...draft, dueDay: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Notes
                <textarea
                  rows={3}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="Optional note"
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? "Save changes" : "Save person"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
