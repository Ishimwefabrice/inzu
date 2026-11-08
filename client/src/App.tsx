import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  addPerson,
  addPersonDocument,
  deletePerson,
  getReminders,
  getSummary,
  listPeople,
  markPaid,
  notificationsEnabled,
  paymentHistory,
  removePersonDocument,
  replaceAllPeople,
  searchPeople,
  setNotificationsEnabled,
  setPersonPhoto,
  shouldSendReminderNotification,
  undoPaid,
  updatePerson,
} from "./store";
import type {
  BackupPayload,
  Person,
  PersonView,
  Reminder,
  StatusState,
  Summary,
} from "./store";
import {
  clearAllMedia,
  deleteMedia,
  deleteMediaForPerson,
  exportAllMedia,
  getMedia,
  importMediaFiles,
  maxDocsPerPerson,
  objectUrl,
  putMedia,
  validateDocFile,
  validateImageFile,
} from "./media";
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

function formatMonth(key: string, lang: Lang) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString(localeFor(lang), {
    month: "long",
    year: "numeric",
  });
}

function formatDate(iso: string | null, lang: Lang) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(localeFor(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [notifOn, setNotifOn] = useState(() => notificationsEnabled());
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const detail = useMemo(
    () => (detailId ? people.find((p) => p.id === detailId) || null : null),
    [detailId, people]
  );

  const visiblePeople = useMemo(() => {
    if (!query.trim()) return people;
    return searchPeople(query);
  }, [people, query]);

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
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      if (!detail?.photoId) {
        setPhotoUrl(null);
        return;
      }
      const media = await getMedia(detail.photoId);
      if (cancelled) return;
      if (!media) {
        setPhotoUrl(null);
        return;
      }
      const url = objectUrl(media.blob);
      revoked = url;
      setPhotoUrl(url);
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [detail?.photoId, detail?.id]);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!shouldSendReminderNotification(reminders)) return;
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
    return formatMonth(summary.month, lang);
  }, [summary, lang]);

  const history = useMemo(
    () => (detail ? paymentHistory(detail, 12) : []),
    [detail]
  );

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
    if (editing) {
      updatePerson(editing.id, body);
      setToast(t(lang, "personUpdated"));
    } else {
      const created = addPerson(body);
      setDetailId(created.id);
      setToast(t(lang, "personAdded"));
    }
    setModalOpen(false);
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

  async function onRemove(person: PersonView) {
    if (!window.confirm(t(lang, "removeConfirm", { name: person.name }))) return;
    await deleteMediaForPerson(person.id);
    deletePerson(person.id);
    if (detailId === person.id) setDetailId(null);
    setToast(t(lang, "removed", { name: person.name }));
    refresh();
  }

  async function toggleNotifications() {
    if (!("Notification" in window)) {
      setToast(t(lang, "noNotifSupport"));
      return;
    }
    if (notifOn) {
      setNotificationsEnabled(false);
      setNotifOn(false);
      setToast(t(lang, "remindersDisabled"));
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setToast(t(lang, "notifDenied"));
      return;
    }
    setNotificationsEnabled(true);
    setNotifOn(true);
    setToast(t(lang, "remindersEnabled"));
  }

  async function onPhotoPicked(file: File | null, person: PersonView) {
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      setToast(t(lang, err));
      return;
    }
    try {
      if (person.photoId) await deleteMedia(person.photoId);
      const id = crypto.randomUUID();
      await putMedia({
        id,
        personId: person.id,
        kind: "photo",
        name: file.name || "photo.jpg",
        mime: file.type,
        size: file.size,
        createdAt: new Date().toISOString(),
        blob: file,
      });
      setPersonPhoto(person.id, id);
      setToast(t(lang, "mediaSaved"));
      refresh();
    } catch {
      setToast(t(lang, "mediaError"));
    }
  }

  async function onRemovePhoto(person: PersonView) {
    if (!person.photoId) return;
    try {
      await deleteMedia(person.photoId);
      setPersonPhoto(person.id, null);
      setToast(t(lang, "mediaRemoved"));
      refresh();
    } catch {
      setToast(t(lang, "mediaError"));
    }
  }

  async function onDocPicked(file: File | null, person: PersonView) {
    if (!file) return;
    if ((person.documents || []).length >= maxDocsPerPerson()) {
      setToast(t(lang, "tooManyDocs"));
      return;
    }
    const err = validateDocFile(file);
    if (err) {
      setToast(t(lang, err));
      return;
    }
    try {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      await putMedia({
        id,
        personId: person.id,
        kind: "doc",
        name: file.name || "document",
        mime: file.type || "application/octet-stream",
        size: file.size,
        createdAt,
        blob: file,
      });
      addPersonDocument(person.id, {
        id,
        name: file.name || "document",
        mime: file.type || "application/octet-stream",
        size: file.size,
        createdAt,
      });
      setToast(t(lang, "mediaSaved"));
      refresh();
    } catch {
      setToast(t(lang, "mediaError"));
    }
  }

  async function onOpenDoc(docId: string) {
    const media = await getMedia(docId);
    if (!media) {
      setToast(t(lang, "mediaError"));
      return;
    }
    const url = objectUrl(media.blob);
    window.open(url, "_blank");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function onRemoveDoc(person: PersonView, docId: string, name: string) {
    if (!window.confirm(t(lang, "removeDocConfirm", { name }))) return;
    try {
      await deleteMedia(docId);
      removePersonDocument(person.id, docId);
      setToast(t(lang, "mediaRemoved"));
      refresh();
    } catch {
      setToast(t(lang, "mediaError"));
    }
  }

  async function exportBackup() {
    try {
      const payload: BackupPayload = {
        version: 1,
        app: "inzu",
        exportedAt: new Date().toISOString(),
        people: listPeople().map((p) => {
          const { status: _s, ...rest } = p;
          return rest as Person;
        }),
        files: await exportAllMedia(),
      };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inzu-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToast(t(lang, "backupReady"));
    } catch {
      setToast(t(lang, "mediaError"));
    }
  }

  async function importBackup(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupPayload;
      if (data.app !== "inzu" || data.version !== 1 || !Array.isArray(data.people)) {
        setToast(t(lang, "backupInvalid"));
        return;
      }
      if (!window.confirm(t(lang, "backupConfirm"))) return;
      await clearAllMedia();
      replaceAllPeople(data.people);
      if (Array.isArray(data.files) && data.files.length) {
        await importMediaFiles(data.files);
      }
      setDetailId(null);
      refresh();
      setToast(t(lang, "backupRestored"));
    } catch {
      setToast(t(lang, "backupInvalid"));
    }
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
          <button className="btn btn-secondary" onClick={toggleNotifications}>
            {notifOn ? t(lang, "turnOffReminders") : t(lang, "turnOnReminders")}
          </button>
        </div>
        <p className="notif-help">{t(lang, "notifHelp")}</p>
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
            <p className="who-paid">{t(lang, "whoPaid")}</p>
          </div>
        </div>
        <div className="stats stats-wide">
          <div className="stat pop-in" style={{ animationDelay: "0.05s" }}>
            <span>{t(lang, "people")}</span>
            <strong>{summary?.totalPeople ?? 0}</strong>
          </div>
          <div className="stat pop-in" style={{ animationDelay: "0.1s" }}>
            <span>{t(lang, "paid")}</span>
            <strong>{summary?.paid ?? 0}</strong>
          </div>
          <div className="stat pop-in" style={{ animationDelay: "0.15s" }}>
            <span>{t(lang, "overdue")}</span>
            <strong>{summary?.overdue ?? 0}</strong>
          </div>
          <div className="stat pop-in" style={{ animationDelay: "0.2s" }}>
            <span>{t(lang, "dueSoon")}</span>
            <strong>{summary?.dueSoon ?? 0}</strong>
          </div>
          <div className="stat pop-in" style={{ animationDelay: "0.25s" }}>
            <span>{t(lang, "expected")}</span>
            <strong className="money">
              {summary ? money(summary.expected, lang) : money(0, lang)}
            </strong>
          </div>
          <div className="stat pop-in" style={{ animationDelay: "0.3s" }}>
            <span>{t(lang, "collected")}</span>
            <strong className="money">
              {summary ? money(summary.collected, lang) : money(0, lang)}
            </strong>
          </div>
          <div className="stat pop-in" style={{ animationDelay: "0.35s" }}>
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
              <button
                key={r.id}
                type="button"
                className={`reminder ${r.state} slide-in reminder-btn`}
                style={{ animationDelay: `${0.05 + i * 0.07}s` }}
                onClick={() => setDetailId(r.id)}
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
              </button>
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

        <label className="search-box">
          <span className="sr-only">{t(lang, "search")}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(lang, "search")}
            type="search"
            enterKeyHint="search"
          />
        </label>

        {people.length === 0 ? (
          <div className="empty">{t(lang, "emptyPeople")}</div>
        ) : visiblePeople.length === 0 ? (
          <div className="empty">{t(lang, "noSearch")}</div>
        ) : (
          <div className="people">
            {visiblePeople.map((person, i) => (
              <article
                key={person.id}
                className="person-card slide-in"
                style={{ animationDelay: `${0.04 + i * 0.06}s` }}
              >
                <button
                  type="button"
                  className="person-main"
                  onClick={() => setDetailId(person.id)}
                >
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
                </button>
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
                    onClick={() => setDetailId(person.id)}
                  >
                    {t(lang, "details")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel anim-delay-4">
        <div className="section-head">
          <div>
            <h2>{t(lang, "dataSafety")}</h2>
            <p>{t(lang, "dataSafetySub")}</p>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-ok" onClick={exportBackup}>
            {t(lang, "exportBackup")}
          </button>
          <button
            className="btn btn-quiet"
            onClick={() => backupInputRef.current?.click()}
          >
            {t(lang, "importBackup")}
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void importBackup(e.target.files?.[0] || null);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetailId(null)}>
          <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="detail-top">
              <div className="photo-block">
                {photoUrl ? (
                  <img src={photoUrl} alt={detail.name} className="avatar" />
                ) : (
                  <div className="avatar placeholder">{t(lang, "noPhoto")}</div>
                )}
                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {detail.photoId ? t(lang, "changePhoto") : t(lang, "addPhoto")}
                  </button>
                  {detail.photoId && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => void onRemovePhoto(detail)}
                    >
                      {t(lang, "removePhoto")}
                    </button>
                  )}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    void onPhotoPicked(e.target.files?.[0] || null, detail);
                    e.target.value = "";
                  }}
                />
              </div>
              <div>
                <h2>{detail.name}</h2>
                <span className={`badge ${detail.status.state}`}>
                  {labelFor(lang, detail.status.state)}
                </span>
                <p className="detail-line">
                  {detail.room
                    ? `${t(lang, "room")} ${detail.room}`
                    : t(lang, "noRoom")}
                </p>
                <p className="detail-line">
                  {t(lang, "rent")} {money(detail.rentAmount, lang)} ·{" "}
                  {t(lang, "dueDay")} {detail.dueDay}
                </p>
                {detail.phone && (
                  <p className="detail-line">
                    <a className="call-link" href={`tel:${detail.phone}`}>
                      {t(lang, "call")} {detail.phone}
                    </a>
                  </p>
                )}
                {detail.notes && <p className="detail-notes">{detail.notes}</p>}
              </div>
            </div>

            <div className="actions detail-actions">
              {detail.status.state === "paid" ? (
                <button className="btn btn-quiet" onClick={() => onUndoPaid(detail)}>
                  {t(lang, "undoPaid")}
                </button>
              ) : (
                <button className="btn btn-ok" onClick={() => onMarkPaid(detail)}>
                  {t(lang, "markPaid")}
                </button>
              )}
              <button
                className="btn btn-quiet"
                onClick={() => {
                  openEdit(detail);
                }}
              >
                {t(lang, "edit")}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => void onRemove(detail)}
              >
                {t(lang, "remove")}
              </button>
            </div>

            <h3 className="subhead">{t(lang, "documents")}</h3>
            {(detail.documents || []).length === 0 ? (
              <p className="muted">{t(lang, "noDocuments")}</p>
            ) : (
              <ul className="doc-list">
                {detail.documents.map((doc) => (
                  <li key={doc.id}>
                    <span>{doc.name}</span>
                    <span className="actions">
                      <button
                        type="button"
                        className="btn btn-quiet"
                        onClick={() => void onOpenDoc(doc.id)}
                      >
                        {t(lang, "openDocument")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => void onRemoveDoc(detail, doc.id, doc.name)}
                      >
                        {t(lang, "removeDocument")}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => docInputRef.current?.click()}
            >
              {t(lang, "addDocument")}
            </button>
            <input
              ref={docInputRef}
              type="file"
              accept="image/*,application/pdf,.pdf,.doc,.docx,text/plain"
              hidden
              onChange={(e) => {
                void onDocPicked(e.target.files?.[0] || null, detail);
                e.target.value = "";
              }}
            />

            <h3 className="subhead">{t(lang, "paymentHistory")}</h3>
            <div className="history">
              {history.map((row) => (
                <div key={row.month} className={`history-row ${row.paid ? "ok" : ""}`}>
                  <div>
                    <strong>{formatMonth(row.month, lang)}</strong>
                    <p>
                      {t(lang, "amount")} {money(row.amount, lang)}
                    </p>
                  </div>
                  <div className="history-status">
                    {row.paid ? (
                      <>
                        <span className="badge paid">{t(lang, "paid")}</span>
                        <small>
                          {t(lang, "paidOn")} {formatDate(row.paidAt, lang)}
                        </small>
                      </>
                    ) : (
                      <span className="badge upcoming">{t(lang, "unpaid")}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setDetailId(null)}
              >
                {t(lang, "close")}
              </button>
            </div>
          </div>
        </div>
      )}

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
