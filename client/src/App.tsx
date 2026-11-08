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
import { LANG_LABELS, loadLang, localeFor, saveLang, t } from "./i18n";
import type { Lang } from "./i18n";
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

function money(n: number, lang: Lang) {
  return new Intl.NumberFormat(localeFor(lang), {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function labelFor(lang: Lang, state: StatusState) {
  if (state === "paid") return t(lang, "paid");
  if (state === "overdue") return t(lang, "overdue");
  if (state === "due_soon") return t(lang, "dueSoon");
  return t(lang, "upcoming");
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => loadLang());
  const [people, setPeople] = useState<PersonView[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [toast, setToast] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PersonView | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [installHint, setInstallHint] = useState(false);
  const [langFlash, setLangFlash] = useState(false);

  function refresh() {
    setPeople(listPeople());
    setSummary(getSummary());
    setReminders(getReminders());
  }

  function changeLang(next: Lang) {
    setLang(next);
    saveLang(next);
    setLangFlash(true);
    window.setTimeout(() => setLangFlash(false), 450);
  }

  useEffect(() => {
    refresh();
    document.documentElement.lang = lang === "rw" ? "rw" : lang;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    setInstallHint(!standalone);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "rw" ? "rw" : lang;
  }, [lang]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (reminders.length === 0) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const overdue = reminders.filter((r) => r.state === "overdue").length;
    const soon = reminders.filter((r) => r.state === "due_soon").length;
    new Notification(t(lang, "notifTitle"), {
      body:
        overdue > 0
          ? t(lang, "notifBodyOverdue", { overdue, soon })
          : t(lang, "notifBodySoon", { soon }),
      icon: `${import.meta.env.BASE_URL}favicon.svg`,
    });
  }, [reminders, lang]);

  const monthLabel = useMemo(() => {
    if (!summary?.month) return "";
    const [y, m] = summary.month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString(localeFor(lang), {
      month: "long",
      year: "numeric",
    });
  }, [summary, lang]);

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
      setToast(t(lang, "nameRequired"));
      return;
    }
    if (editing) updatePerson(editing.id, body);
    else addPerson(body);
    setModalOpen(false);
    setToast(editing ? t(lang, "personUpdated") : t(lang, "personAdded"));
    refresh();
  }

  function onMarkPaid(person: PersonView) {
    markPaid(person.id);
    setToast(t(lang, "markedPaid", { name: person.name }));
    refresh();
  }

  function onUndoPaid(person: PersonView) {
    undoPaid(person.id, person.status.month);
    setToast(t(lang, "paymentUndone", { name: person.name }));
    refresh();
  }

  function onRemove(person: PersonView) {
    if (!window.confirm(t(lang, "removeConfirm", { name: person.name }))) return;
    deletePerson(person.id);
    setToast(t(lang, "removed", { name: person.name }));
    refresh();
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setToast(t(lang, "noNotifSupport"));
      return;
    }
    const permission = await Notification.requestPermission();
    setToast(
      permission === "granted" ? t(lang, "remindersEnabled") : t(lang, "notifDenied")
    );
  }

  return (
    <div className={`app-shell ${langFlash ? "lang-flash" : ""}`}>
      <header className="hero">
        <div className="hero-orbs" aria-hidden="true">
          <span className="orb orb-a" />
          <span className="orb orb-b" />
          <span className="orb orb-c" />
        </div>
        <div className="lang-bar" role="group" aria-label={t(lang, "language")}>
          {(Object.keys(LANG_LABELS) as Lang[]).map((code) => (
            <button
              key={code}
              type="button"
              className={`lang-btn ${lang === code ? "active" : ""}`}
              onClick={() => changeLang(code)}
            >
              {LANG_LABELS[code]}
            </button>
          ))}
        </div>
        <h1 className="brand">
          <span className="brand-word">Inzu</span>
        </h1>
        <p key={lang} className="hero-tagline">
          {t(lang, "tagline")}
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary pulse-soft" onClick={openCreate}>
            {t(lang, "addPerson")}
          </button>
          <button className="btn btn-secondary" onClick={enableNotifications}>
            {t(lang, "turnOnReminders")}
          </button>
        </div>
      </header>

      {installHint && (
        <section className="panel install-tip anim-delay-1">
          <strong>{t(lang, "saveOnPhone")}</strong>
          <p>
            {t(lang, "installAndroid")}
            <br />
            {t(lang, "installIos")}
          </p>
        </section>
      )}

      <section className="panel anim-delay-2">
        <div className="section-head">
          <div>
            <h2>{t(lang, "thisMonth")}</h2>
            <p>{monthLabel || t(lang, "houseSummary")}</p>
          </div>
        </div>
        <div className="stats">
          <div className="stat pop-in" style={{ animationDelay: "0.05s" }}>
            <span>{t(lang, "people")}</span>
            <strong>{summary?.totalPeople ?? 0}</strong>
          </div>
          <div className="stat pop-in" style={{ animationDelay: "0.12s" }}>
            <span>{t(lang, "paid")}</span>
            <strong>{summary?.paid ?? 0}</strong>
          </div>
          <div className="stat pop-in" style={{ animationDelay: "0.19s" }}>
            <span>{t(lang, "overdue")}</span>
            <strong>{summary?.overdue ?? 0}</strong>
          </div>
          <div className="stat pop-in" style={{ animationDelay: "0.26s" }}>
            <span>{t(lang, "stillOwed")}</span>
            <strong className="money">
              {summary ? money(summary.outstanding, lang) : money(0, lang)}
            </strong>
          </div>
        </div>
      </section>

      {reminders.length > 0 && (
        <section className="panel anim-delay-3">
          <div className="section-head">
            <div>
              <h2>{t(lang, "reminders")}</h2>
              <p>{t(lang, "remindersSub")}</p>
            </div>
          </div>
          <div className="reminders">
            {reminders.map((r, i) => (
              <div
                key={r.id}
                className={`reminder ${r.state} slide-in`}
                style={{ animationDelay: `${0.05 + i * 0.07}s` }}
              >
                <div>
                  <strong>{r.name}</strong>
                  <p>
                    {r.room ? `${t(lang, "room")} ${r.room} · ` : ""}
                    {t(lang, "due")} {r.due} · {money(r.rentAmount, lang)}
                    {r.phone ? ` · ${r.phone}` : ""}
                  </p>
                </div>
                <span className={`badge ${r.state} badge-pulse`}>
                  {labelFor(lang, r.state)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel anim-delay-4">
        <div className="section-head">
          <div>
            <h2>{t(lang, "peopleInHouse")}</h2>
            <p>{t(lang, "peopleSub")}</p>
          </div>
          <button className="btn btn-quiet" onClick={openCreate}>
            {t(lang, "add")}
          </button>
        </div>

        {people.length === 0 ? (
          <div className="empty">{t(lang, "emptyPeople")}</div>
        ) : (
          <div className="people">
            {people.map((person, i) => (
              <article
                key={person.id}
                className="person-card slide-in"
                style={{ animationDelay: `${0.04 + i * 0.06}s` }}
              >
                <div>
                  <h3>{person.name}</h3>
                  <p>
                    {person.room
                      ? `${t(lang, "room")} ${person.room}`
                      : t(lang, "noRoom")}
                    {person.phone ? ` · ${person.phone}` : ""}
                  </p>
                  <p>
                    {t(lang, "rent")} {money(person.rentAmount, lang)} ·{" "}
                    {t(lang, "dueDay")} {person.dueDay}
                  </p>
                </div>
                <div>
                  <span className={`badge ${person.status.state}`}>
                    {labelFor(lang, person.status.state)}
                  </span>
                </div>
                <div className="actions">
                  {person.status.state === "paid" ? (
                    <button
                      className="btn btn-quiet"
                      onClick={() => onUndoPaid(person)}
                    >
                      {t(lang, "undoPaid")}
                    </button>
                  ) : (
                    <button
                      className="btn btn-ok"
                      onClick={() => onMarkPaid(person)}
                    >
                      {t(lang, "markPaid")}
                    </button>
                  )}
                  <button
                    className="btn btn-quiet"
                    onClick={() => openEdit(person)}
                  >
                    {t(lang, "edit")}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => onRemove(person)}
                  >
                    {t(lang, "remove")}
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
            <h2>{editing ? t(lang, "editPerson") : t(lang, "addPerson")}</h2>
            <form className="form-grid" onSubmit={savePerson}>
              <label>
                {t(lang, "fullName")}
                <input
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Aline Uwase"
                />
              </label>
              <div className="form-row">
                <label>
                  {t(lang, "phone")}
                  <input
                    value={draft.phone}
                    onChange={(e) =>
                      setDraft({ ...draft, phone: e.target.value })
                    }
                    placeholder="0788..."
                    inputMode="tel"
                  />
                </label>
                <label>
                  {t(lang, "roomUnit")}
                  <input
                    value={draft.room}
                    onChange={(e) =>
                      setDraft({ ...draft, room: e.target.value })
                    }
                    placeholder="Room 2"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  {t(lang, "monthlyRent")}
                  <input
                    type="number"
                    min="0"
                    value={draft.rentAmount}
                    onChange={(e) =>
                      setDraft({ ...draft, rentAmount: e.target.value })
                    }
                    placeholder="150000"
                    inputMode="numeric"
                  />
                </label>
                <label>
                  {t(lang, "dueDayEachMonth")}
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={draft.dueDay}
                    onChange={(e) =>
                      setDraft({ ...draft, dueDay: e.target.value })
                    }
                    inputMode="numeric"
                  />
                </label>
              </div>
              <label>
                {t(lang, "notes")}
                <textarea
                  rows={3}
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                  placeholder={t(lang, "optionalNote")}
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => setModalOpen(false)}
                >
                  {t(lang, "cancel")}
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? t(lang, "saveChanges") : t(lang, "savePerson")}
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
