const RESERVATIONS_SHEET_NAME = 'GiftReservations';
const CATALOG_SHEET_NAME = 'GiftCatalog';
const ADMIN_TOKEN = 'change-this-admin-token';

const RESERVATION_HEADERS = ['itemId', 'status', 'guestName', 'guestContact', 'note', 'reservedAt', 'updatedAt'];
const CATALOG_HEADERS = [
  'id',
  'title',
  'store',
  'price',
  'category',
  'url',
  'description',
  'enabled',
  'autoPrice',
  'lastCheckedAt',
  'priceSource',
];

function doGet() {
  return jsonResponse_({
    ok: true,
    items: listReservations_(),
    catalog: listCatalog_(),
  });
}

function doPost(e) {
  const payload = parseBody_(e);

  if (payload.action === 'reserve') {
    return reserveGift_(payload);
  }

  if (payload.action === 'markPurchased') {
    return updateGiftStatus_(payload, 'purchased');
  }

  if (payload.action === 'release') {
    return updateGiftStatus_(payload, 'available');
  }

  if (payload.action === 'refreshPrices') {
    return refreshCatalogPricesAction_(payload);
  }

  return jsonResponse_({
    ok: false,
    code: 'INVALID_ACTION',
    error: 'Unknown action.',
  });
}

function reserveGift_(payload) {
  if (!payload.itemId || !payload.guestName || !payload.guestContact) {
    return jsonResponse_({
      ok: false,
      code: 'VALIDATION_ERROR',
      error: 'itemId, guestName and guestContact are required.',
    });
  }

  if (hasCatalogItems_() && !catalogItemExists_(payload.itemId)) {
    return jsonResponse_({
      ok: false,
      code: 'NOT_FOUND',
      error: 'Gift not found in catalog.',
    });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = ensureSheet_(RESERVATIONS_SHEET_NAME, RESERVATION_HEADERS);
    const rowIndex = findRowIndexByItemId_(sheet, payload.itemId);
    const now = new Date().toISOString();

    if (rowIndex > 0) {
      const existing = rowToReservationItem_(sheet.getRange(rowIndex, 1, 1, RESERVATION_HEADERS.length).getValues()[0]);
      if (existing.status === 'reserved' || existing.status === 'purchased') {
        return jsonResponse_({
          ok: false,
          code: 'CONFLICT',
          error: 'This gift is already reserved.',
          item: existing,
        });
      }

      sheet.getRange(rowIndex, 1, 1, RESERVATION_HEADERS.length).setValues([
        [payload.itemId, 'reserved', payload.guestName, payload.guestContact, payload.note || '', now, now],
      ]);

      return jsonResponse_({
        ok: true,
        item: rowToReservationItem_([payload.itemId, 'reserved', payload.guestName, payload.guestContact, payload.note || '', now, now]),
      });
    }

    sheet.appendRow([payload.itemId, 'reserved', payload.guestName, payload.guestContact, payload.note || '', now, now]);

    return jsonResponse_({
      ok: true,
      item: rowToReservationItem_([payload.itemId, 'reserved', payload.guestName, payload.guestContact, payload.note || '', now, now]),
    });
  } finally {
    lock.releaseLock();
  }
}

function updateGiftStatus_(payload, nextStatus) {
  if (payload.adminToken !== ADMIN_TOKEN) {
    return jsonResponse_({
      ok: false,
      code: 'UNAUTHORIZED',
      error: 'Invalid admin token.',
    });
  }

  if (!payload.itemId) {
    return jsonResponse_({
      ok: false,
      code: 'VALIDATION_ERROR',
      error: 'itemId is required.',
    });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = ensureSheet_(RESERVATIONS_SHEET_NAME, RESERVATION_HEADERS);
    const rowIndex = findRowIndexByItemId_(sheet, payload.itemId);

    if (rowIndex < 0) {
      return jsonResponse_({
        ok: false,
        code: 'NOT_FOUND',
        error: 'Gift not found.',
      });
    }

    const currentRow = sheet.getRange(rowIndex, 1, 1, RESERVATION_HEADERS.length).getValues()[0];
    const current = rowToReservationItem_(currentRow);
    const now = new Date().toISOString();
    const updated = [
      current.itemId,
      nextStatus,
      nextStatus === 'available' ? '' : current.guestName,
      nextStatus === 'available' ? '' : current.guestContact,
      nextStatus === 'available' ? '' : current.note,
      nextStatus === 'available' ? '' : current.reservedAt,
      now,
    ];

    sheet.getRange(rowIndex, 1, 1, RESERVATION_HEADERS.length).setValues([updated]);

    return jsonResponse_({
      ok: true,
      item: rowToReservationItem_(updated),
    });
  } finally {
    lock.releaseLock();
  }
}

