export type Lang = "en" | "rw" | "fr";

export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  rw: "Kinyarwanda",
  fr: "Français",
};

type Dict = Record<string, string>;

const en: Dict = {
  tagline:
    "Record people in your house, track monthly rent, and see reminders when payment is due. Free on your phone — no fees.",
  addPerson: "Add person",
  turnOnReminders: "Turn on reminders",
  saveOnPhone: "Save Inzu on this phone",
  installAndroid: "Android Chrome: menu → Add to Home screen / Install app.",
  installIos: "iPhone Safari: Share → Add to Home Screen.",
  thisMonth: "This month",
  houseSummary: "House summary",
  people: "People",
  paid: "Paid",
  overdue: "Overdue",
  stillOwed: "Still owed",
  dueSoon: "Due soon",
  upcoming: "Upcoming",
  reminders: "Reminders",
  remindersSub: "People who need a follow-up today",
  peopleInHouse: "People in the house",
  peopleSub: "Tap Paid when rent for this month is received",
  add: "+ Add",
  emptyPeople: "No one recorded yet. Add the first person living in the house.",
  noRoom: "No room set",
  room: "Room",
  rent: "Rent",
  dueDay: "Due day",
  due: "Due",
  markPaid: "Mark paid",
  undoPaid: "Undo paid",
  edit: "Edit",
  remove: "Remove",
  editPerson: "Edit person",
  fullName: "Full name",
  phone: "Phone",
  roomUnit: "Room / unit",
  monthlyRent: "Monthly rent (RWF)",
  dueDayEachMonth: "Due day each month",
  notes: "Notes",
  optionalNote: "Optional note",
  cancel: "Cancel",
  saveChanges: "Save changes",
  savePerson: "Save person",
  nameRequired: "Name is required",
  personUpdated: "Person updated",
  personAdded: "Person added",
  markedPaid: "Marked {name} as paid",
  paymentUndone: "Payment undone for {name}",
  removeConfirm: "Remove {name} from Inzu?",
  removed: "{name} removed",
  noNotifSupport: "This phone browser does not support notifications",
  remindersEnabled: "Reminders enabled on this phone",
  notifDenied: "Notifications were not allowed",
  notifTitle: "Inzu rent reminder",
  notifBodyOverdue: "{overdue} overdue · {soon} due soon",
  notifBodySoon: "{soon} rent payment(s) due soon",
  language: "Language",
};

const rw: Dict = {
  tagline:
    "Andika abantu baba mu nzu yawe, kurikirana ubukode bwa buri kwezi, kandi ubone ibyibutso iyo igihe cyo kwishyura geze. Ni ubuntu kuri telefone — nta kiguzi.",
  addPerson: "Ongeraho umuntu",
  turnOnReminders: "Fungura ibyibutso",
  saveOnPhone: "Bika Inzu kuri iyi telefone",
  installAndroid: "Android Chrome: menu → Add to Home screen / Install app.",
  installIos: "iPhone Safari: Share → Add to Home Screen.",
  thisMonth: "Uku kwezi",
  houseSummary: "Incamake y'inzu",
  people: "Abantu",
  paid: "Byishyuwe",
  overdue: "Byarenze igihe",
  stillOwed: "Biracyishyurwa",
  dueSoon: "Biritegereje",
  upcoming: "Bizaza",
  reminders: "Ibyibutso",
  remindersSub: "Abantu bakenewe gukurikiranwa uyu munsi",
  peopleInHouse: "Abantu bari mu nzu",
  peopleSub: "Kanda Byishyuwe iyo wakira ubukode bw'uku kwezi",
  add: "+ Ongeraho",
  emptyPeople: "Nta muntu wanditse. Ongeraho uwa mbere uba mu nzu.",
  noRoom: "Nta cyumba cyashyizweho",
  room: "Icyumba",
  rent: "Ubukode",
  dueDay: "Umunsi wo kwishyura",
  due: "Igihe",
  markPaid: "Byishyuwe",
  undoPaid: "Subiza inyuma",
  edit: "Hindura",
  remove: "Kuraho",
  editPerson: "Hindura umuntu",
  fullName: "Amazina yuzuye",
  phone: "Telefone",
  roomUnit: "Icyumba",
  monthlyRent: "Ubukode bwa buri kwezi (RWF)",
  dueDayEachMonth: "Umunsi wo kwishyura buri kwezi",
  notes: "Inyandiko",
  optionalNote: "Inyandiko niba ubishaka",
  cancel: "Hagarika",
  saveChanges: "Bika impinduka",
  savePerson: "Bika umuntu",
  nameRequired: "Amazina arakenewe",
  personUpdated: "Umuntu yahinduwe",
  personAdded: "Umuntu yongeyeho",
  markedPaid: "{name} yishyuwe",
  paymentUndone: "Kwishyura kwa {name} byasubijwe",
  removeConfirm: "Kuraho {name} muri Inzu?",
  removed: "{name} yakuyeho",
  noNotifSupport: "Iyi telefone ntabwo ishyigikira amatangazo",
  remindersEnabled: "Ibyibutso byafunguwe kuri iyi telefone",
  notifDenied: "Amatangazo ntiyemerewe",
  notifTitle: "Icyibutso cy'ubukode - Inzu",
  notifBodyOverdue: "{overdue} byarenze igihe · {soon} biritegereje",
  notifBodySoon: "{soon} kwishyura ubukode biritegereje",
  language: "Ururimi",
};

