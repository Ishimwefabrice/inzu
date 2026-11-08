import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  addPerson,
  deletePerson,
  getReminders,
  getSummary,
  listPeople,
  markPaid,
  undoPaid,
  updatePerson,
} from "./store";
import type { PersonView, Reminder, StatusState, Summary } from "./store";
import "./index.css";

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
  const [people, setPeople] = useState<PersonView[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [toast, setToast] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PersonView | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [installHint, setInstallHint] = useState(false);

  function refresh() {
    setPeople(listPeople());
    setSummary(getSummary());
    setReminders(getReminders());
  }

  useEffect(() => {
    refresh();
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    setInstallHint(!standalone);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (reminders.length === 0) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const overdue = reminders.filter((r) => r.state === "overdue").length;
    const soon = reminders.filter((r) => r.state === "due_soon").length;
    new Notification("Inzu rent reminder", {
      body:
        overdue > 0
          ? `${overdue} overdue · ${soon} due soon`
          : `${soon} rent payment(s) due soon`,
      icon: `${import.meta.env.BASE_URL}favicon.svg`,
    });
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

  function openEdit(person: PersonView) {
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

  function savePerson(e: FormEvent) {
    e.preventDefault();
    const body = {
      name: draft.name,
      phone: draft.phone,
      room: draft.room,
      rentAmount: Number(draft.rentAmount) || 0,
      dueDay: Number(draft.dueDay) || 1,
      notes: draft.notes,
    };
    if (!body.name.trim()) {
      setToast("Name is required");
      return;
    }
    if (editing) updatePerson(editing.id, body);
    else addPerson(body);
    setModalOpen(false);
    setToast(editing ? "Person updated" : "Person added");
    refresh();
  }

  function onMarkPaid(person: PersonView) {
    markPaid(person.id);
    setToast(`Marked ${person.name} as paid`);
    refresh();
  }

  function onUndoPaid(person: PersonView) {
    undoPaid(person.id, person.status.month);
    setToast(`Payment undone for ${person.name}`);
    refresh();
  }

  function onRemove(person: PersonView) {
    if (!window.confirm(`Remove ${person.name} from Inzu?`)) return;
    deletePerson(person.id);
    setToast(`${person.name} removed`);
    refresh();
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setToast("This phone browser does not support notifications");
      return;
    }
    const permission = await Notification.requestPermission();
    setToast(
      permission === "granted"
        ? "Reminders enabled on this phone"
        : "Notifications were not allowed"
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <h1 className="brand">Inzu</h1>
        <p>
          Record people in your house, track monthly rent, and see reminders when
          payment is due. Free on your phone — no fees.
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

      {installHint && (
        <section className="panel install-tip">
          <strong>Save Inzu on this phone</strong>
          <p>
            Android Chrome: menu → <b>Add to Home screen</b> / <b>Install app</b>.
            <br />
            iPhone Safari: Share → <b>Add to Home Screen</b>.
          </p>
        </section>
      )}

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>This month</h2>
            <p>{monthLabel || "House summary"}</p>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <span>People</span>
            <strong>{summary?.totalPeople ?? 0}</strong>
          </div>
          <div className="stat">
            <span>Paid</span>
            <strong>{summary?.paid ?? 0}</strong>
          </div>
          <div className="stat">
            <span>Overdue</span>
            <strong>{summary?.overdue ?? 0}</strong>
          </div>
          <div className="stat">
            <span>Still owed</span>
            <strong className="money">
              {summary ? money(summary.outstanding) : money(0)}
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

        {people.length === 0 ? (
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
                    <button className="btn btn-quiet" onClick={() => onUndoPaid(person)}>
                      Undo paid
                    </button>
                  ) : (
                    <button className="btn btn-ok" onClick={() => onMarkPaid(person)}>
                      Mark paid
                    </button>
                  )}
                  <button className="btn btn-quiet" onClick={() => openEdit(person)}>
                    Edit
                  </button>
                  <button className="btn btn-danger" onClick={() => onRemove(person)}>
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
                    inputMode="tel"
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
                    inputMode="numeric"
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
                    inputMode="numeric"
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