function refreshCatalogPricesAction_(payload) {
  if (payload.adminToken !== ADMIN_TOKEN) {
    return jsonResponse_({
      ok: false,
      code: 'UNAUTHORIZED',
      error: 'Invalid admin token.',
    });
  }

  return jsonResponse_({
    ok: true,
    ...refreshCatalogPrices_(),
  });
}

function refreshCatalogPrices() {
  return refreshCatalogPrices_();
}

function ensureCatalogSheet() {
  ensureSheet_(CATALOG_SHEET_NAME, CATALOG_HEADERS);
}

function ensureReservationsSheet() {
  ensureSheet_(RESERVATIONS_SHEET_NAME, RESERVATION_HEADERS);
}

function refreshCatalogPrices_() {
  const sheet = ensureSheet_(CATALOG_SHEET_NAME, CATALOG_HEADERS);
  const lastRow = sheet.getLastRow();
  const checkedAt = formatCheckedAt_(new Date());

  if (lastRow <= 1) {
    return {
      updatedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      checkedAt: checkedAt,
    };
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, CATALOG_HEADERS.length).getValues();
  let updatedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  const priceColumn = CATALOG_HEADERS.indexOf('price') + 1;
  const lastCheckedColumn = CATALOG_HEADERS.indexOf('lastCheckedAt') + 1;
  const priceSourceColumn = CATALOG_HEADERS.indexOf('priceSource') + 1;

  rows.forEach((row, index) => {
    const item = rowToCatalogItem_(row);
    const rowNumber = index + 2;

    if (!item.enabled || !item.autoPrice || !item.url) {
      skippedCount += 1;
      return;
    }

    try {
      const priceInfo = fetchProductPrice_(item.url);
      sheet.getRange(rowNumber, priceColumn).setValue(priceInfo.price);
      sheet.getRange(rowNumber, lastCheckedColumn).setValue(checkedAt);
      sheet.getRange(rowNumber, priceSourceColumn).setValue(priceInfo.source);
      updatedCount += 1;
    } catch (error) {
      const failure = describeAutoPriceFailure_(item.url, error);
      sheet.getRange(rowNumber, lastCheckedColumn).setValue(checkedAt);
      sheet.getRange(rowNumber, priceSourceColumn).setValue(failure.source);

      if (failure.countAsSkip) {
        skippedCount += 1;
      } else {
        failedCount += 1;
      }
    }
  });

  return {
    updatedCount: updatedCount,
    failedCount: failedCount,
    skippedCount: skippedCount,
    checkedAt: checkedAt,
  };
}

function listReservations_() {
  const sheet = getSheet_(RESERVATIONS_SHEET_NAME);
  const lastRow = sheet ? sheet.getLastRow() : 0;

  if (!sheet || lastRow <= 1) {
    return [];
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, RESERVATION_HEADERS.length).getValues();
  return rows.map(rowToReservationItem_);
}

function listCatalog_() {
  const sheet = getSheet_(CATALOG_SHEET_NAME);
  const lastRow = sheet ? sheet.getLastRow() : 0;

  if (!sheet || lastRow <= 1) {
    return [];
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, CATALOG_HEADERS.length).getDisplayValues();
  return rows
    .map(rowToCatalogItem_)
    .filter(function (item) {
      return item.enabled;
    })
    .map(function (item) {
      return {
        id: item.id,
        title: item.title,
        store: item.store,
        price: item.price,
        category: item.category,
        url: item.url,
        description: item.description,
        lastCheckedAt: item.lastCheckedAt,
        priceSource: item.priceSource,
      };
    });
}

function hasCatalogItems_() {
  const sheet = getSheet_(CATALOG_SHEET_NAME);
  return Boolean(sheet && sheet.getLastRow() > 1);
}

function catalogItemExists_(itemId) {
  const sheet = getSheet_(CATALOG_SHEET_NAME);
  const lastRow = sheet ? sheet.getLastRow() : 0;

  if (!sheet || lastRow <= 1) {
    return false;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, CATALOG_HEADERS.length).getValues();
  for (let index = 0; index < values.length; index += 1) {
    const item = rowToCatalogItem_(values[index]);
    if (item.id === String(itemId) && item.enabled) {
      return true;
    }
  }

  return false;
}

