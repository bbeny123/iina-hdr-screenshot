const els = {
  ffmpegPath: document.getElementById('ffmpegPathInput'),
  tonemap: document.getElementById('tonemapSelect'),
  zscale: document.getElementById('zscaleSelect'),

  keybind: document.getElementById('keybindInput'),
  keybindValidation: document.getElementById('keybindValidation')
}

const MODIFIERS = { meta: 'Meta', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift' };
const SPECIAL_KEYS = new Set([
  "ENTER", "TAB", "SPACE", "ESC", "BS", "LEFT", "RIGHT", "UP", "DOWN",
  "KP_DEL", "DEL", "KP_INS", "INS", "HOME", "END", "PGUP", "PGDWN", "PRINT",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"
]);

const timeouts = { keybind: null, ffmpegPath: null };
const states = { conflictingBind: null };

function sanitizeInput(e, sanitizeFn) {
  const input = e.target;
  const { value: inputValue, selectionStart: pos } = input;

  const clean = sanitizeFn(inputValue);

  if (inputValue !== clean) {
    const cleanPos = sanitizeFn(inputValue.slice(0, pos)).length;
    input.value = clean;
    input.setSelectionRange(cleanPos, cleanPos);
  }

  return clean;
}

function sanitizePath(path) {
  if (!path) return "";
  return path.replace(/\p{Cc}+/gu, '').replace(/\s/g, ' ')
      .replace(/[:\\]/g, '').replace(/\/+/g, '/');
}

// --- Keybind ---
function sanitizeKeybind(input) {
  input = input.replace(/^\++/, '').replace(/\+{2,}/g, '+').replace(/\s+/g, '');
  if (!input) return "";

  const parts = input.split('+');
  const danglingPart = parts.pop();

  const seen = new Set();
  const resultParts = [];
  parts.forEach(part => {
    const lowerPart = part.toLowerCase();

    if (part !== "" && !seen.has(lowerPart)) {
      seen.add(lowerPart);
      resultParts.push(part);
    }
  });

  return [...resultParts, danglingPart].join('+');
}

function normalizeKeybind(key) {
  if (!key) return '';

  const parts = key.split('+');
  let actualKey = parts.pop();
  const upperKey = actualKey.toUpperCase();
  actualKey = SPECIAL_KEYS.has(upperKey) ? upperKey : actualKey;

  if (!parts.length) return actualKey;

  const partsSet = new Set(parts.map(p => p.toLowerCase()));

  const normalizedModifiers = Object.keys(MODIFIERS)
    .filter(key => partsSet.has(key))
    .map(key => MODIFIERS[key]);

  return [...normalizedModifiers, actualKey].join('+');
}

function updateKeybindValidation(className, message) {
  els.keybindValidation.textContent = message;
  els.keybindValidation.className = `info-box ${className}`;
}

function invalidKeybindMessage(key) {
  if (!key) return "";
  if (key.endsWith('+')) return "Invalid format: Trailing +";

  const parts = key.split('+');
  const actualKey = parts.pop();

  if (MODIFIERS[actualKey.toLowerCase()]) return "Invalid format: Trailing modifier";

  const invalidMods = parts.filter(p => !MODIFIERS[p.toLowerCase()]);
  if (invalidMods.length > 0) return `Unknown modifier(s): ${invalidMods.join(', ')}`;

  if (actualKey.length > 1 && !SPECIAL_KEYS.has(actualKey.toUpperCase())) {
    return `Possibly invalid key: ${actualKey}`;
  }

  return "";
}

function validateKeybind(input) {
  const msg = invalidKeybindMessage(input);
  if (!input) {
    updateKeybindValidation('info', "ⓘ Keybind disabled");
  } else if (!msg) {
    updateKeybindValidation('valid', '✓ Keybind is valid');
  } else if (msg.startsWith("Possibly")) {
    updateKeybindValidation('warning', "⚠ " + msg);
  } else {
    updateKeybindValidation('error', "⚠ " + msg);
    return false;
  }

  return true;
}

function validateConflict(normalized) {
  if (!normalized || normalized !== states.conflictingBind) return false;

  updateKeybindValidation('error', "⚠ Keybind is already in use");
  return true;
}

els.keybind.addEventListener('input', e => {
  clearTimeout(timeouts.keybind);

  const input = sanitizeInput(e, sanitizeKeybind);
  if (!validateKeybind(input)) return;

  const normalized = normalizeKeybind(input);
  const conflicting = validateConflict(normalized);

  timeouts.keybind = setTimeout(() => {
    iina.preferences.set("keybind", normalized);
    iina.preferences.set("bindConflict", conflicting);
    timeouts.keybind = null;
  }, 200);
});

// --- FFmpeg ---
els.ffmpegPath.addEventListener('input', e => {
  const path = sanitizeInput(e, sanitizePath);

  timeouts.ffmpegPath = setTimeout(() => {
    iina.preferences.set("ffmpegPath", path?.trim());
    timeouts.ffmpegPath = null;
  }, 200);
});

els.tonemap.addEventListener('change', e => iina.preferences.set("tonemap", e.target.value));
els.zscale.addEventListener('change', e => iina.preferences.set("zscale", e.target.value === 'true'));

// --- Initialization ---
iina.preferences.get("ffmpegPath", path => {
  els.ffmpegPath.value = sanitizePath(path);
});

iina.preferences.get("tonemap", algo => {
  els.tonemap.value = algo || "reinhard";
});

iina.preferences.get("zscale", enabled => {
  els.zscale.value = enabled ? "true" : "false";
});

iina.preferences.get("keybind", keybind => {
  iina.preferences.get("bindConflict", hasConflict => {
    if (hasConflict) states.conflictingBind = keybind;
    const clean = sanitizeKeybind(keybind || "")
    els.keybind.value = clean;
    if (validateKeybind(clean)) {
      validateConflict(clean);
    }
  });
});