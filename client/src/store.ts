export type StatusState =
  | "paid"
  | "partial"
  | "overdue"
  | "due_soon"
  | "upcoming";

export type PayMethod = "cash" | "momo";

export type DocRef = {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
};

export type Payment = {
  id: string;
  receiptNo: string;
  month: string;
  amount: number;
  paidAt: string;
  method: PayMethod;
};

export type Person = {
  id: string;
  name: string;
  nationalId: string;
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
    paidAmount: number;
    balance: number;
  };
};

export type Summary = {
  totalPeople: number;
  paid: number;
  partial: number;
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
  nationalId: string;
  rentAmount: number;
  paidAmount: number;
  balance: number;
  state: "overdue" | "due_soon" | "partial";
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
const RECEIPT_SEQ_KEY = "inzu-receipt-seq";

function normalizePayment(raw: Partial<Payment>): Payment {
  return {
    id: raw.id || crypto.randomUUID(),
    receiptNo: raw.receiptNo || `REC-${new Date().getFullYear()}-OLD`,
    month: String(raw.month || monthKey()),
    amount: Number(raw.amount) || 0,
    paidAt: raw.paidAt || new Date().toISOString(),
    method: raw.method === "momo" ? "momo" : "cash",
  };
}

function normalizePerson(raw: Partial<Person> & { id: string }): Person {
  return {
    id: raw.id,
    name: String(raw.name || ""),
    nationalId: String(raw.nationalId || ""),
    phone: String(raw.phone || ""),
    room: String(raw.room || ""),
    rentAmount: Number(raw.rentAmount) || 0,
    dueDay: Math.min(31, Math.max(1, Number(raw.dueDay) || 1)),
    notes: String(raw.notes || ""),
    photoId: raw.photoId || null,
    documents: Array.isArray(raw.documents) ? raw.documents : [],
    payments: Array.isArray(raw.payments)
      ? raw.payments.map((p) => normalizePayment(p))
      : [],
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

export function nextReceiptNo() {
  const year = new Date().getFullYear();
  const raw = Number(localStorage.getItem(RECEIPT_SEQ_KEY) || "0");
  const next = raw + 1;
  localStorage.setItem(RECEIPT_SEQ_KEY, String(next));
  return `REC-${year}-${String(next).padStart(3, "0")}`;
}

export function paymentsForMonth(person: Person, month: string) {
  return (person.payments || []).filter((p) => p.month === month);
}

export function paidAmountForMonth(person: Person, month: string) {
  return paymentsForMonth(person, month).reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );
}

export function balanceForMonth(person: Person, month: string) {
  const rent = Number(person.rentAmount) || 0;
  return Math.max(0, rent - paidAmountForMonth(person, month));
}

export function personStatus(person: Person, today = new Date()) {
  const key = monthKey(today);
  const paidAmount = paidAmountForMonth(person, key);
  const rent = Number(person.rentAmount) || 0;
  const balance = Math.max(0, rent - paidAmount);
  const due = dueDateForMonth(
    person.dueDay,
    today.getFullYear(),
    today.getMonth()
  );

  if (rent > 0 && paidAmount >= rent) {
    return { state: "paid" as const, due, month: key, paidAmount, balance: 0 };
  }
  if (paidAmount > 0 && balance > 0) {
    return {
      state: "partial" as const,
      due,
      month: key,
      paidAmount,
      balance,
    };
  }
  if (today > due) {
    return { state: "overdue" as const, due, month: key, paidAmount, balance };
  }
  const soon = new Date(due);
  soon.setDate(soon.getDate() - 3);
  if (today >= soon) {
    return {
      state: "due_soon" as const,
      due,
      month: key,
      paidAmount,
      balance,
    };
  }
  return { state: "upcoming" as const, due, month: key, paidAmount, balance };
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
          paidAmount: status.paidAmount,
          balance: status.balance,
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
    const hay =
      `${p.name} ${p.nationalId} ${p.phone} ${p.room} ${p.notes}`.toLowerCase();
    return hay.includes(q);
  });
}

