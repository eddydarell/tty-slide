# TTY Slide Release Notes

## Version 1.1.2 - June 26, 2025

### 🔄 Loading Animation System

- **Added elegant centered loading animation** with spinning indicator during image fetch and processing
- **Implemented LoadingAnimation class** with proper cursor management and terminal cleanup
- **Multi-phase loading feedback**:
  - "Fetching image..." during API requests
  - "Downloading image..." during file download
  - "Converting to ASCII art..." during jp2a processing
- **Responsive loading interruption**: Skip and quit commands work even during loading phases
- **Clean animation cleanup**: Loading spinner automatically clears before displaying slides

### 🛡️ Robust Error Handling

- **Graceful jp2a failure recovery**: Corrupted or unsupported images show user-friendly error messages
- **Slideshow continuation**: Errors don't stop the slideshow, automatically proceeds to next image
- **Centered error display**: Error messages are properly centered and formatted for readability
- **Comprehensive error context**: Clear descriptions of possible causes and solutions
- **Network timeout handling**: Improved handling of download failures and API timeouts

### 📐 Smart Aspect Ratio Logic

- **Intelligent image sizing**: Images are sized based on their aspect ratio for optimal display
  - **Portrait images**: Constrained by terminal height to maximize vertical content
  - **Landscape images**: Constrained by terminal width to maximize horizontal detail
  - **Square images**: Uses shorter terminal dimension for balanced display
- **Terminal aspect ratio detection**: Automatically determines optimal sizing strategy
- **Dynamic dimension calculation**: Accounts for UI elements and available display space
- **jp2a flag optimization**: Automatically selects `--width` or `--height` flags for best results

### 🧹 Display Quality Enhancements

- **Comprehensive artifact prevention**: Thorough terminal clearing between slides
- **Enhanced cursor management**: Proper show/hide handling during animations
- **ANSI sequence optimization**: Efficient terminal control codes for smooth transitions
- **Screen clearing improvements**: Better use of `\r\x1b[2K\x1b[?25h` for complete line clearing
- **Visual consistency**: Ensures clean, artifact-free slide transitions

### 🎯 User Experience Improvements

- **Immediate skip responsiveness**: Skip commands work during all loading phases
- **Better visual feedback**: Loading states are clearly communicated to users
- **Smoother transitions**: Eliminated flickering and visual artifacts between slides
- **Enhanced error recovery**: Users can continue enjoying the slideshow despite individual image failures
- **Consistent UI header**: Controls reminder always visible during slideshow

### 🏗️ Code Architecture Enhancements

- **Modular loading system**: Separated LoadingAnimation class for reusable functionality
- **Improved error handling patterns**: Centralized error display with consistent formatting
- **Enhanced state management**: Better tracking of loading states and user interactions
- **Cleaner separation of concerns**: Image processing, display, and animation logic properly separated
- **Robust resource cleanup**: Ensures temporary files and animations are always cleaned up

### 🐛 Critical Bug Fixes

- **Fixed loading animation artifacts**: Spinner properly clears before each slide
- **Resolved cursor visibility issues**: Cursor state properly managed during animations
- **Fixed terminal clearing race conditions**: Ensures clean slate before each slide display
- **Improved error message centering**: Error text properly positioned for all terminal sizes
- **Enhanced jp2a error handling**: Better detection and recovery from conversion failures

### � Comprehensive Documentation

- **Updated README.md** with comprehensive documentation of all new features
- **Added Technical Features section** explaining aspect ratio logic and error handling
- **Enhanced troubleshooting guide** with loading animation and display quality tips
- **Updated examples** to highlight new loading and error handling capabilities
- **Improved feature descriptions** with detailed explanations of visual enhancements

### 🔬 Quality Assurance

- **Extensive loading animation testing** across different terminal sizes and types
- **Error handling validation** with corrupted images and network failures
- **Aspect ratio testing** with portrait, landscape, and square images
- **Cross-platform compatibility** verified on macOS, Linux terminal emulators
- **Performance testing** with rapid skip operations during loading phases

### ⚡ Advanced Technical Features

- **Adaptive loading system** that responds to terminal dimensions
- **Bulletproof error recovery** maintaining slideshow flow despite failures
- **Intelligent image processing** with automatic aspect ratio optimization
- **Memory-efficient animations** with minimal resource overhead
- **Zero-artifact display** with comprehensive cleanup mechanisms

---

### Migration Notes v1.1.2

- **No breaking changes**: All existing CLI arguments and functionality preserved
- **Enhanced user experience**: New loading animations and error handling are automatic
- **Improved visual quality**: Better image sizing and display clarity
- **Backward compatibility**: Works with all jp2a versions (1.0.0+)
- **Performance improvements**: Faster error recovery and smoother transitions

### Dependencies v1.1.2

- Deno runtime (v1.30+) - unchanged
- jp2a for ASCII art conversion (1.0.0+ supported, 1.3.2+ recommended)
- Optional: Pexels API key for Pexels source - unchanged

### Known Issues v1.1.2

- None reported in this release

---

**Full Changelog v1.1.2**: Enhanced loading animations, robust error handling, smart aspect ratio logic, and comprehensive display quality improvements for a seamless terminal slideshow experience.

---

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