const fr: Dict = {
  tagline:
    "Enregistrez les personnes de votre maison, suivez le loyer mensuel et voyez les rappels quand le paiement est dû. Gratuit sur téléphone — sans frais.",
  addPerson: "Ajouter une personne",
  turnOnReminders: "Activer les rappels",
  saveOnPhone: "Enregistrer Inzu sur ce téléphone",
  installAndroid: "Android Chrome : menu → Ajouter à l'écran d'accueil / Installer.",
  installIos: "iPhone Safari : Partager → Sur l'écran d'accueil.",
  thisMonth: "Ce mois",
  houseSummary: "Résumé de la maison",
  people: "Personnes",
  paid: "Payé",
  overdue: "En retard",
  stillOwed: "Reste dû",
  dueSoon: "Bientôt dû",
  upcoming: "À venir",
  reminders: "Rappels",
  remindersSub: "Personnes à relancer aujourd'hui",
  peopleInHouse: "Personnes dans la maison",
  peopleSub: "Touchez Payé quand le loyer du mois est reçu",
  add: "+ Ajouter",
  emptyPeople: "Personne enregistrée. Ajoutez la première personne de la maison.",
  noRoom: "Pas de chambre",
  room: "Chambre",
  rent: "Loyer",
  dueDay: "Jour d'échéance",
  due: "Échéance",
  markPaid: "Marquer payé",
  undoPaid: "Annuler payé",
  edit: "Modifier",
  remove: "Supprimer",
  editPerson: "Modifier la personne",
  fullName: "Nom complet",
  phone: "Téléphone",
  roomUnit: "Chambre / unité",
  monthlyRent: "Loyer mensuel (RWF)",
  dueDayEachMonth: "Jour d'échéance chaque mois",
  notes: "Notes",
  optionalNote: "Note optionnelle",
  cancel: "Annuler",
  saveChanges: "Enregistrer",
  savePerson: "Enregistrer",
  nameRequired: "Le nom est obligatoire",
  personUpdated: "Personne mise à jour",
  personAdded: "Personne ajoutée",
  markedPaid: "{name} marqué(e) payé(e)",
  paymentUndone: "Paiement annulé pour {name}",
  removeConfirm: "Supprimer {name} de Inzu ?",
  removed: "{name} supprimé(e)",
  noNotifSupport: "Ce navigateur ne prend pas en charge les notifications",
  remindersEnabled: "Rappels activés sur ce téléphone",
  notifDenied: "Notifications non autorisées",
  notifTitle: "Rappel de loyer Inzu",
  notifBodyOverdue: "{overdue} en retard · {soon} bientôt dû",
  notifBodySoon: "{soon} paiement(s) bientôt dû(s)",
  language: "Langue",
};

const TABLES: Record<Lang, Dict> = { en, rw, fr };

export function t(lang: Lang, key: string, vars?: Record<string, string | number>) {
  let text = TABLES[lang][key] || TABLES.en[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export function loadLang(): Lang {
  const saved = localStorage.getItem("inzu-lang");
  if (saved === "en" || saved === "rw" || saved === "fr") return saved;
  return "rw";
}

export function saveLang(lang: Lang) {
  localStorage.setItem("inzu-lang", lang);
}

export function localeFor(lang: Lang) {
  if (lang === "rw") return "rw-RW";
  if (lang === "fr") return "fr-FR";
  return "en";
}
