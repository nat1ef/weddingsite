const RSVP_SHEET_NAME = 'RSVP';
const RSVP_HEADERS = ['timestamp', 'name', 'guests', 'attendance', 'message', 'privacy', 'eventDate', 'eventVenue'];

function doGet() {
  return jsonResponse_({
    ok: true,
    message: 'RSVP endpoint is live.',
  });
}

function doPost(e) {
  const payload = parseBody_(e);

  const validationError = validatePayload_(payload);
  if (validationError) {
    return jsonResponse_({
      ok: false,
      error: validationError,
    });
  }

  const sheet = ensureSheet_();
  sheet.appendRow([
    new Date().toISOString(),
    payload.name,
    payload.guests,
    payload.attendance,
    payload.message || '',
    payload.privacy ? 'true' : 'false',
    payload.eventDate || '',
    payload.eventVenue || '',
  ]);

  return jsonResponse_({
    ok: true,
  });
}

function ensureSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(RSVP_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(RSVP_SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, RSVP_HEADERS.length).setValues([RSVP_HEADERS]);
  }

  return sheet;
}

function validatePayload_(payload) {
  if (!payload.name) return 'Missing name.';
  if (!payload.guests) return 'Missing guests.';
  if (!payload.attendance) return 'Missing attendance.';
  if (!payload.privacy) return 'Missing privacy consent.';
  return '';
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