export function getSummary(): Summary {
  const people = loadPeople();
  const today = new Date();
  const key = monthKey(today);
  let paid = 0;
  let partial = 0;
  let overdue = 0;
  let dueSoon = 0;
  let expected = 0;
  let collected = 0;

  for (const p of people) {
    expected += Number(p.rentAmount) || 0;
    collected += paidAmountForMonth(p, key);
    const status = personStatus(p, today);
    if (status.state === "paid") paid += 1;
    else if (status.state === "partial") partial += 1;
    else if (status.state === "overdue") overdue += 1;
    else if (status.state === "due_soon") dueSoon += 1;
  }

  return {
    totalPeople: people.length,
    paid,
    partial,
    overdue,
    dueSoon,
    upcoming: people.length - paid - partial - overdue - dueSoon,
    expected,
    collected,
    outstanding: Math.max(0, expected - collected),
    month: key,
  };
}

export function getReminders(): Reminder[] {
  return listPeople()
    .filter(
      (p) =>
        p.status.state === "overdue" ||
        p.status.state === "due_soon" ||
        p.status.state === "partial"
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      room: p.room,
      phone: p.phone,
      nationalId: p.nationalId,
      rentAmount: p.rentAmount,
      paidAmount: p.status.paidAmount,
      balance: p.status.balance,
      state: p.status.state as "overdue" | "due_soon" | "partial",
      due: p.status.due.slice(0, 10),
    }))
    .sort((a, b) => {
      const rank = { overdue: 0, partial: 1, due_soon: 2 };
      if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
      return a.due.localeCompare(b.due);
    });
}

export type HistoryRow = {
  month: string;
  rentAmount: number;
  paidAmount: number;
  balance: number;
  paidAt: string | null;
  fullyPaid: boolean;
  partial: boolean;
  payments: Payment[];
};

/** Full calendar year January → December for the given year (defaults to this year). */
export function paymentHistory(
  person: Person,
  year = new Date().getFullYear()
): HistoryRow[] {
  const rows: HistoryRow[] = [];
  const rent = Number(person.rentAmount) || 0;

  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const pays = paymentsForMonth(person, key).sort((a, b) =>
      a.paidAt.localeCompare(b.paidAt)
    );
    const paidAmount = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const balance = Math.max(0, rent - paidAmount);
    rows.push({
      month: key,
      rentAmount: rent,
      paidAmount,
      balance,
      paidAt: pays.length ? pays[pays.length - 1].paidAt : null,
      fullyPaid: rent > 0 && paidAmount >= rent,
      partial: paidAmount > 0 && balance > 0,
      payments: pays,
    });
  }
  return rows;
}

export function addPerson(input: {
  name: string;
  nationalId: string;
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
    nationalId: input.nationalId.trim(),
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
    nationalId: string;
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
    nationalId: input.nationalId.trim(),
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

/** Record a payment (full or partial). Returns the payment slip data. */
export function recordPayment(
  id: string,
  input: { amount: number; method: PayMethod; month?: string }
) {
  const people = loadPeople();
  const person = people.find((p) => p.id === id);
  if (!person) throw new Error("Person not found");
  const month = input.month || monthKey();
  const amount = Math.max(0, Number(input.amount) || 0);
  if (amount <= 0) throw new Error("Amount required");

  const payment: Payment = {
    id: crypto.randomUUID(),
    receiptNo: nextReceiptNo(),
    month,
    amount,
    paidAt: new Date().toISOString(),
    method: input.method === "momo" ? "momo" : "cash",
  };
  person.payments = [...(person.payments || []), payment];
  savePeople(people);
  return { person, payment, balance: balanceForMonth(person, month) };
}

export function undoPaid(id: string, month: string) {
  const people = loadPeople();
  const person = people.find((p) => p.id === id);
  if (!person) throw new Error("Person not found");
  person.payments = (person.payments || []).filter((p) => p.month !== month);
  savePeople(people);
  return person;
}

export function deletePayment(personId: string, paymentId: string) {
  const people = loadPeople();
  const person = people.find((p) => p.id === personId);
  if (!person) throw new Error("Person not found");
  person.payments = (person.payments || []).filter((p) => p.id !== paymentId);
  savePeople(people);
  return person;
}

export function findPayment(
  personId: string,
  paymentId: string
): { person: Person; payment: Payment } | null {
  const person = loadPeople().find((p) => p.id === personId);
  if (!person) return null;
  const payment = (person.payments || []).find((p) => p.id === paymentId);
  if (!payment) return null;
  return { person, payment };
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
