# Deployment Guide — Timeregistrering

## 1. Sett opp Firebase-prosjekt

1. Gå til [Firebase Console](https://console.firebase.google.com/)
2. Opprett nytt prosjekt (f.eks. "timetracker-hans")
3. **Authentication** → Sign-in method → Google → Aktiver
4. **Firestore** → Create database → Start in production mode → Velg region (europe-west)
5. **Firestore** → Rules → Lim inn innholdet fra `firestore.rules`
6. **Project Settings** → Your apps → Add app → Web → Kopier firebaseConfig

## 2. Konfigurer miljøvariabler lokalt

Rediger `.env.local` og fyll inn verdiene fra Firebase:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_ALLOWED_EMAIL=hans.nikolai.forde@gmail.com
```

## 3. Test lokalt

```bash
npm run dev
```

Åpne http://localhost:3000 og test innlogging med Google.

## 4. Sett opp Heroku

### Installer Heroku CLI
Last ned fra https://devcenter.heroku.com/articles/heroku-cli

### Opprett app og deploy

```bash
# Logg inn
heroku login

# Opprett app (navngi den noe ledig, f.eks. "hans-timetracker")
heroku create hans-timetracker

# Sett miljøvariabler (samme som .env.local, men uten NEXT_PUBLIC_ prefiks for sikkerhet er OK)
heroku config:set NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
heroku config:set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
heroku config:set NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
heroku config:set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
heroku config:set NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
heroku config:set NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
heroku config:set NEXT_PUBLIC_ALLOWED_EMAIL=hans.nikolai.forde@gmail.com
heroku config:set NODE_ENV=production

# Deploy
git add .
git commit -m "Initial deploy"
git push heroku main
```

### Heroku buildpack
Heroku bruker automatisk Node.js buildpack. `next build` kjøres under deploy, og `next start -p $PORT` starter serveren.

## 5. Firebase Authorized Domains

Gå til Firebase Console → Authentication → Settings → Authorized domains → 
Legg til din Heroku-URL: `hans-timetracker.herokuapp.com`

## 6. Oppdateringer

For å deploye endringer:
```bash
git add .
git commit -m "Din melding"
git push heroku main
```
