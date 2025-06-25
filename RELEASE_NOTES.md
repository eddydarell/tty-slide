# TTY Slide Release Notes

## Version 1.1.0 - June 25, 2025

### 🎮 Interactive Keyboard Controls

- **Added comprehensive keyboard controls** for real-time slideshow interaction:
  - `SPACE` - Pause/Resume slideshow
  - `N` / `→` (Right Arrow) - Skip to next slide immediately
  - `S` - Save current slide (works even with `--no-save` mode)
  - `Q` - Quit slideshow gracefully
  - `Ctrl+C` - Force quit with cleanup
- **Implemented KeyboardHandler class** with raw terminal input mode for responsive key detection
- **Added signal handling** for graceful shutdown on SIGINT

### 🎨 Enhanced Image Display & Progress Bar

- **Fixed `--fill` flag behavior**: Now correctly toggles jp2a's background color fill instead of terminal height filling
- **Improved image sizing logic**: Images always fit terminal height minus reserved lines for UI elements
- **Redesigned progress bar system**:
  - Single-line, stable progress bar that doesn't shift the image display
  - ASCII play/pause indicators: `▶` for play, `⏸` for pause
  - Centered progress bar with proper terminal width calculation
  - No newlines that could disrupt image positioning
- **Reserved terminal lines** for progress bar and controls, ensuring image top border is always visible
- **Enhanced terminal clearing** on exit for clean shutdown

### 🔧 CLI & User Experience Improvements

- **Updated help message** with accurate `--fill` flag description and keyboard controls documentation
- **Improved progress tracking** with visual state indicators during pause/resume
- **Enhanced error handling** and removed unused catch parameters to fix lint errors
- **Better terminal management** with proper cleanup on all exit scenarios

### 🏗️ Code Quality & Architecture

- **Refactored TTYSlide class** with state management for pause, skip, save, and quit operations
- **Added comprehensive state variables**: `isPaused`, `skipRequested`, `saveRequested`, `currentSlideImage`, `currentImageBuffer`
- **Improved method organization** with dedicated handlers for progress bar and keyboard input
- **Enhanced logging system** with better debug output when `DEBUG=true` is set
- **Removed console.log statements** from keyboard handlers to prevent image display disruption

### 🐛 Bug Fixes

- **Fixed progress bar drift**: Progress bar now stays in place and doesn't shift image content
- **Resolved jp2a flag compatibility**: Proper version checking for `--center` flag support
- **Fixed terminal state management**: Raw mode properly enabled/disabled on startup/shutdown
- **Corrected image sizing**: Images consistently fit available terminal space regardless of `--fill` setting
- **Fixed save functionality**: Manual save (S key) works correctly even when `--no-save` is enabled

### 📚 Documentation Updates

- **Updated inline code documentation** with accurate flag descriptions
- **Enhanced help text** with comprehensive keyboard controls section
- **Improved example usage** in help message with correct flag combinations
- **Added detailed keyboard controls** in startup message

### 🧪 Testing & Validation

- **Performed extensive testing** of all keyboard controls
- **Validated image display** with various terminal sizes and jp2a versions
- **Tested progress bar behavior** during pause/resume cycles
- **Verified save functionality** in both normal and `--no-save` modes
- **Confirmed graceful shutdown** with all exit methods (Q, Ctrl+C, SIGINT)

### 💡 Technical Highlights

- **Raw terminal mode implementation** for immediate keypress detection
- **Asynchronous keyboard handling** without blocking main slideshow loop
- **Proper resource cleanup** with signal handlers and destructor patterns
- **Cross-platform compatibility** maintained for macOS/Linux/Windows
- **Memory efficient** image buffer management with temporary file cleanup

---

### Migration Notes

- No breaking changes to existing CLI arguments
- All existing functionality preserved and enhanced
- New keyboard controls are additive features
- `--fill` flag behavior changed but maintains backward compatibility intention

### Dependencies

- Deno runtime (v1.30+) - unchanged
- jp2a for ASCII art conversion - unchanged
- Optional: Pexels API key for Pexels source - unchanged

### Known Issues

- None reported in this release

---

**Full Changelog**: Enhanced interactive terminal slideshow with real-time controls, improved image display logic, and comprehensive user experience improvements.
