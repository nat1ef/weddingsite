# RSVP to Google Sheets

Έτοιμο Google Apps Script backend για να γράφονται οι RSVP απαντήσεις σε Google Sheet.

## Τι χρειάζεται

1. Ένα Google account
2. Ένα νέο Google Sheet
3. Deploy ενός Apps Script ως Web App
4. Το deployment URL να περαστεί στο `config.js`

## Setup

1. Δημιουργήστε νέο Google Sheet.
2. Ανοίξτε `Extensions` -> `Apps Script`.
3. Κάντε paste το περιεχόμενο του [Code.gs](/c:/Users/manos/Downloads/wedding-microsite-project/wedding-microsite/rsvp-google-sheets/Code.gs).
4. Πατήστε `Deploy` -> `New deployment`.
5. Επιλέξτε `Web app`.
6. Βάλτε access: `Anyone`.*
7. Αντιγράψτε το URL του deployment.
8. Περάστε το URL στο [config.js](/c:/Users/manos/Downloads/wedding-microsite-project/wedding-microsite/config.js) στο `rsvp.endpoint`.

## Config

Παράδειγμα:

```js
rsvp: {
  deadline: '10 Ιουνίου 2026',
  endpoint: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  method: 'POST',
  successMessage: 'Η επιβεβαίωσή σας καταχωρίστηκε επιτυχώς.',
}
```

## Τι γράφεται στο Sheet

Το script δημιουργεί φύλλο `RSVP` με στήλες:

- `timestamp`
- `name`
- `guests`
- `attendance`
- `message`
- `privacy`
- `eventDate`
- `eventVenue`

## Τι στέλνει το frontend

Το site στέλνει:

```json
{
  "name": "Μαρία Παπαδοπούλου",
  "guests": "2",
  "attendance": "Ναι, με χαρά",
  "message": "Ανυπομονούμε",
  "privacy": true,
  "eventDate": "12 Ιουλίου 2026",
  "eventVenue": "..."
}
```

## Σημείωση

Αν θέλεις, μπορώ στο επόμενο βήμα να σου το ετοιμάσω και με:

- αυτόματο email notification όταν έρχεται νέο RSVP
- ξεχωριστή στήλη για τηλέφωνο
- φίλτρο για συνολικό αριθμό καλεσμένων
