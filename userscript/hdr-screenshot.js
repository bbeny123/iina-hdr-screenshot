const { core, mpv, file, utils, menu } = iina;

const FFMPEG_PATH="/opt/homebrew/bin/ffmpeg";
let isProcessing = false;

async function hdrScreenshot() {
  if (isProcessing) {
    core.osd("HDR screenshot in progress...");
    return;
  }

  if (!utils.fileInPath(FFMPEG_PATH)) {
    core.osd("FFmpeg not found");
    return;
  }

  const time = mpv.getString("time-pos/full")?.trim().replace(/(\.\d{3})\d*/, '$1');
  const input = core.status?.url?.startsWith('file://')
    ? core.status.url.slice(7).trim()
    : null;
  const output = outputPath(time);

  if (!time || !input || !output) return;

  if (file.exists(output)) {
    core.osd("HDR screenshot already exists");
    return;
  }

  isProcessing = true;

  try {
    const { status } = await utils.exec(FFMPEG_PATH, [
      "-ss", time, 
      "-i", input, 
      "-map_metadata", "-1", 
      "-map_chapters", "-1", 
      "-vframes", "1", 
      "-vf", "zscale=t=linear,tonemap=hable", 
      "-update", "1", 
      output
    ]);

    core.osd(status === 0 ? "HDR Screenshot Captured" : "FFmpeg failed to capture HDR screenshot");    
  } finally {
    isProcessing = false;
  }
}

function outputPath(time) {
  const filename = mpv.getString("filename/no-ext")?.trim();
  const outDir = mpv.getString("screenshot-dir")?.trim();
  
  if (!filename || !outDir || !time) return;
  
  return `${outDir}${outDir.endsWith('/') ? '' : '/'}${filename}-${time}-HDR.png`;
}

menu.addItem(
  menu.item(
    "HDR Screenshot",
    hdrScreenshot,
    {
      keyBinding: "Meta+e",
    },
  ),
);
