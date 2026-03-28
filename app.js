(function () {
  const config = window.WEDDING_CONFIG;

  if (!config) {
    // eslint-disable-next-line no-console
    console.error('Missing WEDDING_CONFIG in config.js');
    return;
  }

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const GIFT_REGISTRY_STORAGE_KEY = 'wedding_gift_registry_reservations';
  const INTRO_LETTER_SCOPE = '.folder-intro ';

  const state = {
    giftReservations: new Map(),
    giftRegistryItems: null,
    activeMapPlaceId: '',
    introDismissed: false,
    introStarted: false,
  };

  function isPlaceholderValue(value) {
    return typeof value === 'string' && /^\[[^\]]+\]$/.test(value.trim());
  }

  function capitalizeText(value) {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function transliterateGreekMonogram(value) {
    const map = {
      Α: 'A',
      Β: 'B',
      Γ: 'G',
      Δ: 'D',
      Ε: 'E',
      Ζ: 'Z',
      Η: 'I',
      Θ: 'Th',
      Ι: 'I',
      Κ: 'K',
      Λ: 'L',
      Μ: 'M',
      Ν: 'N',
      Ξ: 'X',
      Ο: 'O',
      Π: 'P',
      Ρ: 'R',
      Σ: 'S',
      Τ: 'T',
      Υ: 'Y',
      Φ: 'F',
      Χ: 'Ch',
      Ψ: 'Ps',
      Ω: 'O',
    };

    return Array.from(String(value || ''))
      .map((char) => map[char] || char)
      .join('');
  }

  function getDisplayMonogram() {
    const rawMonogram = String(config.couple.monogram || '').replace(/\s+/g, '').trim();
    if (!rawMonogram) return 'M';
    return transliterateGreekMonogram(rawMonogram);
  }

  function getIsoDateParts(isoDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate || '');
    if (!match) return null;

    return {
      year: Number(match[1]),
      monthIndex: Number(match[2]) - 1,
      day: Number(match[3]),
    };
  }

  function formatDateFromIso(isoDate) {
    const parts = getIsoDateParts(isoDate);
    if (!parts) return '';

    return new Intl.DateTimeFormat('el-GR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(parts.year, parts.monthIndex, parts.day)));
  }

  function formatDayFromIso(isoDate) {
    const parts = getIsoDateParts(isoDate);
    if (!parts) return '';

    const weekday = new Intl.DateTimeFormat('el-GR', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(parts.year, parts.monthIndex, parts.day)));

    return capitalizeText(weekday);
  }

  function formatTimeFromIso(isoDate) {
    const match = /T(\d{2}:\d{2})/.exec(isoDate || '');
    return match ? match[1] : '';
  }

  function parseTimeParts(value) {
    const match = /^(\d{2}):(\d{2})/.exec(String(value || '').trim());
    if (!match) return null;

    return {
      hour: Number(match[1]),
      minute: Number(match[2]),
    };
  }

  function getTimeZoneOffsetMinutes(date, timeZone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    });
    const zonePart = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName');
    const match = zonePart && /GMT([+-]\d{1,2})(?::?(\d{2}))?/.exec(zonePart.value);
    if (!match) return 0;

    const hours = Number(match[1]);
    const minutes = Number(match[2] || '0');
    return hours * 60 + Math.sign(hours || 1) * minutes;
  }

  function buildDateInTimeZone(dateParts, timeParts, timeZone) {
    const utcGuess = Date.UTC(dateParts.year, dateParts.monthIndex, dateParts.day, timeParts.hour, timeParts.minute, 0);
    const initialOffset = getTimeZoneOffsetMinutes(new Date(utcGuess), timeZone);
    const corrected = new Date(utcGuess - initialOffset * 60 * 1000);
    const correctedOffset = getTimeZoneOffsetMinutes(corrected, timeZone);

    if (correctedOffset !== initialOffset) {
      return new Date(utcGuess - correctedOffset * 60 * 1000);
    }

    return corrected;
  }

  function getEventStartDate() {
    const dateParts = getIsoDateParts(config.event.isoDate);
    const timeParts = parseTimeParts(config.event.time || formatTimeFromIso(config.event.isoDate) || '00:00');
    const eventTimeZone = config.event.timeZone || 'Europe/Athens';

    if (dateParts && timeParts) {
      return buildDateInTimeZone(dateParts, timeParts, eventTimeZone);
    }

    return new Date(config.event.isoDate);
  }

  function padNumber(value) {
    return String(value).padStart(2, '0');
  }

  function formatUtcDateForIcs(date) {
    return [
      date.getUTCFullYear(),
      padNumber(date.getUTCMonth() + 1),
      padNumber(date.getUTCDate()),
      'T',
      padNumber(date.getUTCHours()),
      padNumber(date.getUTCMinutes()),
      padNumber(date.getUTCSeconds()),
      'Z',
    ].join('');
  }

  function escapeIcsText(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  function getCalendarEventData() {
    const startDate = getEventStartDate();
    const endDate = config.event.endIsoDate ? new Date(config.event.endIsoDate) : new Date(startDate.getTime() + 6 * 60 * 60 * 1000);

    return {
      title: `${config.couple.nameOne} & ${config.couple.nameTwo} - Γάμος`,
      description: resolveTextTokens(config.hero.tagline || config.invitation.text || ''),
      location: resolveTextTokens(config.event.venue ? `${config.event.venue}, ${config.event.address}` : config.event.address),
      startDate,
      endDate,
      uid: `wedding-${startDate.getTime()}@wedding-microsite`,
    };
  }

  function buildCalendarIcs() {
    const eventData = getCalendarEventData();
    const createdAt = formatUtcDateForIcs(new Date());

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Wedding Microsite//Calendar Event//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${eventData.uid}`,
      `DTSTAMP:${createdAt}`,
      `DTSTART:${formatUtcDateForIcs(eventData.startDate)}`,
      `DTEND:${formatUtcDateForIcs(eventData.endDate)}`,
      `SUMMARY:${escapeIcsText(eventData.title)}`,
      `DESCRIPTION:${escapeIcsText(eventData.description)}`,
      `LOCATION:${escapeIcsText(eventData.location)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  function buildCalendarFilename() {
    const eventDetails = getResolvedEventDetails();
    const coupleSlug = [config.couple.nameOne, config.couple.nameTwo]
      .join('-')
      .toLowerCase()
      .replace(/\s+/g, '-');

    return `${coupleSlug || 'wedding'}-${eventDetails.dateLabel || 'event'}.ics`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9.-]+/gi, '-')
      .replace(/-+/g, '-');
  }

  function resolveTextTokens(text) {
    if (typeof text !== 'string') return text;

    const replacements = {
      '[ΤΗΛΕΦΩΝΟ]': config.contact && config.contact.phone ? config.contact.phone : '[ΤΗΛΕΦΩΝΟ]',
      '[EMAIL]': config.contact && config.contact.email ? config.contact.email : '[EMAIL]',
      '[IBAN]': config.gift && config.gift.iban ? config.gift.iban : '[IBAN]',
      '[ΔΙΚΑΙΟΥΧΟΣ]': config.gift && config.gift.beneficiary ? config.gift.beneficiary : '[ΔΙΚΑΙΟΥΧΟΣ]',
      '[RSVP_DEADLINE]': config.rsvp && config.rsvp.deadline ? config.rsvp.deadline : '[RSVP_DEADLINE]',
      '[ΕΚΚΛΗΣΙΑ_Η_ΧΩΡΟΣ]': config.event && config.event.venue ? config.event.venue : '[ΕΚΚΛΗΣΙΑ_Η_ΧΩΡΟΣ]',
      '[ΔΙΕΥΘΥΝΣΗ]': config.event && config.event.address ? config.event.address : '[ΔΙΕΥΘΥΝΣΗ]',
    };

    return Object.entries(replacements).reduce((result, [token, value]) => result.split(token).join(value), text);
  }

  function getResolvedEventDetails() {
    const derivedDateLabel = formatDateFromIso(config.event.isoDate);
    const derivedDayLabel = formatDayFromIso(config.event.isoDate);
    const derivedTime = formatTimeFromIso(config.event.isoDate);

    return {
      dateLabel:
        config.event.dateLabel && !isPlaceholderValue(config.event.dateLabel) ? config.event.dateLabel : derivedDateLabel || config.event.dateLabel,
      dayLabel:
        config.event.dayLabel && !isPlaceholderValue(config.event.dayLabel) ? config.event.dayLabel : derivedDayLabel || config.event.dayLabel,
      time: config.event.time && !isPlaceholderValue(config.event.time) ? config.event.time : derivedTime || config.event.time,
    };
  }

  function getLocationPlaces() {
    const configuredPlaces =
      config.location && Array.isArray(config.location.places)
        ? config.location.places.filter((place) => place && (place.name || place.embedUrl || place.mapsLink))
        : [];

    if (configuredPlaces.length > 0) {
      return configuredPlaces;
    }

    return [
      {
        id: 'main-location',
        label: 'Τοποθεσία',
        name: resolveTextTokens(config.event.venue),
        address: resolveTextTokens(config.event.address),
        mapsLink: config.event.mapsLink,
        embedUrl: config.event.mapsEmbedUrl,
      },
    ];
  }

  function getPlaceById(placeId) {
    return getLocationPlaces().find((place) => place.id === placeId) || null;
  }

  function getPlaceQuery(place) {
    return encodeURIComponent(place.address || place.name || 'Τοποθεσία εκδήλωσης');
  }

  function buildGoogleMapsUrl(place) {
    if (place.latitude && place.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.latitude},${place.longitude}`)}`;
    }

    return place.mapsLink || `https://www.google.com/maps/search/?api=1&query=${getPlaceQuery(place)}`;
  }

  function buildAppleMapsUrl(place) {
    if (place.latitude && place.longitude) {
      const label = encodeURIComponent(place.name || place.label || 'Location');
      return `https://maps.apple.com/?ll=${place.latitude},${place.longitude}&q=${label}`;
    }

    return `https://maps.apple.com/?q=${getPlaceQuery(place)}`;
  }

  function getPlaceCopyText(place) {
    if (place.address && !isPlaceholderValue(place.address)) {
      return place.address;
    }

    if (place.latitude && place.longitude) {
      return `${place.latitude}, ${place.longitude}`;
    }

    return place.name || '';
  }

  const els = {
    inviteIntro: $('#inviteIntro'),
    openInviteButton: $('#openInviteButton'),
    skipIntroButton: $('#skipIntroButton'),
    introCopy: $('.intro-copy'),
    introCopyEyebrow: $('.intro-copy .eyebrow'),
    introCopyTitle: $('.intro-copy h1'),
    introCopyText: $('.intro-copy p:last-child'),
    folderInvitation: $(`${INTRO_LETTER_SCOPE}.folder-invitation`),
    introMonogram: $(`${INTRO_LETTER_SCOPE}#introMonogram`),
    introNameOne: $(`${INTRO_LETTER_SCOPE}.folder-names span:first-child`),
    introNameTwo: $(`${INTRO_LETTER_SCOPE}.folder-names span:last-child`),
    introDate: $(`${INTRO_LETTER_SCOPE}.folder-date`),
    introHint: $(`${INTRO_LETTER_SCOPE}.folder-hint`),
    introFrontDate: $('#introFrontDate'),
    pageShell: $('.page-shell'),
    brandMonogram: $('#brandMonogram'),
    nameOne: $('#nameOne'),
    nameTwo: $('#nameTwo'),
    heroDate: $('#heroDate'),
    heroDayLabel: $('#heroDayLabel'),
    heroTime: $('#heroTime'),
    heroVenue: $('#heroVenue'),
    heroEyebrow: $('#heroEyebrow'),
    heroTagline: $('#heroTagline'),
    miniInviteText: $('#miniInviteText'),
    addToCalendarButton: $('#addToCalendarButton'),
    invitationText: $('#invitationText'),
    venueName: $('#venueName'),
    ceremonyDateTime: $('#ceremonyDateTime'),
    venueAddress: $('#venueAddress'),
    locationDescription: $('#locationDescription'),
    locationMaps: $('#locationMaps'),
    timeline: $('#timeline'),
    rsvpDeadlineText: $('#rsvpDeadlineText'),
    rsvpNotes: $('#rsvpNotes'),
    rsvpForm: $('#rsvpForm'),
    formStatus: $('#formStatus'),
    giftText: $('#giftText'),
    beneficiary: $('#beneficiary'),
    ibanValue: $('#ibanValue'),
    registryCard: $('#registryCard'),
    giftRegistry: $('#giftRegistry'),
    giftIdeas: $('#giftIdeas'),
    copyIbanButton: $('#copyIbanButton'),
    copyBeneficiaryButton: $('#copyBeneficiaryButton'),
    giftListModal: $('#giftListModal'),
    giftListClose: $('#giftListClose'),
    giftReserveModal: $('#giftReserveModal'),
    giftReserveClose: $('#giftReserveClose'),
    giftReserveCancel: $('#giftReserveCancel'),
    giftReserveForm: $('#giftReserveForm'),
    giftReserveItemId: $('#giftReserveItemId'),
    giftReserveName: $('#giftReserveName'),
    giftReserveContact: $('#giftReserveContact'),
    giftReserveNote: $('#giftReserveNote'),
    giftReserveDescription: $('#giftReserveDescription'),
    giftReserveStatus: $('#giftReserveStatus'),
    giftReserveSubmit: $('#giftReserveSubmit'),
    giftStoreLink: $('#giftStoreLink'),
    mapChoiceModal: $('#mapChoiceModal'),
    mapChoiceClose: $('#mapChoiceClose'),
    mapChoiceDescription: $('#mapChoiceDescription'),
    openGoogleMapsButton: $('#openGoogleMapsButton'),
    openAppleMapsButton: $('#openAppleMapsButton'),
    faqList: $('#faqList'),
    footerNameOne: $('#footerNameOne'),
    footerNameTwo: $('#footerNameTwo'),
    footerDate: $('#footerDate'),
    footerQuote: $('#footerQuote'),
    thankYouTitle: $('#thankYouTitle'),
    thankYouText: $('#thankYouText'),
    countdownBlock: $('#countdownBlock'),
    navToggle: $('#navToggle'),
    siteNav: $('#siteNav'),
    toast: $('#toast'),
    days: $('#days'),
    hours: $('#hours'),
    minutes: $('#minutes'),
  };

  function setMeta() {
    document.title = config.seo.title;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute('content', config.seo.description);
  }

  function applyTheme() {
    const root = document.documentElement;
    const themeEntries = {
      '--bg': config.theme.background,
      '--surface': config.theme.surface,
      '--surface-strong': config.theme.surfaceStrong,
      '--text': config.theme.text,
      '--muted': config.theme.muted,
      '--line': config.theme.line,
      '--primary': config.theme.primary,
      '--primary-strong': config.theme.primaryStrong,
      '--secondary': config.theme.secondary,
      '--accent': config.theme.accent,
      '--gold': config.theme.gold,
    };

    Object.entries(themeEntries).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }

  function injectText() {
    const eventDetails = getResolvedEventDetails();
    const fullDateTime = `${eventDetails.dateLabel} - ${eventDetails.time}`;
    const displayMonogram = getDisplayMonogram();
    const setMonogramText = (element, value) => {
      if (!element) return;
      const glyph = element.querySelector('.monogram-glyph');
      if (glyph) {
        glyph.textContent = value;
      } else {
        element.textContent = value;
      }

      element.setAttribute('data-monogram-length', String(Array.from(String(value || '')).length));
      element.setAttribute('data-monogram', value);
    };

    setMonogramText(els.introMonogram, displayMonogram);
    document.documentElement.style.setProperty('--monogram-script', `"${displayMonogram}"`);
    if (els.introNameOne) els.introNameOne.textContent = config.couple.nameOne;
    if (els.introNameTwo) els.introNameTwo.textContent = config.couple.nameTwo;
    if (els.introDate) els.introDate.textContent = eventDetails.dateLabel;
    if (els.introHint) els.introHint.textContent = 'Πατήστε για να ανοίξει';
    if (els.introFrontDate) els.introFrontDate.textContent = eventDetails.dateLabel;
    if (els.skipIntroButton) els.skipIntroButton.textContent = 'Παράλειψη';
    if (els.openInviteButton) els.openInviteButton.setAttribute('aria-label', 'Άνοιγμα φακέλου πρόσκλησης');
    if (els.introCopyEyebrow) els.introCopyEyebrow.textContent = 'ΜΙΑ ΣΤΙΓΜΗ ΠΡΙΝ ΑΠΟ ΤΗΝ ΠΡΟΣΚΛΗΣΗ';
    if (els.introCopyTitle) els.introCopyTitle.textContent = 'Η αρχή της δικής μας ημέρας';
    if (els.introCopyText) {
      els.introCopyText.textContent =
        'Μέσα σε αυτόν τον φάκελο κρύβεται η πρώτη ματιά σε μια ημέρα που θέλουμε να μοιραστούμε μαζί σας. Ένα μικρό άνοιγμα οδηγεί σε όλα όσα ετοιμάσαμε με αγάπη.';
    }
    if (els.inviteIntro) els.inviteIntro.classList.add('is-content-ready');

    setMonogramText(els.brandMonogram, displayMonogram);
    els.nameOne.textContent = config.couple.nameOne;
    els.nameTwo.textContent = config.couple.nameTwo;
    els.heroDate.textContent = eventDetails.dateLabel;
    els.heroDayLabel.textContent = eventDetails.dayLabel;
    els.heroTime.textContent = eventDetails.time;
    els.heroVenue.textContent = resolveTextTokens(config.event.venue);
    els.heroEyebrow.textContent = resolveTextTokens(config.hero.eyebrow);
    els.heroTagline.textContent = resolveTextTokens(config.hero.tagline);
    els.miniInviteText.textContent = resolveTextTokens(config.hero.miniInviteText);
    els.invitationText.textContent = resolveTextTokens(config.invitation.text);
    els.venueName.textContent = resolveTextTokens(config.event.venue);
    els.ceremonyDateTime.textContent = fullDateTime;
    els.venueAddress.textContent = resolveTextTokens(config.event.address);
    els.locationDescription.textContent = resolveTextTokens(config.location.description);
    els.rsvpDeadlineText.textContent = `Παρακαλούμε ενημερώστε μας έως ${resolveTextTokens(config.rsvp.deadline)}.`;
    els.giftText.textContent = resolveTextTokens(config.gift.text);
    els.beneficiary.textContent = resolveTextTokens(config.gift.beneficiary);
    els.ibanValue.textContent = resolveTextTokens(config.gift.iban);
    els.footerNameOne.textContent = config.couple.nameOne;
    els.footerNameTwo.textContent = config.couple.nameTwo;
    els.footerDate.textContent = eventDetails.dateLabel;
    els.footerQuote.textContent = resolveTextTokens(config.couple.quote);
    els.thankYouTitle.textContent = resolveTextTokens(config.thankYou.title);
    els.thankYouText.textContent = resolveTextTokens(config.thankYou.text);
  }

  function buildTimeline() {
    els.timeline.innerHTML = '';
    config.schedule.forEach((item) => {
      const article = document.createElement('article');
      article.className = 'timeline-item';
      article.innerHTML = `
        <div class="timeline-time">${item.time}</div>
        <div class="timeline-content">
          <h3>${item.title}</h3>
          <p>${resolveTextTokens(item.description)}</p>
        </div>
      `;
      els.timeline.appendChild(article);
    });
  }

  function buildRsvpNotes() {
    els.rsvpNotes.innerHTML = '';
    config.rsvp.notes.forEach((note) => {
      const li = document.createElement('li');
      li.textContent = resolveTextTokens(note);
      els.rsvpNotes.appendChild(li);
    });
  }

  function updateBodyScrollLock() {
    const introOpen = Boolean(els.inviteIntro) && !state.introDismissed;
    const openModal = [els.giftListModal, els.giftReserveModal, els.mapChoiceModal].some(
      (modal) => modal && modal.classList.contains('is-open')
    );
    document.body.classList.toggle('is-scroll-locked', openModal || introOpen);
  }

  function setupIntroEnvelope() {
    if (!els.inviteIntro || !els.openInviteButton) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const finishIntro = () => {
      state.introDismissed = true;
      els.openInviteButton.disabled = false;
      els.inviteIntro.classList.remove('is-open', 'is-opening');
      els.inviteIntro.classList.add('is-hidden');
      els.inviteIntro.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('intro-opening');
      document.body.classList.remove('intro-active');
      document.documentElement.classList.add('intro-skipped');
      window.scrollTo({ top: 0, behavior: 'auto' });
      updateBodyScrollLock();
    };

    const skipIntro = () => {
      finishIntro();
    };

    const openIntro = () => {
      if (state.introDismissed || els.inviteIntro.classList.contains('is-opening')) return;

      document.body.classList.add('intro-opening');
      els.inviteIntro.classList.add('is-opening');
      els.openInviteButton.disabled = true;
      window.setTimeout(finishIntro, prefersReducedMotion ? 140 : 1200);
    };

    els.openInviteButton.addEventListener('click', openIntro);
    els.skipIntroButton && els.skipIntroButton.addEventListener('click', skipIntro);
    els.inviteIntro.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        skipIntro();
      }
    });
    updateBodyScrollLock();
  }

  function buildLocationSection() {
    const places = getLocationPlaces();

    els.locationMaps.innerHTML = places
      .map((place) => {
        const hasEmbed = Boolean(place.embedUrl);

        return `
          <div class="map-visual glass-card">
            <div class="map-caption">
              <p class="panel-label">${resolveTextTokens(place.label || 'Τοποθεσία')}</p>
              <h3>${resolveTextTokens(place.name || 'Τοποθεσία')}</h3>
              <p>${resolveTextTokens(place.address || '')}</p>
            </div>
            <div class="map-embed">
              ${
                hasEmbed
                  ? `<iframe
                      title="${resolveTextTokens(place.name || place.label || 'Χάρτης τοποθεσίας')}"
                      loading="lazy"
                      referrerpolicy="no-referrer-when-downgrade"
                      src="${place.embedUrl}"
                    ></iframe>`
                  : `<div class="map-fallback">
                      <div>
                        <p class="eyebrow">Τοποθεσία</p>
                        <h3>Η προεπισκόπηση χάρτη θα εμφανιστεί εδώ</h3>
                        <p>Μόλις προστεθεί το embed του χάρτη, θα εμφανιστεί σε αυτό το σημείο.</p>
                      </div>
                    </div>`
              }
            </div>
            <div class="map-actions">
              <button class="btn btn-primary" type="button" data-open-map="${place.id}">Άνοιγμα στον χάρτη</button>
              <button class="btn btn-secondary" type="button" data-copy-location="${place.id}">Αντιγραφή στοιχείων</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function openMapChoiceModal(placeId) {
    const place = getPlaceById(placeId);
    if (!place) return;

    state.activeMapPlaceId = placeId;
    els.mapChoiceDescription.textContent = `Επιλέξτε πώς θέλετε να ανοίξετε τη διαδρομή για ${resolveTextTokens(place.name || place.label || 'την τοποθεσία')}.`;
    els.openGoogleMapsButton.href = buildGoogleMapsUrl(place);
    els.openAppleMapsButton.href = buildAppleMapsUrl(place);
    els.mapChoiceModal.classList.add('is-open');
    els.mapChoiceModal.setAttribute('aria-hidden', 'false');
    updateBodyScrollLock();
  }

  function closeMapChoiceModal() {
    els.mapChoiceModal.classList.remove('is-open');
    els.mapChoiceModal.setAttribute('aria-hidden', 'true');
    state.activeMapPlaceId = '';
    updateBodyScrollLock();
  }

  function setupLocations() {
    buildLocationSection();

    els.locationMaps.addEventListener('click', (event) => {
      const openButton = event.target.closest('[data-open-map]');
      if (openButton) {
        openMapChoiceModal(openButton.getAttribute('data-open-map'));
        return;
      }

      const copyButton = event.target.closest('[data-copy-location]');
      if (!copyButton) return;

      const place = getPlaceById(copyButton.getAttribute('data-copy-location'));
      if (!place) return;

      copyText(getPlaceCopyText(place), 'Τα στοιχεία τοποθεσίας αντιγράφηκαν.');
    });

    els.mapChoiceClose.addEventListener('click', closeMapChoiceModal);
    els.mapChoiceModal.addEventListener('click', (event) => {
      if (event.target === els.mapChoiceModal) {
        closeMapChoiceModal();
      }
    });
    [els.openGoogleMapsButton, els.openAppleMapsButton].forEach((link) => {
      link.addEventListener('click', () => {
        window.setTimeout(closeMapChoiceModal, 120);
      });
    });
  }

  function getGiftRegistryConfig() {
    return config.gift && config.gift.registry ? config.gift.registry : {};
  }

  function shouldUseRemoteGiftCatalog() {
    const registry = getGiftRegistryConfig();
    return registry.catalogMode === 'remote' && Boolean(registry.endpoint);
  }

  function sanitizeGiftRegistryItem(item, index) {
    if (!item || typeof item !== 'object') return null;

    const fallbackId = `gift-item-${index + 1}`;
    const id = String(item.id || item.itemId || fallbackId).trim();
    if (!id) return null;

    return {
      id,
      title: typeof item.title === 'string' ? item.title : '',
      store: typeof item.store === 'string' ? item.store : '',
      price: typeof item.price === 'string' || typeof item.price === 'number' ? String(item.price) : '',
      category: typeof item.category === 'string' ? item.category : '',
      url: typeof item.url === 'string' ? item.url : '',
      description: typeof item.description === 'string' ? item.description : '',
      lastCheckedAt:
        typeof item.lastCheckedAt === 'string'
          ? item.lastCheckedAt
          : typeof item.priceLastCheckedAt === 'string'
            ? item.priceLastCheckedAt
            : '',
      priceSource: typeof item.priceSource === 'string' ? item.priceSource : '',
    };
  }

  function mergeGiftRegistryItemWithLocalFallback(item) {
    const registry = getGiftRegistryConfig();
    const localItems = Array.isArray(registry.items) ? registry.items : [];
    const localItem = localItems.find((entry) => entry && entry.id === item.id);

    if (!localItem) {
      return item;
    }

    return {
      ...item,
      title: item.title || localItem.title || '',
      store: item.store || localItem.store || '',
      price: item.price || localItem.price || '',
      category: item.category || localItem.category || '',
      url: item.url || localItem.url || '',
      description: item.description || localItem.description || '',
    };
  }

  function applyGiftRegistryCatalog(items) {
    if (!Array.isArray(items)) {
      state.giftRegistryItems = null;
      return;
    }

    state.giftRegistryItems = items.map(sanitizeGiftRegistryItem).filter(Boolean).map(mergeGiftRegistryItemWithLocalFallback);
  }

  function getGiftRegistryItems() {
    if (shouldUseRemoteGiftCatalog()) {
      return Array.isArray(state.giftRegistryItems) ? state.giftRegistryItems : [];
    }

    const registry = getGiftRegistryConfig();
    return Array.isArray(registry.items) ? registry.items : [];
  }

  function getGiftItemById(itemId) {
    return getGiftRegistryItems().find((item) => item.id === itemId) || null;
  }

  function getGiftReservationStatus(itemId) {
    return state.giftReservations.get(itemId) || { id: itemId, status: 'available' };
  }

  function getGiftStatusMeta(status) {
    if (status === 'reserved') {
      return {
        label: 'Δεσμευμένο',
        className: 'is-reserved',
        actionLabel: 'Μη διαθέσιμο',
        description: 'Το δώρο έχει ήδη δεσμευτεί και δεν μπορεί να επιλεγεί ξανά.',
      };
    }

    if (status === 'purchased') {
      return {
        label: 'Αγορασμένο',
        className: 'is-purchased',
        actionLabel: 'Ολοκληρώθηκε',
        description: 'Το δώρο έχει ήδη αγοραστεί και δεν είναι πλέον διαθέσιμο.',
      };
    }

    return {
      label: 'Διαθέσιμο',
      className: 'is-available',
      actionLabel: 'Δέσμευση δώρου',
      description: 'Κάντε πρώτα δέσμευση και μετά ανοίξτε το κατάστημα για να αποφύγουμε διπλή αγορά.',
    };
  }

  function readLocalGiftReservations() {
    try {
      const parsed = JSON.parse(localStorage.getItem(GIFT_REGISTRY_STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeLocalGiftReservations(items) {
    localStorage.setItem(GIFT_REGISTRY_STORAGE_KEY, JSON.stringify(items));
  }

  function applyGiftReservationItems(items) {
    state.giftReservations = new Map();

    items.forEach((item) => {
      const itemId = item.id || item.itemId;
      if (!itemId) return;

      state.giftReservations.set(itemId, {
        id: itemId,
        status: item.status || 'available',
        guestName: item.guestName || '',
        guestContact: item.guestContact || '',
        reservedAt: item.reservedAt || '',
        updatedAt: item.updatedAt || '',
      });
    });
  }

  async function fetchJson(url, options = {}) {
    const headers = {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    };

    const response = await fetch(url, { ...options, headers });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.ok === false) {
      const error = new Error(payload.error || `Request failed with status ${response.status}`);
      error.code = payload.code;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async function loadGiftReservations() {
    const registry = getGiftRegistryConfig();

    if (!registry.enabled) {
      applyGiftReservationItems([]);
      if (shouldUseRemoteGiftCatalog()) {
        applyGiftRegistryCatalog([]);
      }
      return;
    }

    if (registry.endpoint) {
      const payload = await fetchJson(registry.endpoint);
      applyGiftReservationItems(Array.isArray(payload.items) ? payload.items : []);
      if (shouldUseRemoteGiftCatalog()) {
        applyGiftRegistryCatalog(Array.isArray(payload.catalog) ? payload.catalog : []);
      }
      return;
    }

    if (registry.fallbackMode === 'local') {
      applyGiftReservationItems(readLocalGiftReservations());
      return;
    }

    applyGiftReservationItems([]);
  }

  async function reserveGiftItem(payload) {
    const registry = getGiftRegistryConfig();

    if (registry.endpoint) {
      const response = await fetchJson(registry.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'reserve',
          ...payload,
        }),
      });

      return response.item;
    }

    if (registry.fallbackMode === 'local') {
      const items = readLocalGiftReservations();
      const existingIndex = items.findIndex((item) => item.id === payload.itemId);
      const existing = existingIndex >= 0 ? items[existingIndex] : null;

      if (existing && existing.status && existing.status !== 'available') {
        const error = new Error('Το δώρο έχει ήδη δεσμευτεί.');
        error.code = 'ALREADY_RESERVED';
        throw error;
      }

      const nextItem = {
        id: payload.itemId,
        status: 'reserved',
        guestName: payload.guestName,
        guestContact: payload.guestContact,
        note: payload.note || '',
        reservedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        items[existingIndex] = nextItem;
      } else {
        items.push(nextItem);
      }

      writeLocalGiftReservations(items);
      return nextItem;
    }

    throw new Error('Δεν έχει συνδεθεί backend για τη λίστα δώρων.');
  }

  function renderGiftRegistrySummary() {
    const registry = getGiftRegistryConfig();
    const items = getGiftRegistryItems();

    if (!registry.enabled || items.length === 0) {
      els.registryCard.style.display = 'none';
      return;
    }

    const unavailableCount = items.filter((item) => getGiftReservationStatus(item.id).status !== 'available').length;
    const modeLabel = registry.endpoint ? 'Συγχρονισμένη λίστα' : 'Λίστα διαθέσιμη';

    els.registryCard.style.display = '';
    els.registryCard.innerHTML = `
      <p class="panel-label">Λίστα καταστημάτων</p>
      <h3>${registry.title}</h3>
      <p>${registry.description}</p>
      <div class="registry-meta">
        <div>
          <span>Προϊόντα</span>
          <strong>${items.length}</strong>
        </div>
        <div>
          <span>Μη διαθέσιμα</span>
          <strong>${unavailableCount}</strong>
        </div>
        <div>
          <span>Κατάσταση</span>
          <strong>${modeLabel}</strong>
        </div>
      </div>
      <button class="btn btn-secondary" type="button" data-open-gift-list>Λίστα δώρων</button>
    `;
  }

  function renderGiftRegistry() {
    const registry = getGiftRegistryConfig();
    const items = getGiftRegistryItems();

    if (!registry.enabled || items.length === 0) {
      els.giftRegistry.style.display = 'none';
      return;
    }

    els.giftRegistry.style.display = '';
    els.giftRegistry.innerHTML = items
      .map((item) => {
        const reservation = getGiftReservationStatus(item.id);
        const statusMeta = getGiftStatusMeta(reservation.status);
        const reserveDisabled = reservation.status !== 'available' ? 'disabled' : '';
        const priceMeta = item.lastCheckedAt
          ? `<p class="gift-registry-meta">Τελευταία ενημέρωση τιμής: ${item.lastCheckedAt}</p>`
          : '';

        return `
          <article class="gift-registry-item ${statusMeta.className}">
            <div class="gift-registry-head">
              <div>
                <p class="gift-registry-category">${item.category || 'Δώρο γάμου'}</p>
                <h3>${item.title}</h3>
              </div>
              <span class="gift-status-badge ${statusMeta.className}">${statusMeta.label}</span>
            </div>

            <div class="gift-registry-store">
              <span>${item.store}</span>
              <strong>${item.price || ''}</strong>
            </div>

            <p class="gift-registry-description">${resolveTextTokens(item.description || '')}</p>
            ${priceMeta}

            <div class="gift-registry-actions">
              <button class="btn btn-primary" type="button" data-gift-reserve="${item.id}" ${reserveDisabled}>${statusMeta.actionLabel}</button>
            </div>

            <p class="gift-registry-note">${statusMeta.description}</p>
          </article>
        `;
      })
      .join('');
  }

  function buildGiftSection() {
    renderGiftRegistrySummary();
    renderGiftRegistry();

    if (config.gift.ideas && config.gift.ideas.enabled) {
      const items = config.gift.ideas.items.map((item) => `<li>${resolveTextTokens(item)}</li>`).join('');
      els.giftIdeas.innerHTML = `
        <h3>${resolveTextTokens(config.gift.ideas.title)}</h3>
        <ul>${items}</ul>
      `;
    } else {
      els.giftIdeas.style.display = 'none';
    }
  }

  function clearGiftReservationErrors() {
    $$('[data-gift-error-for]').forEach((el) => {
      el.textContent = '';
    });
  }

  function renderGiftReservationErrors(errors) {
    $$('[data-gift-error-for]').forEach((el) => {
      const key = el.getAttribute('data-gift-error-for');
      el.textContent = errors[key] || '';
    });
  }

  function setGiftReservationStatus(message, kind) {
    els.giftReserveStatus.textContent = message;
    els.giftReserveStatus.className = `form-status ${kind || ''}`.trim();
  }

  function validateGiftReservationForm(payload) {
    const errors = {};

    if (!payload.guestName.trim()) {
      errors.name = 'Παρακαλούμε συμπληρώστε το όνομά σας.';
    }

    if (!payload.guestContact.trim()) {
      errors.contact = 'Συμπληρώστε τηλέφωνο ή email για να υπάρχει στοιχείο επικοινωνίας.';
    }

    return errors;
  }

  function openGiftReserveModal(itemId) {
    const item = getGiftItemById(itemId);
    if (!item) return;

    closeGiftListModal();
    els.giftReserveForm.reset();
    els.giftReserveItemId.value = itemId;
    els.giftReserveDescription.textContent = `Θα δεσμεύσετε το "${item.title}" από ${item.store}. Μετά τη δέσμευση μπορείτε να ανοίξετε το κατάστημα από το κουμπί που θα εμφανιστεί.`;
    clearGiftReservationErrors();
    setGiftReservationStatus('', '');
    els.giftStoreLink.hidden = true;
    els.giftStoreLink.href = item.url;
    els.giftReserveModal.classList.add('is-open');
    els.giftReserveModal.setAttribute('aria-hidden', 'false');
    updateBodyScrollLock();
  }

  function closeGiftReserveModal() {
    els.giftReserveModal.classList.remove('is-open');
    els.giftReserveModal.setAttribute('aria-hidden', 'true');
    updateBodyScrollLock();
  }

  function openGiftListModal() {
    els.giftListModal.classList.add('is-open');
    els.giftListModal.setAttribute('aria-hidden', 'false');
    updateBodyScrollLock();
  }

  function closeGiftListModal() {
    els.giftListModal.classList.remove('is-open');
    els.giftListModal.setAttribute('aria-hidden', 'true');
    updateBodyScrollLock();
  }

  async function handleGiftReserveSubmit(event) {
    event.preventDefault();

    const itemId = els.giftReserveItemId.value;
    const item = getGiftItemById(itemId);
    if (!item) return;

    const payload = {
      itemId,
      guestName: els.giftReserveName.value,
      guestContact: els.giftReserveContact.value,
      note: els.giftReserveNote.value,
    };

    const errors = validateGiftReservationForm(payload);
    clearGiftReservationErrors();
    renderGiftReservationErrors(errors);
    setGiftReservationStatus('', '');
    els.giftStoreLink.hidden = true;

    if (Object.keys(errors).length > 0) {
      setGiftReservationStatus('Παρακαλούμε διορθώστε τα πεδία της φόρμας.', 'error');
      return;
    }

    els.giftReserveSubmit.disabled = true;
    els.giftReserveSubmit.textContent = 'Δέσμευση...';

    try {
      const reservation = await reserveGiftItem(payload);
      state.giftReservations.set(itemId, {
        id: itemId,
        status: reservation.status || 'reserved',
        guestName: reservation.guestName || payload.guestName,
        guestContact: reservation.guestContact || payload.guestContact,
        reservedAt: reservation.reservedAt || new Date().toISOString(),
        updatedAt: reservation.updatedAt || new Date().toISOString(),
      });

      renderGiftRegistrySummary();
      renderGiftRegistry();
      setGiftReservationStatus(getGiftRegistryConfig().successMessage || 'Το δώρο δεσμεύτηκε επιτυχώς.', 'success');
      els.giftStoreLink.hidden = false;
      els.giftStoreLink.href = item.url;
      showToast('Το δώρο δεσμεύτηκε.');
    } catch (error) {
      if (error.code === 'ALREADY_RESERVED' || error.code === 'CONFLICT') {
        await loadGiftReservations().catch(() => {});
        renderGiftRegistrySummary();
        renderGiftRegistry();
        setGiftReservationStatus('Το δώρο δεσμεύτηκε μόλις από άλλον επισκέπτη και δεν είναι πια διαθέσιμο.', 'error');
      } else {
        setGiftReservationStatus('Δεν ολοκληρώθηκε η δέσμευση. Δοκιμάστε ξανά σε λίγο.', 'error');
      }
    } finally {
      els.giftReserveSubmit.disabled = false;
      els.giftReserveSubmit.textContent = 'Δέσμευση δώρου';
    }
  }

  function setupGiftRegistry() {
    buildGiftSection();

    els.registryCard.addEventListener('click', (event) => {
      const button = event.target.closest('[data-open-gift-list]');
      if (!button) return;
      openGiftListModal();
    });

    els.giftRegistry.addEventListener('click', (event) => {
      const button = event.target.closest('[data-gift-reserve]');
      if (!button) return;

      const itemId = button.getAttribute('data-gift-reserve');
      const reservation = getGiftReservationStatus(itemId);

      if (reservation.status !== 'available') {
        showToast('Το δώρο δεν είναι πλέον διαθέσιμο.');
        return;
      }

      openGiftReserveModal(itemId);
    });

    els.giftListClose.addEventListener('click', closeGiftListModal);
    els.giftListModal.addEventListener('click', (event) => {
      if (event.target === els.giftListModal) {
        closeGiftListModal();
      }
    });
    els.giftReserveClose.addEventListener('click', closeGiftReserveModal);
    els.giftReserveCancel.addEventListener('click', closeGiftReserveModal);
    els.giftReserveModal.addEventListener('click', (event) => {
      if (event.target === els.giftReserveModal) {
        closeGiftReserveModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && els.giftListModal.classList.contains('is-open')) {
        closeGiftListModal();
      }
      if (event.key === 'Escape' && els.giftReserveModal.classList.contains('is-open')) {
        closeGiftReserveModal();
      }
      if (event.key === 'Escape' && els.mapChoiceModal.classList.contains('is-open')) {
        closeMapChoiceModal();
      }
    });

    els.giftReserveForm.addEventListener('submit', handleGiftReserveSubmit);

    loadGiftReservations()
      .then(() => {
        renderGiftRegistrySummary();
        renderGiftRegistry();
      })
      .catch(() => {
        renderGiftRegistrySummary();
        renderGiftRegistry();
        showToast('Η λίστα δώρων είναι διαθέσιμη.');
      });
  }

  function buildFaq() {
    els.faqList.innerHTML = '';

    config.faq.forEach((item, index) => {
      const article = document.createElement('article');
      article.className = 'faq-item';
      article.innerHTML = `
        <button class="faq-question" type="button" aria-expanded="false" aria-controls="faq-${index}">
          <span>${resolveTextTokens(item.question)}</span>
          <span class="faq-icon">+</span>
        </button>
        <div class="faq-answer" id="faq-${index}">
          <div>
            <p>${resolveTextTokens(item.answer)}</p>
          </div>
        </div>
      `;
      els.faqList.appendChild(article);
    });

    $$('.faq-question').forEach((button) => {
      button.addEventListener('click', () => {
        const item = button.closest('.faq-item');
        const isOpen = item.classList.toggle('is-open');
        button.setAttribute('aria-expanded', String(isOpen));
        const icon = button.querySelector('.faq-icon');
        if (icon) icon.textContent = isOpen ? '-' : '+';
      });
    });
  }

  function setupNavigation() {
    els.navToggle.addEventListener('click', () => {
      const isOpen = els.siteNav.classList.toggle('is-open');
      els.navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    $$('#siteNav a').forEach((link) => {
      link.addEventListener('click', () => {
        els.siteNav.classList.remove('is-open');
        els.navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      els.toast.classList.remove('is-visible');
    }, 2200);
  }

  async function copyText(text, successMessage) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const helper = document.createElement('textarea');
        helper.value = text;
        helper.setAttribute('readonly', '');
        helper.style.position = 'absolute';
        helper.style.left = '-9999px';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        helper.remove();
      }
      showToast(successMessage);
    } catch (error) {
      showToast('Δεν ήταν δυνατή η αντιγραφή.');
    }
  }

  function setupCopyButtons() {
    els.copyIbanButton.addEventListener('click', () => copyText(config.gift.iban, 'Το IBAN αντιγράφηκε.'));
    els.copyBeneficiaryButton.addEventListener('click', () => copyText(`${config.gift.beneficiary}\n${config.gift.iban}`, 'Τα στοιχεία αντιγράφηκαν.'));
  }

  function setupCalendarButton() {
    if (!els.addToCalendarButton) return;

    els.addToCalendarButton.addEventListener('click', () => {
      try {
        const calendarContent = buildCalendarIcs();
        const blob = new Blob([calendarContent], { type: 'text/calendar;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = buildCalendarFilename();
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        showToast('Το αρχείο ημερολογίου είναι έτοιμο.');
      } catch (error) {
        showToast('Δεν ήταν δυνατή η δημιουργία του αρχείου ημερολογίου.');
      }
    });
  }

  function setupRevealAnimations() {
    const items = $$('.reveal');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersStaticReveal = window.matchMedia('(hover: none), (pointer: coarse), (max-width: 719px)').matches;

    if (prefersReducedMotion || prefersStaticReveal || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );

    items.forEach((item) => observer.observe(item));
  }

  function validateForm(formData) {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Παρακαλούμε συμπληρώστε το όνομά σας.';
    }

    const guests = Number(formData.guests);
    if (!Number.isInteger(guests) || guests < 1 || guests > 12) {
      errors.guests = 'Επιλέξτε αριθμό ατόμων από 1 έως 12.';
    }

    if (!formData.attendance) {
      errors.attendance = 'Παρακαλούμε επιλέξτε αν θα παρευρεθείτε.';
    }

    if (!formData.privacy) {
      errors.privacy = 'Χρειάζεται η συγκατάθεσή σας για την αποστολή της φόρμας.';
    }

    return errors;
  }

  function renderErrors(errors) {
    $$('[data-error-for]').forEach((el) => {
      const key = el.getAttribute('data-error-for');
      el.textContent = errors[key] || '';
    });
  }

  function setFormStatus(message, kind) {
    els.formStatus.textContent = message;
    els.formStatus.className = `form-status ${kind || ''}`.trim();
  }

  async function submitToEndpoint(payload) {
    const response = await fetch(config.rsvp.endpoint, {
      method: config.rsvp.method || 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`RSVP request failed with status ${response.status}`);
    }

    return response;
  }

  function saveLocalRsvp(payload) {
    const storageKey = 'wedding_rsvp_submissions';
    const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
    existing.push({ ...payload, createdAt: new Date().toISOString() });
    localStorage.setItem(storageKey, JSON.stringify(existing));
  }

  function setupRsvpForm() {
    els.rsvpForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setFormStatus('', '');

      const payload = {
        name: $('#guestName').value,
        guests: $('#guestCount').value,
        attendance: $('#attendance').value,
        message: $('#guestMessage').value,
        privacy: $('#privacyConsent').checked,
        eventDate: config.event.dateLabel,
        eventVenue: config.event.venue,
      };

      const errors = validateForm(payload);
      renderErrors(errors);

      if (Object.keys(errors).length > 0) {
        setFormStatus('Παρακαλούμε διορθώστε τα επισημασμένα πεδία.', 'error');
        return;
      }

      const submitButton = els.rsvpForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = 'Αποστολή...';

      try {
        if (config.rsvp.endpoint) {
          await submitToEndpoint(payload);
        } else if (config.rsvp.fallbackMode === 'local') {
          saveLocalRsvp(payload);
        }

        setFormStatus(config.rsvp.successMessage, 'success');
        els.rsvpForm.reset();
        $('#guestCount').value = '1';
      } catch (error) {
        setFormStatus('Παρουσιάστηκε πρόβλημα κατά την αποστολή. Δοκιμάστε ξανά ή επικοινωνήστε μαζί μας.', 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Αποστολή επιβεβαίωσης';
      }
    });
  }

  function startCountdown() {
    const target = getEventStartDate();
    if (Number.isNaN(target.getTime())) {
      els.countdownBlock.style.display = 'none';
      return;
    }

    const update = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        els.days.textContent = '00';
        els.hours.textContent = '00';
        els.minutes.textContent = '00';
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);

      els.days.textContent = String(days).padStart(2, '0');
      els.hours.textContent = String(hours).padStart(2, '0');
      els.minutes.textContent = String(minutes).padStart(2, '0');
    };

    update();
    window.setInterval(update, 60000);
  }

  function init() {
    setMeta();
    applyTheme();
    injectText();
    setupIntroEnvelope();
    buildTimeline();
    buildRsvpNotes();
    setupLocations();
    setupGiftRegistry();
    buildFaq();
    setupNavigation();
    setupCopyButtons();
    setupCalendarButton();
    setupRevealAnimations();
    setupRsvpForm();
    startCountdown();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
