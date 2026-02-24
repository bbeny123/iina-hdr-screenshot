# HDR Screenshot for IINA

FFmpeg-powered HDR to SDR screenshot capture plugin for [IINA media player](https://iina.io/).

## Features

- **Tone-mapping**: HDR to SDR conversion using **Hable**, **Mobius**, **Reinhard**, or **Clip** algorithms
- **Smart Output**:
    - Saves directly to IINA's screenshot folder
    - Filenames based on the original video name and timecode
- **Configurable via plugin's Preferences**:
    - Remap or disable the keybind
    - Define a custom `FFmpeg` binary path
    - Switch between **Tone-mapping** algorithms
    - Enable reference-quality `zscale` filter

## Usage

Capture an **HDR Screenshot** in two ways:

- **Menu**: `Plugin` → `HDR Screenshot`
- **Keybind**: <kbd>⌘</kbd> + <kbd>E</kbd>

> [!NOTE]
> **Frame Accuracy:** Screenshots are captured at the **nearest keyframe**. The resulting image may not be the exact paused frame.

## Prerequisites

- **IINA** 1.4.0 or later
- **FFmpeg**

> [!IMPORTANT]
> To use `zscale`, **FFmpeg** must be compiled with `--enable-libzimg`

## Installation

Install the plugin using one of these methods:

- **GitHub**: In **IINA Settings** → **Plugins**, click **Install from GitHub...** and enter `bbeny123/iina-hdr-screenshot`
- **Manual**: Download the `.iinaplgz` file from the [latest release](../../releases)

## Alternative: Userscript

This plugin is an extended version of the original single-file userscript (see [userscript/README.md](userscript/README.md) for details).
