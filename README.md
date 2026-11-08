# Inzu

Free house app for your phone: record people living in the house, track monthly rent, keep optional photos/documents, and see reminders when payment is due.

**No fees. No PC required for your dad.**

School RentEase exam project is separate and was not changed.

## For Dad (phone only)

1. Open this link on the phone browser (Chrome or Safari):

   **https://ishimwefabrice.github.io/inzu/**

2. Add it to the Home Screen:
   - **Android Chrome:** menu ⋮ → **Add to Home screen** / **Install app**
   - **iPhone Safari:** Share → **Add to Home Screen**

3. Open the **Inzu** icon like a normal app.

4. Choose language (Kinyarwanda / English / Français).

5. Tap **Turn on reminders** once if he wants phone alerts.

6. Use **Download backup** sometimes so records are safe if the phone is lost.

Data is saved on that phone (free, private). Use the same phone to keep the records.

## What he can do

- Add / search / edit / remove people
- See who is paid / due soon / overdue
- Mark rent paid with one tap; keep payment history
- Optional photo and documents per person (stored on the phone)
- Phone reminders (optional) plus in-app reminder list
- Backup and restore everything (including photos/documents)

## For developers (optional PC)

```bash
cd client
npm install
npm run dev
```

Build for GitHub Pages:

```bash
cd client
npm run build
npx gh-pages -d dist
```

Vite base path must stay `/inzu/`.
