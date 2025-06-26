# TTY Slide - Terminal Multi-Source Slideshow

A powerful terminal-based slideshow that fetches images from multiple APIs (Waifu API, Pexels API, etc.) and displays them as beautiful ASCII art using jp2a.

## Features

- � **Interactive Keyboard Controls**: Real-time pause, skip, save, and quit controls
- �🎨 **Multiple Image Sources**: Support for Waifu API, Pexels API, and local directories
- 🗂️ **Local Directory Support**: Display images from your own photo collection
- 🎲 **Random Source Selection**: Automatically pick between different sources
- 🏷️ **Tag-Based Filtering**: Search for specific content using tags
- 🎨 **ASCII Art Display**: Beautiful terminal graphics with color support
- 📷 **Auto-Save Images**: Optionally save fetched images to disk
- 📝 **Rich Captions**: Display artist info, descriptions, and file metadata
- ⏱️ **Customizable Intervals**: Set slideshow timing with real-time pause/resume
- 🎛️ **Multiple Display Options**: Color, fill, and size options
- 📊 **Visual Progress Bar**: Live progress indication with play/pause status
- 🔧 **Cross-Platform Compatibility**: Works on macOS, Linux, and Windows
- ⚡ **jp2a Version Detection**: Automatic compatibility handling for older jp2a versions
- 🔄 **Loading Animation**: Elegant centered spinner while fetching and processing images
- 🛡️ **Robust Error Handling**: Graceful handling of download failures and corrupted images
- 📐 **Smart Aspect Ratio**: Intelligent image sizing that maintains aspect ratios
- 🧹 **Clean Display**: Automatic cleanup of loading artifacts for pristine slide display

## Requirements

- **Deno** runtime (v1.30+)
- **jp2a** for ASCII art conversion (1.3.2+ recommended)
- **.env file** with API keys (optional for some sources)

### Installing jp2a

```bash
# macOS
brew install jp2a

# Ubuntu/Debian
sudo apt-get install jp2a

# Arch Linux
sudo pacman -S jp2a
```

## Setup

1. **Clone or download** the script to your preferred directory
2. **Make it executable** (optional):

   ```bash
   chmod +x tty-slide.ts
   chmod +x tty-slide  # For the wrapper script
   ```

3. **Create a .env file** (optional, required for Pexels):

   ```bash
   PEXELS_API_KEY=your_pexels_api_key_here
   ```

### Getting API Keys