function fetchProductPrice_(url) {
  const document = fetchProductDocument_(url);
  const priceInfo = extractPriceFromHtml_(url, document.content);

  if (!priceInfo) {
    throw new Error('Price not found on product page.');
  }

  return {
    price: formatPrice_(priceInfo.amount, priceInfo.currency),
    source: document.source === 'direct' ? priceInfo.source : `${priceInfo.source} via ${document.source}`,
  };
}

function fetchProductDocument_(url) {
  const directResponse = fetchUrlText_(url, {
    'User-Agent': 'Mozilla/5.0 (compatible; WeddingMicrositeGiftRegistry/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  });

  if (directResponse.ok) {
    return {
      content: directResponse.text,
      source: 'direct',
    };
  }

  if (shouldUseReaderFallback_(url, directResponse.status)) {
    const readerUrl = buildReaderProxyUrl_(url);
    const readerResponse = fetchUrlText_(readerUrl, {
      Accept: 'text/plain,text/markdown;q=0.9,*/*;q=0.8',
      'X-Return-Format': 'markdown',
    });

    if (readerResponse.ok) {
      return {
        content: readerResponse.text,
        source: 'reader',
      };
    }

    throw new Error(`HTTP ${directResponse.status} / reader HTTP ${readerResponse.status}`);
  }

  throw new Error(`HTTP ${directResponse.status}`);
}

function fetchUrlText_(url, headers) {
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: headers || {},
  });

  return {
    ok: response.getResponseCode() >= 200 && response.getResponseCode() < 300,
    status: response.getResponseCode(),
    text: response.getContentText(),
  };
}

function shouldUseReaderFallback_(url, statusCode) {
  if (statusCode === 403 || statusCode === 401) {
    return true;
  }

  const host = getHostname_(url);
  return host.indexOf('skroutz.gr') >= 0;
}

function buildReaderProxyUrl_(url) {
  const normalizedUrl = String(url || '').trim();
  return `https://r.jina.ai/http://${normalizedUrl.replace(/^https?:\/\//i, '')}`;
}

function describeAutoPriceFailure_(url, error) {
  const message = String((error && error.message) || 'unknown error');
  const host = getHostname_(url);
  const isHttp403 = /\bHTTP\s+403\b/i.test(message);

  if (isHttp403) {
    if (host.indexOf('skroutz.gr') >= 0) {
      return {
        source: 'manual (Skroutz blocked server fetch)',
        countAsSkip: true,
      };
    }

    return {
      source: `manual (blocked by provider: ${host || 'HTTP 403'})`,
      countAsSkip: true,
    };
  }

  return {
    source: `error: ${truncate_(message, 120)}`,
    countAsSkip: false,
  };
}

function extractPriceFromHtml_(url, html) {
  const standardPrice = extractJsonLdPrice_(html) || extractMetaPrice_(html);
  if (standardPrice) {
    return standardPrice;
  }

  const host = getHostname_(url);

  if (host.indexOf('kotsovolos.gr') >= 0) {
    return extractKotsovolosPrice_(html);
  }

  if (host.indexOf('public.gr') >= 0) {
    return extractPublicPrice_(html);
  }

  if (host.indexOf('skroutz.gr') >= 0) {
    return extractSkroutzPrice_(html);
  }

  return null;
}

function extractJsonLdPrice_(html) {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];

  for (let index = 0; index < blocks.length; index += 1) {
    const content = blocks[index]
      .replace(/^<script[^>]*>/i, '')
      .replace(/<\/script>$/i, '')
      .replace(/<!--|-->/g, '')
      .trim();

    const parsed = tryParseJson_(content);
    if (!parsed) {
      continue;
    }

    const found = findProductOfferPriceInNode_(parsed);
    if (found) {
      return {
        amount: found.amount,
        currency: found.currency || 'EUR',
        source: 'json-ld',
      };
    }
  }

  return null;
}

