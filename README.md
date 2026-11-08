# Inzu

Free home app to record people living in your house, track monthly rent, and get reminders when payment is due.

**Not** the school RentEase exam project. This is a separate product for real home use.

## For Dad — how to open

1. Double-click **`Start Inzu.bat`** (or `start.bat`)
2. Wait for the browser to open at **http://127.0.0.1:5173**
3. Keep the black window open while using the app
4. Click **Turn on reminders** once so Windows can notify you

## What you can do

- Add people (name, phone, room, rent amount, due day)
- See who is paid, due soon, or overdue this month
- Mark rent as paid with one tap
- Get reminders for overdue and soon-due payments

## Technical

- Frontend: React + Vite
- Backend: Express on port `3737`
- Data: saved locally in `server/data.json` (no cloud, no fees)

## Developer commands

```bash
npm run install:all
npm start
```
