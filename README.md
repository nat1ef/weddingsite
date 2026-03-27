# Wedding Microsite

Στατικό wedding microsite στα ελληνικά με RSVP, χάρτη, FAQ και συνδεδεμένη λίστα δώρων.

## Τι περιλαμβάνει

- Hero section με ημερομηνία, ονόματα και countdown
- Πρόσκληση και πρόγραμμα ημέρας
- Τοποθεσία με Google Maps
- RSVP φόρμα με validation
- Λίστα δώρων με stores, reservation flow και status
- FAQ και thank-you section
- Κεντρικό `config.js` για τα editable στοιχεία

## Δομή project

```text
wedding-microsite/
├── index.html
├── styles.css
├── app.js
├── config.js
├── gift-registry-data.js
├── README.md
├── assets/
│   └── icons/
│       └── monogram.svg
└── gift-registry-backend/
    ├── Code.gs
    └── README.md
```

## Πού αλλάζω τα βασικά στοιχεία

Στο [config.js](/c:/Users/manos/Downloads/wedding-microsite-project/wedding-microsite/config.js) θα βρείτε:

- `couple`
- `event`
- `hero`
- `invitation`
- `schedule`
- `location`
- `rsvp`
- `gift`
- `faq`
- `thankYou`
- `contact`

## RSVP

Η RSVP φόρμα δουλεύει ήδη με validation.

Αν το `rsvp.endpoint` είναι κενό:

- γίνεται local preview με `localStorage`

Αν βάλετε endpoint:

- στέλνει κανονικά σε backend / Formspree / Apps Script

Παράδειγμα:

```js
rsvp: {
  endpoint: 'https://formspree.io/f/your-form-id',
  method: 'POST',
}
```

## Λίστα δώρων

Η νέα λίστα δώρων υποστηρίζει:

- προϊόντα με τίτλο, store, τιμή και περιγραφή
- δέσμευση δώρου από το site
- κλείδωμα αντικειμένου ώστε να μην το πάρει δεύτερος επισκέπτης
- live sync όταν συνδεθεί backend endpoint
- προαιρετικό remote catalog από Google Sheet
- προαιρετικό refresh τιμών από τα product pages

Τα βασικά πεδία της ενότητας είναι στο [config.js](/c:/Users/manos/Downloads/wedding-microsite-project/wedding-microsite/config.js) μέσα στο `gift.registry`, ενώ τα ίδια τα προϊόντα είναι πλέον στο [gift-registry-data.js](/c:/Users/manos/Downloads/wedding-microsite-project/wedding-microsite/gift-registry-data.js).

Παράδειγμα:

```js
gift: {
  text: '...',
  iban: '[IBAN]',
  beneficiary: '[ΔΙΚΑΙΟΥΧΟΣ]',
  registry: {
    enabled: true,
    title: 'Λίστα δώρων από καταστήματα',
    description: 'Πατήστε πρώτα δέσμευση και μετά ανοίξτε το κατάστημα.',
    endpoint: '',
    catalogMode: 'local',
    fallbackMode: 'local',
    successMessage: 'Το δώρο δεσμεύτηκε επιτυχώς.',
    items: window.WEDDING_GIFT_REGISTRY_ITEMS || [],
  },
}
```

Και στο `gift-registry-data.js`:

```js
window.WEDDING_GIFT_REGISTRY_ITEMS = [
  {
    id: 'espresso-machine',
    title: 'Μηχανή espresso',
    store: 'Kotsovolos',
    price: '€249',
    category: 'Κουζίνα',
    url: 'https://www.kotsovolos.gr/...',
    description: 'Το ακριβές προϊόν που θέλετε',
  },
];
```

### Τι αλλάζετε εσείς

1. Βάζετε τα δικά σας προϊόντα στο `gift-registry-data.js`
2. Βάζετε τα ακριβή links των καταστημάτων στο `url`
3. Βάζετε το backend URL στο `gift.registry.endpoint`
4. Αν θέλετε διαχείριση από Google Sheet, αλλάζετε το `gift.registry.catalogMode` σε `'remote'`

### Demo mode

Αν αφήσετε κενό το `gift.registry.endpoint`, η λίστα δουλεύει μόνο για τοπικό preview μέσω `localStorage`.

Για πραγματικό shared locking μεταξύ επισκεπτών χρειάζεται backend.

## Backend για τη λίστα δώρων

Υπάρχει έτοιμο Apps Script backend στον φάκελο [gift-registry-backend/Code.gs](/c:/Users/manos/Downloads/wedding-microsite-project/wedding-microsite/gift-registry-backend/Code.gs).

Οδηγίες setup υπάρχουν στο [gift-registry-backend/README.md](/c:/Users/manos/Downloads/wedding-microsite-project/wedding-microsite/gift-registry-backend/README.md).

Η λογική είναι:

- τα δώρα μπορούν να έρχονται είτε από local αρχείο είτε από Google Sheet
- ο επισκέπτης δεσμεύει το δώρο
- το backend το μαρκάρει ως `reserved`
- οι υπόλοιποι το βλέπουν ως μη διαθέσιμο

Υποστηρίζονται επίσης admin actions για:

- `markPurchased`
- `release`

## Σημαντικός περιορισμός

Τα εξωτερικά καταστήματα συνήθως δεν δίνουν εύκολο public API για πλήρη συγχρονισμό checkout ή τιμών.

Για αυτό η ασφαλής πρακτική εδώ είναι:

- Google Sheet σαν source of truth για τη λίστα
- πρώτα δέσμευση στο microsite
- μετά άνοιγμα του store link
- auto refresh τιμής μόνο όπου το product page εκθέτει καθαρά την τιμή

Αυτό αποτρέπει πρακτικά τις διπλές αγορές, χωρίς να απαιτεί δική σας custom υποδομή e-commerce.

## Τοπικό άνοιγμα

Μπορείτε να ανοίξετε απλά το `index.html` ή να τρέξετε έναν μικρό local server:

```bash
python -m http.server 8080
```

Μετά ανοίγετε:

```text
http://localhost:8080
```

## Deploy

Το project είναι static-ready και ανεβαίνει εύκολα σε:

- Netlify
- Vercel
- GitHub Pages
- cPanel / shared hosting

Για live gift reservations, ανεβάζετε το site όπου θέλετε και κρατάτε το Apps Script endpoint στο `config.js`.
