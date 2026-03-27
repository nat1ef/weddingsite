# Gift Registry Backend

Αυτός ο φάκελος περιέχει έτοιμο backend για Google Apps Script + Google Sheets ώστε η λίστα δώρων να είναι κοινή για όλους τους επισκέπτες.

## Τι κάνει

- Επιστρέφει την τρέχουσα κατάσταση όλων των δώρων
- Δέχεται δέσμευση για ένα `itemId`
- Κλειδώνει το δώρο ώστε να μην το πάρει δεύτερος επισκέπτης
- Υποστηρίζει και admin actions για `markPurchased` ή `release`

## Setup

1. Δημιουργήστε ένα νέο Google Sheet.
2. Από το Google Sheet ανοίξτε `Extensions` -> `Apps Script`.
3. Αντιγράψτε το περιεχόμενο του [Code.gs](/c:/Users/manos/Downloads/wedding-microsite-project/wedding-microsite/gift-registry-backend/Code.gs) στο script editor.
4. Αλλάξτε το `ADMIN_TOKEN` σε δική σας μυστική τιμή.
5. Πατήστε `Deploy` -> `New deployment` -> `Web app`.
6. Βάλτε access: `Anyone`.
7. Αντιγράψτε το deployment URL.
8. Περάστε το URL στο [config.js](/c:/Users/manos/Downloads/wedding-microsite-project/wedding-microsite/config.js) στο `gift.registry.endpoint`.

## Frontend config

Στο [config.js](/c:/Users/manos/Downloads/wedding-microsite-project/wedding-microsite/config.js):

```js
gift: {
  registry: {
    enabled: true,
    endpoint: 'https://script.google.com/macros/s/PASTE_YOUR_DEPLOYMENT_ID/exec',
    fallbackMode: 'local',
    items: [
      {
        id: 'espresso-machine',
        title: 'Μηχανή espresso',
        store: 'Kotsovolos',
        price: '€249',
        category: 'Κουζίνα',
        url: 'https://www.kotsovolos.gr/...',
        description: 'Το ακριβές link του προϊόντος',
      },
    ],
  },
}
```

## API shape

`GET`:

```json
{
  "ok": true,
  "items": [
    {
      "id": "espresso-machine",
      "status": "reserved"
    }
  ]
}
```

`POST reserve`:

```json
{
  "action": "reserve",
  "itemId": "espresso-machine",
  "guestName": "Μαρία Παπαδοπούλου",
  "guestContact": "6900000000",
  "note": "Θα το στείλουμε μετά τον γάμο"
}
```

`POST markPurchased`:

```json
{
  "action": "markPurchased",
  "itemId": "espresso-machine",
  "adminToken": "YOUR_SECRET_TOKEN"
}
```

`POST release`:

```json
{
  "action": "release",
  "itemId": "espresso-machine",
  "adminToken": "YOUR_SECRET_TOKEN"
}
```

## Σημαντικό

Η σύνδεση με εξωτερικά καταστήματα δεν μπορεί να επιβεβαιώσει αυτόματα ότι ολοκληρώθηκε checkout εκτός αν το ίδιο το κατάστημα δίνει API ή webhook. Η υλοποίηση εδώ κλειδώνει το δώρο τη στιγμή της δέσμευσης, που είναι ο πρακτικός τρόπος να αποφύγετε διπλές αγορές.