- **Pexels API**: Get your free API key at [pexels.com/api](https://www.pexels.com/api/)
- **Waifu API**: No API key required

## Interactive Controls

TTY-Slide features **real-time keyboard controls** for an interactive slideshow experience with visual feedback and smooth transitions:

### Loading Animation

- **Elegant Spinner**: A centered loading animation appears while fetching and processing images
- **Progress Indication**: Visual feedback during download, conversion, and display preparation
- **Clean Transitions**: Loading animation is automatically cleared before each slide displays
- **Skip Responsiveness**: Loading can be interrupted by user controls (skip/quit)

### Visual Experience

- **Smart Aspect Ratio**: Images are intelligently sized to maintain proper proportions:
  - **Portrait images**: Fit to terminal height for optimal viewing
  - **Landscape images**: Fit to terminal width to maximize display area
  - **Square images**: Fit to the shorter terminal dimension for balanced display
- **Clean Display**: Automatic terminal clearing between slides prevents visual artifacts
- **Error Recovery**: Graceful handling of corrupted or unavailable images with user-friendly messages

### Keyboard Controls

| Key | Action | Description |
|-----|--------|-------------|
| `SPACE` | Pause/Resume | Toggle slideshow pause state |
| `N` / `→` | Skip | Skip to next slide immediately |
| `S` | Save | Save current slide (works even with `--no-save`) |
| `Q` | Quit | Exit slideshow gracefully |
| `Ctrl+C` | Force Quit | Emergency exit with cleanup |

### Control Features

- **Real-time Response**: All controls work instantly without disrupting the display
- **Visual Feedback**: Progress bar shows play (▶) and pause (⏸) indicators
- **Save Override**: Use `S` to save individual slides even when `--no-save` is enabled
- **Graceful Exit**: Proper terminal cleanup on all exit methods
- **Non-disruptive**: Controls don't interfere with image display or progress bar
- **Loading Interruption**: Skip or quit commands work even during image loading phases

## Usage

### Execution Methods

TTY-Slide supports multiple execution methods for maximum compatibility:

#### Method 1: Direct Deno execution (Recommended - Works everywhere)

```bash
deno run --allow-net --allow-read --allow-write --allow-run --allow-env tty-slide.ts [options]
```

#### Method 2: Using the wrapper script (Cross-platform compatible)

```bash
./tty-slide [options]
```

#### Method 3: Using deno tasks (Requires deno.json)

```bash
deno task tty-slide [options]      # Custom execution
deno task dev                      # Development mode
deno task demo                     # Demo mode
```

#### Method 4: Direct execution (Requires deno.json and compatible env)

```bash
./tty-slide.ts [options]
```

> **Note**: Method 1 is recommended for maximum compatibility across all platforms, especially Ubuntu and other Linux distributions where shebang handling may vary.

### Basic Usage

```bash
# Simple slideshow with random sources and interactive controls
./tty-slide.ts --colors --caption

# Using Deno directly with interactive controls
deno run --allow-net --allow-read --allow-write --allow-run --allow-env tty-slide.ts --colors --caption
```

> **💡 Tip**: Once the slideshow starts, use keyboard controls for real-time interaction:
>
> - `SPACE` to pause/resume
> - `N` or `→` to skip slides
> - `S` to save the current slide
> - `Q` to quit gracefully

### Source Selection

```bash
# Use only Pexels photos
./tty-slide.ts --source=pexels --tags=nature,landscape

# Use only Waifu images
./tty-slide.ts --source=waifu --tags=maid,uniform

# Use your local photo directory
./tty-slide.ts --source=./my-photos --caption --colors

# Use absolute path to directory
./tty-slide.ts --source=/home/user/Pictures --interval=5

# Random source selection (default)
./tty-slide.ts --source=random
```

### Advanced Options

```bash
# Custom interval and directory
./tty-slide.ts --interval=5 --dir=./my-images --colors --fill

# No saving, just display
./tty-slide.ts --no-save --caption --colors

# NSFW content (Waifu only)
./tty-slide.ts --source=waifu --nsfw --tags=ecchi
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--source=SOURCE` | Image source: `waifu`, `pexels`, `random`, or `/path/to/directory` | `random` |
| `--nsfw` | Include NSFW tags (waifu only) | `false` |
| `--interval=N` | Interval between images in seconds | `10` |
| `--dir=DIR` | Output directory for saved images | `./slides` |
| `--no-save` | Don't save images to disk (auto-enabled for directories) | `false` |
| `--tags=TAG1,TAG2` | Search tags/query terms (not used for directories) | auto-selected |
| `--colors` | Display images in color | `false` |
| `--fill` | Fill ASCII art background with ANSI color | `false` |
| `--caption` | Show image captions (file metadata for directories) | `false` |
| `--list-sources` | Show available sources | - |
| `--list-tags` | Show available tags | - |
| `--help` | Show help message | - |

## Available Sources

### Local Directory

- **Type**: Your own image collection
- **Formats**: JPEG, PNG, GIF, BMP, WebP
- **API Key**: Not required
- **Content**: Personal photos, downloaded images, any local collection
- **Features**: Automatically enables `--no-save`, displays file metadata in captions

### Waifu API

- **Type**: Anime/manga artwork
- **Tags**: Character names, art styles, NSFW options
- **API Key**: Not required
- **Content**: Anime waifus, characters, artwork

### Pexels API

- **Type**: Stock photography
- **Tags**: Nature, architecture, people, objects, etc.
- **API Key**: Required (free)
- **Content**: High-quality stock photos, all safe for work

## Tag Examples

### Waifu Tags

```bash
# Safe tags
--tags=maid,waifu,uniform,kamisato-ayaka

# NSFW tags (automatically enables --nsfw)
--tags=ecchi,oppai
```

### Pexels Tags

```bash
# Nature and landscapes
--tags=nature,landscape,mountains,sunset

# Urban and architecture
--tags=city,architecture,building,street

# Abstract and artistic
--tags=abstract,minimal,geometric,pattern
```

## Examples

```bash
# Interactive colorful nature slideshow from Pexels with loading animation
./tty-slide.ts --source=pexels --tags=nature,sunset --colors --caption --interval=8

# Interactive anime characters with loading feedback and error handling
./tty-slide.ts --source=waifu --tags=maid,uniform --caption --colors

# Display your personal photo collection with smart aspect ratio handling
./tty-slide.ts --source=./my-photos --caption --colors --interval=3

# Browse vacation photos with metadata and graceful error recovery
./tty-slide.ts --source=/Users/username/Pictures/Vacation2024 --caption --fill

# Mixed content slideshow with loading animation and clean transitions
./tty-slide.ts --source=random --caption --fill --interval=5

# Quick preview with elegant loading and save-on-demand using 'S' key
./tty-slide.ts --no-save --colors --interval=3
```

## Technical Features

### Image Processing Enhancements

- **Intelligent Aspect Ratio Logic**: Automatically determines optimal sizing strategy based on image dimensions
  - Portrait images (height > width): Uses `--height` flag to maximize vertical display
  - Landscape images (width > height): Uses `--width` flag to maximize horizontal display
  - Square images (width ≈ height): Uses the shorter terminal dimension for balanced scaling
- **Terminal Dimension Awareness**: Dynamically calculates available display space accounting for captions and UI elements
- **jp2a Optimization**: Automatically selects the best jp2a flags for each image type

### Loading & Error Handling

- **Centered Loading Animation**: Elegant spinner that adapts to terminal width with proper positioning
- **Robust Error Recovery**: Graceful handling of network failures, corrupted images, and jp2a processing errors
- **Clean State Management**: Ensures loading animations are always cleared before displaying content
- **User-Friendly Messages**: Clear, centered error messages that don't disrupt the slideshow flow
- **Interrupt Handling**: Loading phases can be immediately interrupted by user commands

### Display Quality

- **Artifact Prevention**: Comprehensive terminal clearing prevents visual remnants between slides
- **Cursor Management**: Proper cursor show/hide handling during animations and display
- **ANSI Sequence Optimization**: Efficient use of terminal control codes for smooth transitions
- **Cross-Platform Compatibility**: Works consistently across different terminal emulators and operating systems

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PEXELS_API_KEY` | Your Pexels API key (required for Pexels source) |
| `DEBUG=true` | Enable verbose logging output |

## Troubleshooting

### Common Issues

#### Loading animation or display artifacts

- The loading spinner automatically clears itself before each slide
- If you see trailing characters, your terminal may not support certain ANSI sequences
- Try resizing your terminal window to refresh the display
- Use `Ctrl+L` to manually clear the terminal if needed

#### Image display quality

- **Aspect ratio preservation**: Images automatically fit your terminal dimensions while maintaining proportions
- **Portrait images**: Optimized for height to show full vertical content
- **Landscape images**: Optimized for width to maximize horizontal detail
- **Error handling**: Corrupted or unavailable images show a clear error message and continue the slideshow

#### Keyboard controls not responding

- Ensure your terminal supports raw input mode
- Try running with `DEBUG=true` to see if key presses are detected
- Some terminals may require focus to capture keyboard input
- Loading phases may briefly delay input processing but won't ignore commands

#### Progress bar or display issues

- Make sure your terminal window is large enough (minimum 80x24 recommended)
- The progress bar shows ▶ when playing and ⏸ when paused
- Images automatically resize to fit available terminal space
- Loading animation centers itself based on current terminal width

### jp2a not found

```bash
# Install jp2a first
brew install jp2a  # macOS
sudo apt install jp2a  # Ubuntu/Debian
```

### Pexels API errors

- Check your API key in the `.env` file
- Verify you haven't exceeded rate limits (200 requests/hour)
- Get a free API key at [pexels.com/api](https://www.pexels.com/api/)

### Permission errors

```bash
# Make sure the script is executable
chmod +x tty-slide.ts

# Run with required permissions
deno run --allow-net --allow-read --allow-write --allow-run --allow-env tty-slide.ts
```

## License

GNU General Public License v2.0 (GPL-2.0) This project is licensed under the
GPL-2.0 license. See the [LICENSE](LICENSE) file for details.

## Credits

- **[waifu.im API](https://docs.waifu.im/)** - For providing high-quality anime images
- **[jp2a](https://github.com/cslarsen/jp2a)** - For ASCII art conversion
- **[Deno](https://deno.com/)** - For the modern JavaScript/TypeScript runtime
- **[Pexels API](https://www.pexels.com/api/)** - For stock photography

## Author

Eddy Ntambwe <eddydarell@gmail.com>

---

Enjoy your beautiful terminal slideshow! 🎨✨
