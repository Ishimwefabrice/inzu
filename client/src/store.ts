export type StatusState = "paid" | "overdue" | "due_soon" | "upcoming";

export type DocRef = {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
};

export type Payment = {
  month: string;
  amount: number;
  paidAt: string;
};

export type Person = {
  id: string;
  name: string;
  phone: string;
  room: string;
  rentAmount: number;
  dueDay: number;
  notes: string;
  photoId: string | null;
  documents: DocRef[];
  payments: Payment[];
  createdAt: string;
};

export type PersonView = Person & {
  status: {
    state: StatusState;
    due: string;
    month: string;
  };
};

export type Summary = {
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

export type Reminder = {
  id: string;
  name: string;
  room: string;
  phone: string;
  rentAmount: number;
  state: "overdue" | "due_soon";
  due: string;
};

export type BackupPayload = {
  version: 1;
  app: "inzu";
  exportedAt: string;
  people: Person[];
  files: {
    id: string;
    personId: string;
    kind: "photo" | "doc";
    name: string;
    mime: string;
    size: number;
    createdAt: string;
    dataBase64: string;
  }[];
};

const STORAGE_KEY = "inzu-people-v1";
const NOTIF_PREF_KEY = "inzu-notif-enabled";
const NOTIF_SENT_KEY = "inzu-notif-sent";

function normalizePerson(raw: Partial<Person> & { id: string }): Person {
  return {
    id: raw.id,
    name: String(raw.name || ""),
    phone: String(raw.phone || ""),
    room: String(raw.room || ""),
    rentAmount: Number(raw.rentAmount) || 0,
    dueDay: Math.min(31, Math.max(1, Number(raw.dueDay) || 1)),
    notes: String(raw.notes || ""),
    photoId: raw.photoId || null,
    documents: Array.isArray(raw.documents) ? raw.documents : [],
    payments: Array.isArray(raw.payments) ? raw.payments : [],
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function loadPeople(): Person[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => normalizePerson(p));
  } catch {
    return [];
  }
}

function savePeople(people: Person[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

export function monthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function dueDateForMonth(dueDay: number, year: number, monthIndex: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(Math.max(1, dueDay || 1), lastDay);
  const due = new Date(year, monthIndex, day);
  due.setHours(23, 59, 59, 999);
  return due;
}

export function personStatus(person: Person, today = new Date()) {
  const key = monthKey(today);
  const paid = (person.payments || []).some((p) => p.month === key);
  const due = dueDateForMonth(person.dueDay, today.getFullYear(), today.getMonth());

  if (paid) return { state: "paid" as const, due, month: key };
  if (today > due) return { state: "overdue" as const, due, month: key };
  const soon = new Date(due);
  soon.setDate(soon.getDate() - 3);
  if (today >= soon) return { state: "due_soon" as const, due, month: key };
  return { state: "upcoming" as const, due, month: key };
}

export function listPeople(): PersonView[] {
  const today = new Date();
  return loadPeople()
    .map((p) => {
      const status = personStatus(p, today);
      return {
        ...p,
        status: {
          state: status.state,
          due: status.due.toISOString(),
          month: status.month,
        },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getPerson(id: string): PersonView | null {
  return listPeople().find((p) => p.id === id) || null;
}

export function searchPeople(query: string): PersonView[] {
  const q = query.trim().toLowerCase();
  if (!q) return listPeople();
  return listPeople().filter((p) => {
    const hay = `${p.name} ${p.phone} ${p.room} ${p.notes}`.toLowerCase();
    return hay.includes(q);
  });
}

export function getSummary(): Summary {
  const people = loadPeople();
  const today = new Date();
  let paid = 0;
  let overdue = 0;
  let dueSoon = 0;
  let expected = 0;
  let collected = 0;

  for (const p of people) {
    expected += Number(p.rentAmount) || 0;
    const status = personStatus(p, today);
    if (status.state === "paid") {
      paid += 1;
      collected += Number(p.rentAmount) || 0;
    } else if (status.state === "overdue") overdue += 1;
    else if (status.state === "due_soon") dueSoon += 1;
  }

  return {
    totalPeople: people.length,
    paid,
    overdue,
    dueSoon,
    upcoming: people.length - paid - overdue - dueSoon,
    expected,
    collected,
    outstanding: Math.max(0, expected - collected),
    month: monthKey(today),
  };
}

export function getReminders(): Reminder[] {
  return listPeople()
    .filter((p) => p.status.state === "overdue" || p.status.state === "due_soon")
    .map((p) => ({
      id: p.id,
      name: p.name,
      room: p.room,
      phone: p.phone,
      rentAmount: p.rentAmount,
      state: p.status.state as "overdue" | "due_soon",
      due: p.status.due.slice(0, 10),
    }))
    .sort((a, b) => {
      if (a.state !== b.state) return a.state === "overdue" ? -1 : 1;
      return a.due.localeCompare(b.due);
    });
}

export type HistoryRow = {
  month: string;
  amount: number;
  paidAt: string | null;
  paid: boolean;
};

/** Full calendar year January → December for the given year (defaults to this year). */
export function paymentHistory(person: Person, year = new Date().getFullYear()): HistoryRow[] {
  const rows: HistoryRow[] = [];
  const map = new Map((person.payments || []).map((p) => [p.month, p]));

  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const pay = map.get(key);
    rows.push({
      month: key,
      amount: pay ? pay.amount : Number(person.rentAmount) || 0,
      paidAt: pay ? pay.paidAt : null,
      paid: Boolean(pay),
    });
  }
  return rows;
}

export function addPerson(input: {
  name: string;
  phone: string;
  room: string;
  rentAmount: number;
  dueDay: number;
  notes: string;
}) {
  const people = loadPeople();
  const person: Person = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    phone: input.phone.trim(),
    room: input.room.trim(),
    rentAmount: Number(input.rentAmount) || 0,
    dueDay: Math.min(31, Math.max(1, Number(input.dueDay) || 1)),
    notes: input.notes.trim(),
    photoId: null,
    documents: [],
    payments: [],
    createdAt: new Date().toISOString(),
  };
  people.push(person);
  savePeople(people);
  return person;
}

export function updatePerson(
  id: string,
  input: {
    name: string;
    phone: string;
    room: string;
    rentAmount: number;
    dueDay: number;
    notes: string;
  }
) {
  const people = loadPeople();
  const idx = people.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error("Person not found");
  people[idx] = {
    ...people[idx],
    name: input.name.trim(),
    phone: input.phone.trim(),
    room: input.room.trim(),
    rentAmount: Number(input.rentAmount) || 0,
    dueDay: Math.min(31, Math.max(1, Number(input.dueDay) || 1)),
    notes: input.notes.trim(),
  };
  savePeople(people);
  return people[idx];
}

export function setPersonPhoto(id: string, photoId: string | null) {
  const people = loadPeople();
  const person = people.find((p) => p.id === id);
  if (!person) throw new Error("Person not found");
  person.photoId = photoId;
  savePeople(people);
  return person;
}

export function addPersonDocument(id: string, doc: DocRef) {
  const people = loadPeople();
  const person = people.find((p) => p.id === id);
  if (!person) throw new Error("Person not found");
  person.documents = [...(person.documents || []), doc];
  savePeople(people);
  return person;
}

export function removePersonDocument(id: string, docId: string) {
  const people = loadPeople();
  const person = people.find((p) => p.id === id);
  if (!person) throw new Error("Person not found");
  person.documents = (person.documents || []).filter((d) => d.id !== docId);
  savePeople(people);
  return person;
}

export function deletePerson(id: string) {
  const people = loadPeople().filter((p) => p.id !== id);
  savePeople(people);
}

export function markPaid(id: string, month = monthKey()) {
  const people = loadPeople();
  const person = people.find((p) => p.id === id);
  if (!person) throw new Error("Person not found");
  person.payments = person.payments || [];
  if (!person.payments.some((p) => p.month === month)) {
    person.payments.push({
      month,
      amount: Number(person.rentAmount) || 0,
      paidAt: new Date().toISOString(),
    });
  }
  savePeople(people);
  return person;
}

export function undoPaid(id: string, month: string) {
  const people = loadPeople();
  const person = people.find((p) => p.id === id);
  if (!person) throw new Error("Person not found");
  person.payments = (person.payments || []).filter((p) => p.month !== month);
  savePeople(people);
  return person;
}

export function replaceAllPeople(people: Person[]) {
  savePeople(people.map((p) => normalizePerson(p)));
}

export function getRawPeople(): Person[] {
  return loadPeople();
}

export function notificationsEnabled(): boolean {
  return localStorage.getItem(NOTIF_PREF_KEY) === "1";
}

export function setNotificationsEnabled(on: boolean) {
  localStorage.setItem(NOTIF_PREF_KEY, on ? "1" : "0");
}

/** Returns true if we should show a browser notification now (once per day per reminder set). */
export function shouldSendReminderNotification(reminders: Reminder[]): boolean {
  if (!notificationsEnabled()) return false;
  if (reminders.length === 0) return false;
  const day = new Date().toISOString().slice(0, 10);
  const fingerprint = reminders
    .map((r) => `${r.id}:${r.state}`)
    .sort()
    .join("|");
  const token = `${day}::${fingerprint}`;
  const last = localStorage.getItem(NOTIF_SENT_KEY);
  if (last === token) return false;
  localStorage.setItem(NOTIF_SENT_KEY, token);
  return true;
}
