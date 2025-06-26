#!/bin/bash

# TTY Slide Installation Script
# This script sets up TTY Slide with proper permissions and compatibility

set -e

echo "🎨 TTY Slide Installation Script"
echo "================================="
echo

# Check if deno is installed
if ! command -v deno &> /dev/null; then
    echo "❌ Error: Deno is not installed"
    echo "Please install Deno from: https://deno.land/manual/getting_started/installation"
    echo
    echo "Quick install options:"
    echo "  curl -fsSL https://deno.land/x/install/install.sh | sh"
    echo "  brew install deno  # macOS with Homebrew"
    echo "  sudo snap install deno  # Linux with Snap"
    exit 1
fi

echo "✅ Deno found: $(deno --version | head -n1)"

# Check if jp2a is installed
if ! command -v jp2a &> /dev/null; then
    echo "❌ Error: jp2a is not installed"
    echo "Please install jp2a:"
    echo
    echo "Installation options:"
    echo "  brew install jp2a              # macOS"
    echo "  sudo apt-get install jp2a      # Ubuntu/Debian"
    echo "  sudo pacman -S jp2a            # Arch Linux"
    echo "  sudo dnf install jp2a          # Fedora"
    exit 1
fi

echo "✅ jp2a found: $(jp2a --version 2>&1 | head -n1)"

# Get jp2a version and show compatibility info
JP2A_VERSION=$(jp2a --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)
if [ -n "$JP2A_VERSION" ]; then
    echo "   Version: $JP2A_VERSION"

    # Simple version comparison (assuming major.minor.patch format)
    if printf '%s\n' "1.3.2" "$JP2A_VERSION" | sort -V | head -n1 | grep -q "1.3.2"; then
        echo "   ✅ Supports -c (center) flag"
    else
        echo "   ⚠️  Older version detected - TTY Slide will handle centering manually"
    fi
else
    echo "   ⚠️  Could not determine version"
fi

echo

# Make scripts executable
echo "🔧 Setting up executable permissions..."
chmod +x tty-slide.ts 2>/dev/null || true
chmod +x tty-slide 2>/dev/null || true

echo "✅ Scripts are now executable"
echo

# Test compilation
echo "🧪 Testing TypeScript compilation..."
if deno check tty-slide.ts; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

echo

# Show available execution methods
echo "🚀 TTY Slide is ready! Available execution methods:"
echo
echo "Method 1 (Recommended - Works everywhere):"
echo "  deno run --allow-net --allow-read --allow-write --allow-run --allow-env tty-slide.ts --help"
echo
echo "Method 2 (Cross-platform wrapper):"
echo "  ./tty-slide --help"
echo
echo "Method 3 (Deno tasks):"
echo "  deno task tty-slide --help"
echo "  deno task dev    # Quick development mode"
echo "  deno task demo   # Demo with colors and captions"
echo
echo "Method 4 (Direct execution - may prompt for permissions):"
echo "  ./tty-slide.ts --help"
echo

# Check for .env file
if [ ! -f .env ]; then
    echo "📝 Optional: Create a .env file for Pexels API access:"
    echo "  echo 'PEXELS_API_KEY=your_api_key_here' > .env"
    echo "  Get your free API key at: https://www.pexels.com/api/"
    echo
fi

echo "🎉 Installation complete! Run any of the methods above to get started."
echo
echo "💡 Tips:"
echo "  - Use DEBUG=true for detailed logging"
echo "  - Try: ./tty-slide --source=waifu --colors --caption --interval=5"
echo "  - Run ./tty-slide --list-sources to see all available image sources"
