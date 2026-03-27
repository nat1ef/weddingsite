const SHEET_NAME = 'GiftReservations';
const ADMIN_TOKEN = 'change-this-admin-token';
const HEADERS = ['itemId', 'status', 'guestName', 'guestContact', 'note', 'reservedAt', 'updatedAt'];

function doGet() {
  return jsonResponse_({
    ok: true,
    items: listReservations_(),
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

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = ensureSheet_();
    const rowIndex = findRowIndexByItemId_(sheet, payload.itemId);
    const now = new Date().toISOString();

    if (rowIndex > 0) {
      const existing = rowToItem_(sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0]);
      if (existing.status === 'reserved' || existing.status === 'purchased') {
        return jsonResponse_({
          ok: false,
          code: 'CONFLICT',
          error: 'This gift is already reserved.',
          item: existing,
        });
      }

      sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([
        [payload.itemId, 'reserved', payload.guestName, payload.guestContact, payload.note || '', now, now],
      ]);

      return jsonResponse_({
        ok: true,
        item: rowToItem_([payload.itemId, 'reserved', payload.guestName, payload.guestContact, payload.note || '', now, now]),
      });
    }

    sheet.appendRow([payload.itemId, 'reserved', payload.guestName, payload.guestContact, payload.note || '', now, now]);

    return jsonResponse_({
      ok: true,
      item: rowToItem_([payload.itemId, 'reserved', payload.guestName, payload.guestContact, payload.note || '', now, now]),
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
    const sheet = ensureSheet_();
    const rowIndex = findRowIndexByItemId_(sheet, payload.itemId);

    if (rowIndex < 0) {
      return jsonResponse_({
        ok: false,
        code: 'NOT_FOUND',
        error: 'Gift not found.',
      });
    }

    const currentRow = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
    const current = rowToItem_(currentRow);
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

    sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([updated]);

    return jsonResponse_({
      ok: true,
      item: rowToItem_(updated),
    });
  } finally {
    lock.releaseLock();
  }
}

function listReservations_() {
  const sheet = ensureSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return rows.map(rowToItem_);
}

function ensureSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
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

function rowToItem_(row) {
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