function findProductOfferPriceInNode_(node) {
  if (node === null || typeof node === 'undefined') {
    return null;
  }

  if (Array.isArray(node)) {
    for (let index = 0; index < node.length; index += 1) {
      const found = findProductOfferPriceInNode_(node[index]);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (typeof node !== 'object') {
    return null;
  }

  const types = normalizeSchemaTypes_(node['@type']);
  const isOffer = types.indexOf('offer') >= 0;
  const isProduct = types.indexOf('product') >= 0;

  if (isOffer && isExactPriceValue_(node.price)) {
    return {
      amount: node.price,
      currency: node.priceCurrency || node.currency || 'EUR',
    };
  }

  if (isProduct && node.offers) {
    const offerPrice = findProductOfferPriceInNode_(node.offers);
    if (offerPrice) {
      return offerPrice;
    }
  }

  const knownContainers = ['@graph', 'mainEntity', 'itemListElement'];
  for (let index = 0; index < knownContainers.length; index += 1) {
    const candidate = node[knownContainers[index]];
    if (!candidate) {
      continue;
    }

    const found = findProductOfferPriceInNode_(candidate);
    if (found) {
      return found;
    }
  }

  return null;
}

function extractMetaPrice_(html) {
  const amount =
    matchFirst_(html, /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i) ||
    matchFirst_(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']product:price:amount["']/i) ||
    matchFirst_(html, /<meta[^>]+itemprop=["']price["'][^>]+content=["']([^"']+)["']/i) ||
    matchFirst_(html, /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']price["']/i);

  if (!isExactPriceValue_(amount)) {
    return null;
  }

  const currency =
    matchFirst_(html, /<meta[^>]+property=["']product:price:currency["'][^>]+content=["']([^"']+)["']/i) ||
    matchFirst_(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']product:price:currency["']/i) ||
    matchFirst_(html, /<meta[^>]+itemprop=["']priceCurrency["'][^>]+content=["']([^"']+)["']/i) ||
    matchFirst_(html, /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']priceCurrency["']/i) ||
    'EUR';

  return {
    amount: amount,
    currency: currency,
    source: 'meta',
  };
}

function extractKotsovolosPrice_(html) {
  return (
    extractAnchoredEuroPrice_(html, /Συνολική\s+τιμή/i, 'kotsovolos-summary') ||
    extractAnchoredEuroPrice_(html, /Απόκτησέ\s*το/i, 'kotsovolos-cta')
  );
}

function extractPublicPrice_(html) {
  return (
    extractAnchoredEuroPrice_(html, /Τώρα\s+βλέπεις\s+αυτό/i, 'public-current-product') ||
    extractAnchoredEuroPrice_(html, /Αναλυτική\s+Περιγραφή/i, 'public-description')
  );
}

function extractSkroutzPrice_(html) {
  const text = htmlToText_(html);

  const primaryPrice =
    matchFirst_(text, /(\d+\s+\d{2})€\s+ή\s+σε/i) ||
    matchFirst_(text, /(\d+[.,]\d{2})\s*€\s+ή\s+σε/i) ||
    matchFirst_(text, /(\d+\s+\d{2})€\s+Παράδοση/i) ||
    matchFirst_(text, /(\d+[.,]\d{2})\s*€\s+Παράδοση/i);

  if (isExactPriceValue_(primaryPrice)) {
    return {
      amount: primaryPrice,
      currency: 'EUR',
      source: 'skroutz-primary',
    };
  }

  const titleScopedText = sliceAfterMatch_(text, /Κωδικός\s+Skroutz/i, 1500);
  const scopedPrice =
    matchFirst_(titleScopedText, /(\d+\s+\d{2})€/i) ||
    matchFirst_(titleScopedText, /(\d+[.,]\d{2})\s*€/i);

  if (isExactPriceValue_(scopedPrice)) {
    return {
      amount: scopedPrice,
      currency: 'EUR',
      source: 'skroutz-scoped',
    };
  }

  return null;
}

function extractAnchoredEuroPrice_(html, anchorRegex, source) {
  const anchorMatch = anchorRegex.exec(html || '');
  if (!anchorMatch) {
    return null;
  }

  const startIndex = anchorMatch.index;
  const windowText = String(html || '').slice(startIndex, startIndex + 2500);
  const prices = extractEuroAmounts_(windowText);

  if (prices.length === 0) {
    return null;
  }

  const candidate = chooseCurrentPriceCandidate_(prices);
  if (!candidate) {
    return null;
  }

  return {
    amount: candidate,
    currency: 'EUR',
    source: source,
  };
}

function extractEuroAmounts_(text) {
  const matches = [];
  const regex = /(?:€\s*([0-9]+(?:[.,][0-9]{2})?)|([0-9]+(?:[.,][0-9]{2})?)\s*€)/gi;
  let match;

  while ((match = regex.exec(text || ''))) {
    const amount = match[1] || match[2] || '';
    if (isExactPriceValue_(amount)) {
      matches.push(amount);
    }
  }

  return matches;
}

function chooseCurrentPriceCandidate_(prices) {
  if (!prices || prices.length === 0) {
    return '';
  }

  if (prices.length === 1) {
    return prices[0];
  }

  const normalized = prices
    .map(function (price) {
      return {
        raw: price,
        amount: normalizeAmount_(price),
      };
    })
    .filter(function (entry) {
      return entry.amount !== null && entry.amount > 0;
    });

  if (normalized.length === 0) {
    return '';
  }

  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index].amount <= normalized[index - 1].amount) {
      return normalized[index].raw;
    }
  }

  return normalized[0].raw;
}

function getHostname_(url) {
  const match = /^https?:\/\/([^\/?#]+)/i.exec(String(url || '').trim());
  return match ? match[1].toLowerCase() : '';
}

function normalizeSchemaTypes_(value) {
  if (Array.isArray(value)) {
    return value.map(function (entry) {
      return String(entry || '').trim().toLowerCase();
    });
  }

  if (typeof value === 'string') {
    return [value.trim().toLowerCase()];
  }

  return [];
}

function isExactPriceValue_(value) {
  if (typeof value === 'number') {
    return isFinite(value) && value > 0;
  }

  const text = String(value || '').trim();
  if (!text) {
    return false;
  }

  if (/από|from/i.test(text)) {
    return false;
  }

  if (/\d+\s*-\s*\d+/.test(text)) {
    return false;
  }

  return normalizeAmount_(text) !== null;
}
function formatPrice_(rawAmount, currency) {
  const amount = normalizeAmount_(rawAmount);
  if (amount === null) {
    throw new Error(`Invalid amount: ${rawAmount}`);
  }

  const formattedAmount = amount.toLocaleString('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (!currency || String(currency).toUpperCase() === 'EUR') {
    return `€${formattedAmount}`;
  }

  return `${formattedAmount} ${String(currency).toUpperCase()}`;
}

function normalizeAmount_(value) {
  if (typeof value === 'number') {
    return isFinite(value) ? value : null;
  }

  const raw = String(value || '')
    .replace(/&nbsp;/gi, '')
    .replace(/€/g, '')
    .replace(/EUR/gi, '');

  if (!raw) {
    return null;
  }

  let normalized = raw.trim();

  if (/^\d+\s+\d{2}$/.test(normalized)) {
    normalized = normalized.replace(/\s+/, '.');
  } else {
    normalized = normalized.replace(/\s+/g, '');
  }

  if (normalized.indexOf(',') >= 0 && normalized.indexOf('.') >= 0) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else {
    normalized = normalized.replace(',', '.');
  }

  const amount = Number(normalized);
  return isFinite(amount) ? amount : null;
}

function rowToReservationItem_(row) {
  return {
    itemId: row[0] || '',
    id: row[0] || '',
    status: row[1] || 'available',
    guestName: row[2] || '',
    guestContact: row[3] || '',
    note: row[4] || '',
    reservedAt: row[5] || '',
    updatedAt: row[6] || '',
  };
}

function rowToCatalogItem_(row) {
  return {
    id: String(row[0] || '').trim(),
    title: row[1] || '',
    store: row[2] || '',
    price: row[3] || '',
    category: row[4] || '',
    url: row[5] || '',
    description: row[6] || '',
    enabled: toBoolean_(row[7], true),
    autoPrice: toBoolean_(row[8], false),
    lastCheckedAt: row[9] || '',
    priceSource: row[10] || '',
  };
}

function getSheet_(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function ensureSheet_(name, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function findRowIndexByItemId_(sheet, itemId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0]) === String(itemId)) {
      return index + 2;
    }
  }

  return -1;
}

function toBoolean_(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized) {
    return typeof fallback === 'boolean' ? fallback : false;
  }

  return ['true', '1', 'yes', 'y', 'ναι', 'nai'].indexOf(normalized) >= 0;
}

function matchFirst_(text, regex) {
  const match = regex.exec(text || '');
  return match ? match[1] : '';
}

function htmlToText_(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sliceAfterMatch_(text, regex, length) {
  const source = String(text || '');
  const match = regex.exec(source);
  if (!match) {
    return source.slice(0, length);
  }

  return source.slice(match.index, match.index + length);
}

function tryParseJson_(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function formatCheckedAt_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Europe/Athens', 'yyyy-MM-dd HH:mm');
}

function truncate_(value, maxLength) {
  const text = String(value || '');
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function parseBody_(e) {
  try {
    return JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (error) {
    return {};
  }
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
