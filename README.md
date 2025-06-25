# IINA Userscript - Capture HDR Screenshot using FFmpeg

A user script that adds **Capture HDR Screenshot** functionality to [IINA media player](https://iina.io/).

## Usage

You can access the **Capture HDR Screenshot** feature in two ways:

- **Menu**: Plugin → HDR Screenshot
- **Keyboard shortcut**: `Cmd + E`

## Features

- Capture **HDR screenshot** of the current video frame
- Uses `FFmpeg` with **Hable** tone mapping
- Saves as **PNG** to IINA's screenshot output directory

## Installation

1. Copy the content of [`hdr-screenshot.js`](https://github.com/bbeny123/iina-hdr-screenshot/blob/main/hdr-screenshot.js)  
2. Open **IINA → Plugin → Manage User Scripts...** (or press `Cmd + Shift + U`)  
3. Use the copied content to create a new user script  
4. Restart **IINA**

## Requirements

- IINA 1.4.0 or later
- FFmpeg with `--enable-libzimg`
