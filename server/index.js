const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();
const PORT = 3737;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(cors());
app.use(express.json());

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = { people: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function monthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function dueDateForMonth(dueDay, year, monthIndex) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(Math.max(1, dueDay || 1), lastDay);
  return new Date(year, monthIndex, day);
}

function personStatus(person, today = new Date()) {
  const key = monthKey(today);
  const paid = (person.payments || []).some((p) => p.month === key);
  const due = dueDateForMonth(person.dueDay, today.getFullYear(), today.getMonth());
  due.setHours(23, 59, 59, 999);

  if (paid) return { state: "paid", due, month: key };
  if (today > due) return { state: "overdue", due, month: key };
  const soon = new Date(due);
  soon.setDate(soon.getDate() - 3);
  if (today >= soon) return { state: "due_soon", due, month: key };
  return { state: "upcoming", due, month: key };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "Inzu" });
});

app.get("/api/people", (_req, res) => {
  const data = load();
  const today = new Date();
  const people = data.people
    .map((p) => ({ ...p, status: personStatus(p, today) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(people);
});

app.get("/api/summary", (_req, res) => {
  const data = load();
  const today = new Date();
  let paid = 0;
  let overdue = 0;
  let dueSoon = 0;
  let expected = 0;
  let collected = 0;

  for (const p of data.people) {
    expected += Number(p.rentAmount) || 0;
    const status = personStatus(p, today);
    if (status.state === "paid") {
      paid += 1;
      collected += Number(p.rentAmount) || 0;
    } else if (status.state === "overdue") overdue += 1;
    else if (status.state === "due_soon") dueSoon += 1;
  }

  res.json({
    totalPeople: data.people.length,
    paid,
    overdue,
    dueSoon,
    upcoming: data.people.length - paid - overdue - dueSoon,
    expected,
    collected,
    outstanding: Math.max(0, expected - collected),
    month: monthKey(today),
  });
});

app.get("/api/reminders", (_req, res) => {
  const data = load();
  const today = new Date();
  const reminders = data.people
    .map((p) => ({ person: p, status: personStatus(p, today) }))
    .filter((x) => x.status.state === "overdue" || x.status.state === "due_soon")
    .map((x) => ({
      id: x.person.id,
      name: x.person.name,
      room: x.person.room,
      phone: x.person.phone,
      rentAmount: x.person.rentAmount,
      state: x.status.state,
      due: x.status.due.toISOString().slice(0, 10),
    }))
    .sort((a, b) => {
      if (a.state !== b.state) return a.state === "overdue" ? -1 : 1;
      return a.due.localeCompare(b.due);
    });
  res.json(reminders);
});

app.post("/api/people", (req, res) => {
  const { name, phone, room, rentAmount, dueDay, notes } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  const data = load();
  const person = {
    id: randomUUID(),
    name: String(name).trim(),
    phone: String(phone || "").trim(),
    room: String(room || "").trim(),
    rentAmount: Number(rentAmount) || 0,
    dueDay: Math.min(31, Math.max(1, Number(dueDay) || 1)),
    notes: String(notes || "").trim(),
    payments: [],
    createdAt: new Date().toISOString(),
  };
  data.people.push(person);
  save(data);
  res.status(201).json({ ...person, status: personStatus(person) });
});

app.put("/api/people/:id", (req, res) => {
  const data = load();
  const idx = data.people.findIndex((p) => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Person not found" });

  const current = data.people[idx];
  const { name, phone, room, rentAmount, dueDay, notes } = req.body || {};
  data.people[idx] = {
    ...current,
    name: name != null ? String(name).trim() : current.name,
    phone: phone != null ? String(phone).trim() : current.phone,
    room: room != null ? String(room).trim() : current.room,
    rentAmount: rentAmount != null ? Number(rentAmount) || 0 : current.rentAmount,
    dueDay:
      dueDay != null
        ? Math.min(31, Math.max(1, Number(dueDay) || 1))
        : current.dueDay,
    notes: notes != null ? String(notes).trim() : current.notes,
  };
  save(data);
  res.json({ ...data.people[idx], status: personStatus(data.people[idx]) });
});

app.delete("/api/people/:id", (req, res) => {
  const data = load();
  const before = data.people.length;
  data.people = data.people.filter((p) => p.id !== req.params.id);
  if (data.people.length === before) {
    return res.status(404).json({ error: "Person not found" });
  }
  save(data);
  res.json({ ok: true });
});

app.post("/api/people/:id/pay", (req, res) => {
  const data = load();
  const person = data.people.find((p) => p.id === req.params.id);
  if (!person) return res.status(404).json({ error: "Person not found" });

  const key = req.body?.month || monthKey();
  person.payments = person.payments || [];
  if (!person.payments.some((p) => p.month === key)) {
    person.payments.push({
      month: key,
      amount: Number(req.body?.amount ?? person.rentAmount) || 0,
      paidAt: new Date().toISOString(),
    });
  }
  save(data);
  res.json({ ...person, status: personStatus(person) });
});

app.delete("/api/people/:id/pay/:month", (req, res) => {
  const data = load();
  const person = data.people.find((p) => p.id === req.params.id);
  if (!person) return res.status(404).json({ error: "Person not found" });
  person.payments = (person.payments || []).filter((p) => p.month !== req.params.month);
  save(data);
  res.json({ ...person, status: personStatus(person) });
});

app.listen(PORT, () => {
  console.log(`Inzu server ready on http://localhost:${PORT}`);
});
