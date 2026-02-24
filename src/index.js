const { core, mpv, utils, file, menu, input, preferences, event, console } = iina;

const VALID_MAPPERS = new Set(['none', 'clip', 'reinhard', 'hable', 'mobius']);

const FILTERS = {
  zscale: { name: 'zscale', in: '', linear: 't=linear', out: 'p=bt709:t=bt709:m=bt709' },
  scale: { name: 'scale', in: 'in_chroma_loc=topleft:', linear: 'out_transfer=linear', out: 'out_primaries=bt709:out_transfer=bt709:out_color_matrix=bt709' }
}

const peakCache = new Map();
const config = { ffmpegPath: "ffmpeg", tonemap: "reinhard", zscale: false };
let isProcessing = false;

const pad = (n, w = 2) => n.toString().padStart(w, '0');

function timestamp(timePos) {
  const sec = Number(timePos) || 0;
  const totalMs = Math.max(0, Math.round(sec * 1000));

  const hh = Math.floor(totalMs / 3600000);
  const mm = Math.floor((totalMs % 3600000) / 60000);
  const ss = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${pad(hh)}-${pad(mm)}-${pad(ss)}-${pad(ms, 3)}`;
}

function toOutputDir(videoPath) {
  let outDir = mpv.getString("screenshot-dir")?.trim();
  if (!outDir) {
    const lastSlash = videoPath.lastIndexOf('/');
    outDir = lastSlash > 0 ? videoPath.slice(0, lastSlash) : null;
  }

  return !outDir || outDir.endsWith('/')
    ? outDir
    : outDir + '/';
}

function toOutputPath(outDir, timePos) {
  const filename = mpv.getString("filename/no-ext")?.trim();
  if (!filename) return null;

  const basePath = `${outDir}${filename}-${timestamp(timePos)}`;
  let outputPath = `${basePath}-HDR.png`;
  let counter = 1;

  while (file.exists(outputPath)) {
    if (counter > 999) return null;
    outputPath = `${basePath}-${counter++}-HDR.png`;
  }

  return outputPath;
}

function extractValue(stderr, key, keyLength) {
  const idx = stderr.indexOf(key);
  return idx >= 0
    ? parseInt(stderr.slice(idx + keyLength), 10)
    : null;
}

async function peak(videoPath) {
  if (!videoPath) return "";
  if (peakCache.has(videoPath))
    return peakCache.get(videoPath);

  let maxCLL = 0;
  let maxLuminance = 0;

  const { status } = await utils.exec(config.ffmpegPath, [
    "-hide_banner", "-nostats",
    "-loglevel", "info",
    "-i", videoPath,
    "-vframes", '5',
    "-vf", "showinfo",
    "-f", "null", "-"
  ], undefined, undefined, stderr => {
    const cllVal = extractValue(stderr, "MaxCLL=", 7);
    if (cllVal) {
      maxCLL = cllVal;
      return;
    }

    const lumVal = extractValue(stderr, "max_luminance=", 14);
    if (lumVal) maxLuminance = lumVal;
  });

  const nits = maxCLL >= 1000 ? maxCLL : maxLuminance;
  const result = nits >= 1000
    ? `:peak=${+(nits / 1000).toFixed(3)}`
    : '';

  peakCache.set(videoPath, result);
  return result;
}

function isHDR() {
  const gamma = mpv.getString("video-params/gamma");
  return gamma === "pq" || gamma === "hlg"
    || mpv.getString("video-params/primaries") === "bt.2020";
}

async function ffmpegFilter(hdr, videoPath) {
  if (!hdr) return "format=rgb24";
  const filter = config.zscale ? FILTERS.zscale : FILTERS.scale;

  if (config.tonemap === "none")
    return `${filter.name}=${filter.in}${filter.out},format=rgb24`;

  const mapPeak = config.zscale ? "" : await peak(videoPath);
  return `format=gbrpf32le,${filter.name}=${filter.in}${filter.linear},tonemap=${config.tonemap}${mapPeak}:desat=0,${filter.name}=${filter.out},format=rgb24`;
}

async function ffmpegExec(time, videoPath, outputPath) {
  const hdr = isHDR();
  const filter = await ffmpegFilter(hdr, videoPath);

  const ffmpegLogs = [];
  const { status } = await utils.exec(config.ffmpegPath, [
    "-loglevel", "error",
    "-ss", `${time}`,
    "-i", videoPath,
    "-map_metadata", "-1",
    "-map_chapters", "-1",
    "-vframes", "1",
    "-vf", filter,
    "-update", "1",
    "-y",
    outputPath
  ], undefined, undefined, stderr => ffmpegLogs.push(stderr));

  if (status === 0)
    return core.osd(hdr ? "HDR Screenshot Captured" : "Screenshot Captured");

  const errorLog = [
    `[FFmpeg Error | Status Code: ${status}]`,
    ...ffmpegLogs.map(log => log.trimEnd()).filter(Boolean)
  ].join('\n');

  console.error(errorLog);
  core.osd("FFmpeg capture failed. Check logs");
}

async function captureScreenshot() {
  if (!utils.fileInPath(config.ffmpegPath))
    return core.osd("FFmpeg not found. Check Preferences");

  const url = core.status.url;
  if (!url?.startsWith('file://') || core.status.isNetworkResource)
    return core.osd("Only local files are supported");

  const time = core.status.position;
  if (!(time >= 0))
    return core.osd("Failed to determine current time position");

  const videoPath = decodeURIComponent(url.slice(7));

  const outDir = toOutputDir(videoPath);
  if (!outDir)
    return core.osd("Failed to determine output folder");
  if (!file.exists(outDir))
    return core.osd(`Output folder: "${outDir}" not found`);

  const outPath = toOutputPath(outDir, time);
  if (!outPath)
    return core.osd("Failed to determine output path");

  await ffmpegExec(time, videoPath, outPath);
}

function loadPreferences() {
  config.ffmpegPath = preferences.get("ffmpegPath")?.trim() || config.ffmpegPath;
  config.zscale = preferences.get("zscale") === true;

  const tm = preferences.get("tonemap")?.trim().toLowerCase();
  config.tonemap = VALID_MAPPERS.has(tm) ? tm : "reinhard";
}

async function hdrScreenshotHandler() {
  if (isProcessing)
    return core.osd("HDR screenshot in progress...");

  isProcessing = true;
  try {
    loadPreferences();
    await captureScreenshot();
  } catch (err) {
    console.error("Execution error:", err);
    core.osd("Plugin execution error. Check logs");
  } finally {
    isProcessing = false;
  }
}

event.on("iina.window-loaded", () => {
  const keybind = preferences.get("keybind");
  const options = {};
  let hasConflict = false;

  if (keybind) {
    const kc = input.normalizeKeyCode(keybind);
    hasConflict = !!input.getAllKeyBindings()[kc];
    if (!hasConflict) options.keyBinding = keybind;
  }

  preferences.set("bindConflict", hasConflict);
  preferences.sync();

  menu.addItem(
      menu.item("HDR Screenshot", hdrScreenshotHandler, options)
  );
});