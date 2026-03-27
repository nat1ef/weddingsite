# Gift Registry Backend

Αυτός ο φάκελος περιέχει αναβαθμισμένο backend για Google Apps Script + Google Sheets ώστε:

- οι δεσμεύσεις δώρων να συγχρονίζονται για όλους τους επισκέπτες
- ο κατάλογος δώρων να διαχειρίζεται από Google Sheet
- οι τιμές να μπορούν να ανανεώνονται από τα product pages όταν είναι διαθέσιμες σε HTML / JSON-LD / meta tags

## Τι λύνει

- Προσθήκη / αφαίρεση δώρων χωρίς αλλαγή κώδικα στο site
- Κοινή λίστα για όλους τους επισκέπτες
- Προαιρετικό auto refresh τιμών
- Fallback σε χειροκίνητη τιμή όταν ένα κατάστημα δεν εκθέτει καθαρά την τιμή

## Προτεινόμενο setup

1. Δημιουργήστε ένα νέο Google Sheet.
2. Από το Google Sheet ανοίξτε `Extensions` -> `Apps Script`.
3. Αντιγράψτε το περιεχόμενο του [Code.gs](/c:/Users/manos/Downloads/wedding-microsite-project/wedding-microsite/gift-registry-backend/Code.gs) στο script editor.
4. Αλλάξτε το `ADMIN_TOKEN` σε δική σας μυστική τιμή.
5. Τρέξτε μία φορά τη function `ensureCatalogSheet`.
6. Τρέξτε μία φορά τη function `ensureReservationsSheet`.
7. Θα δημιουργηθούν δύο tabs:
   `GiftCatalog`
   `GiftReservations`
8. Συμπληρώστε τις γραμμές του `GiftCatalog`.
9. Πατήστε `Deploy` -> `New deployment` -> `Web app`.
10. Βάλτε access: `Anyone`.
11. Αντιγράψτε το deployment URL.
12. Περάστε το URL στο [config.js](/c:/Users/manos/Downloads/wedding-microsite-project/wedding-microsite/config.js) στο `gift.registry.endpoint`.
13. Αλλάξτε το `gift.registry.catalogMode` σε `'remote'`.

## GiftCatalog columns

Το tab `GiftCatalog` έχει τις παρακάτω στήλες:

```text
id | title | store | price | category | url | description | enabled | autoPrice | lastCheckedAt | priceSource
```

### Τι βάζετε εσείς

- `id`: μοναδικό id π.χ. `espresso-machine`
- `title`: τίτλος δώρου
- `store`: κατάστημα
- `price`: χειροκίνητη τιμή ή τελευταία γνωστή τιμή
- `category`: κατηγορία
- `url`: ακριβές product URL
- `description`: μικρή περιγραφή
- `enabled`: `true` ή `false`
- `autoPrice`: `true` αν θέλετε να δοκιμάζεται αυτόματη ανανέωση τιμής

### Σημαντικό για auto price

- Βάλτε exact product page και όχι γενική κατηγορία
- Αν το κατάστημα δεν εκθέτει την τιμή στο HTML / structured data, θα μείνει η υπάρχουσα τιμή
- Σε κάποια shops το auto refresh μπορεί να σπάσει αν αλλάξει το markup τους

## Frontend config

Στο [config.js](/c:/Users/manos/Downloads/wedding-microsite-project/wedding-microsite/config.js):

```js
gift: {
  registry: {
    enabled: true,
    endpoint: 'https://script.google.com/macros/s/PASTE_YOUR_DEPLOYMENT_ID/exec',
    catalogMode: 'remote',
    fallbackMode: 'local',
    successMessage: 'Το δώρο δεσμεύτηκε επιτυχώς.',
    items: window.WEDDING_GIFT_REGISTRY_ITEMS || [],
  },
}
```

Με `catalogMode: 'remote'` το site διαβάζει τα δώρα από το Sheet backend.

Με `catalogMode: 'local'` συνεχίζει να χρησιμοποιεί το [gift-registry-data.js](/c:/Users/manos/Downloads/wedding-microsite-project/wedding-microsite/gift-registry-data.js).

## API shape

`GET`

```json
{
  "ok": true,
  "items": [
    {
      "id": "espresso-machine",
      "status": "reserved"
    }
  ],
  "catalog": [
    {
      "id": "espresso-machine",
      "title": "Μηχανή espresso",
      "store": "Kotsovolos",
      "price": "€177,90",
      "category": "Κουζίνα",
      "url": "https://example.com/product",
      "description": "Το ακριβές προϊόν που θέλετε",
      "lastCheckedAt": "2026-03-27 14:20",
      "priceSource": "json-ld"
    }
  ]
}
```

`POST reserve`

```json
{
  "action": "reserve",
  "itemId": "espresso-machine",
  "guestName": "Μαρία Παπαδοπούλου",
  "guestContact": "6900000000",
  "note": "Θα το στείλουμε μετά τον γάμο"
}
```

`POST markPurchased`

```json
{
  "action": "markPurchased",
  "itemId": "espresso-machine",
  "adminToken": "YOUR_SECRET_TOKEN"
}
```

`POST release`

```json
{
  "action": "release",
  "itemId": "espresso-machine",
  "adminToken": "YOUR_SECRET_TOKEN"
}
```

`POST refreshPrices`

```json
{
  "action": "refreshPrices",
  "adminToken": "YOUR_SECRET_TOKEN"
}
```

## Automatic refresh

Αν θέλετε ημερήσιο auto refresh:

1. Στο Apps Script ανοίξτε `Triggers`
2. Προσθέστε trigger για τη function `refreshCatalogPrices`
3. Επιλέξτε time-driven π.χ. μία φορά την ημέρα

## Πρακτική σύσταση

Η πιο σταθερή πρακτική είναι:

- Google Sheet ως source of truth για τα δώρα
- `autoPrice: true` μόνο σε exact product pages
- χειροκίνητη τιμή ως fallback

Έτσι μπορείτε να προσθέτετε ή να αφαιρείτε δώρα μόνοι σας, χωρίς να εξαρτάστε πλήρως από fragile scraping.
