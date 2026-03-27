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

  const state = {
    giftReservations: new Map(),
  };

  const els = {
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
    invitationText: $('#invitationText'),
    venueName: $('#venueName'),
    ceremonyDateTime: $('#ceremonyDateTime'),
    venueAddress: $('#venueAddress'),
    locationDescription: $('#locationDescription'),
    mapVenue: $('#mapVenue'),
    mapAddress: $('#mapAddress'),
    mapsButton: $('#mapsButton'),
    copyAddressButton: $('#copyAddressButton'),
    mapEmbed: $('#mapEmbed'),
    mapFallback: $('#mapFallback'),
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
    const fullDateTime = `${config.event.dateLabel} - ${config.event.time}`;

    els.brandMonogram.textContent = config.couple.monogram;
    els.nameOne.textContent = config.couple.nameOne;
    els.nameTwo.textContent = config.couple.nameTwo;
    els.heroDate.textContent = config.event.dateLabel;
    els.heroDayLabel.textContent = config.event.dayLabel;
    els.heroTime.textContent = config.event.time;
    els.heroVenue.textContent = config.event.venue;
    els.heroEyebrow.textContent = config.hero.eyebrow;
    els.heroTagline.textContent = config.hero.tagline;
    els.miniInviteText.textContent = config.hero.miniInviteText;
    els.invitationText.textContent = config.invitation.text;
    els.venueName.textContent = config.event.venue;
    els.ceremonyDateTime.textContent = fullDateTime;
    els.venueAddress.textContent = config.event.address;
    els.locationDescription.textContent = config.location.description;
    els.mapVenue.textContent = config.event.venue;
    els.mapAddress.textContent = config.event.address;
    els.mapsButton.href = config.event.mapsLink;
    els.rsvpDeadlineText.textContent = `Παρακαλούμε ενημερώστε μας έως ${config.rsvp.deadline}.`;
    els.giftText.textContent = config.gift.text;
    els.beneficiary.textContent = config.gift.beneficiary;
    els.ibanValue.textContent = config.gift.iban;
    els.footerNameOne.textContent = config.couple.nameOne;
    els.footerNameTwo.textContent = config.couple.nameTwo;
    els.footerDate.textContent = config.event.dateLabel;
    els.footerQuote.textContent = config.couple.quote;
    els.thankYouTitle.textContent = config.thankYou.title;
    els.thankYouText.textContent = config.thankYou.text;
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
          <p>${item.description}</p>
        </div>
      `;
      els.timeline.appendChild(article);
    });
  }

  function buildRsvpNotes() {
    els.rsvpNotes.innerHTML = '';
    config.rsvp.notes.forEach((note) => {
      const li = document.createElement('li');
      li.textContent = note;
      els.rsvpNotes.appendChild(li);
    });
  }

  function getGiftRegistryConfig() {
    return config.gift && config.gift.registry ? config.gift.registry : {};
  }

  function getGiftRegistryItems() {
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
      return;
    }

    if (registry.endpoint) {
      const payload = await fetchJson(registry.endpoint);
      applyGiftReservationItems(Array.isArray(payload.items) ? payload.items : []);
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
    const modeLabel = registry.endpoint ? 'Live σύνδεση ενεργή' : 'Demo / local preview';

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

        return `
          <article class="gift-registry-item ${statusMeta.className}">
            <div class="gift-registry-head">
              <div>
                <p class="gift-registry-category">${item.category || 'Wedding Gift'}</p>
                <h3>${item.title}</h3>
              </div>
              <span class="gift-status-badge ${statusMeta.className}">${statusMeta.label}</span>
            </div>

            <div class="gift-registry-store">
              <span>${item.store}</span>
              <strong>${item.price || ''}</strong>
            </div>

            <p class="gift-registry-description">${item.description || ''}</p>

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
      const items = config.gift.ideas.items.map((item) => `<li>${item}</li>`).join('');
      els.giftIdeas.innerHTML = `
        <h3>${config.gift.ideas.title}</h3>
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
    document.body.style.overflow = 'hidden';
  }

  function closeGiftReserveModal() {
    els.giftReserveModal.classList.remove('is-open');
    els.giftReserveModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function openGiftListModal() {
    els.giftListModal.classList.add('is-open');
    els.giftListModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeGiftListModal() {
    els.giftListModal.classList.remove('is-open');
    els.giftListModal.setAttribute('aria-hidden', 'true');
    if (!els.giftReserveModal.classList.contains('is-open')) {
      document.body.style.overflow = '';
    }
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
        showToast('Η λίστα δώρων φορτώθηκε χωρίς live συγχρονισμό.');
      });
  }

  function buildFaq() {
    els.faqList.innerHTML = '';

    config.faq.forEach((item, index) => {
      const article = document.createElement('article');
      article.className = 'faq-item';
      article.innerHTML = `
        <button class="faq-question" type="button" aria-expanded="false" aria-controls="faq-${index}">
          <span>${item.question}</span>
          <span class="faq-icon">+</span>
        </button>
        <div class="faq-answer" id="faq-${index}">
          <div>
            <p>${item.answer}</p>
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

  function setupMap() {
    if (config.event.mapsEmbedUrl) {
      els.mapEmbed.src = config.event.mapsEmbedUrl;
      els.mapFallback.hidden = true;
      els.mapEmbed.hidden = false;
      return;
    }

    els.mapEmbed.hidden = true;
    els.mapFallback.hidden = false;
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
    els.copyAddressButton.addEventListener('click', () => copyText(config.event.address, 'Η διεύθυνση αντιγράφηκε.'));
  }

  function setupRevealAnimations() {
    const items = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
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
    const target = new Date(config.event.isoDate);
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
    buildTimeline();
    buildRsvpNotes();
    setupGiftRegistry();
    buildFaq();
    setupMap();
    setupNavigation();
    setupCopyButtons();
    setupRevealAnimations();
    setupRsvpForm();
    startCountdown();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
