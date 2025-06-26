#!/usr/bin/env deno

/**
 * TTY Slide - Terminal slideshow with multiple image sources
 *
 * A Deno terminal-based slideshow that fetches images from multiple APIs
 * (Waifu API, Pexels API, etc.) and displays them using jp2a.
 *
 * Requirements:
 * - Deno runtime (v1.30+)
 * - jp2a for ASCII art conversion
 * - .env file with API keys (optional for some sources)
 *
 * @example
 * ```bash
 * # Run with full permissions:
 * deno run --allow-net --allow-read --allow-write --allow-run --allow-env tty-slide.ts --colors
 *
 * # Or make executable and run directly (requires deno.json configuration):
 * chmod +x tty-slide.ts
 * ./tty-slide.ts --source=pexels --tags=nature,landscape --interval=5 --colors --fill
 *
 * # Alternative: use deno task (if configured in deno.json)
 * deno task tty-slide --colors --caption
 * ```
 *
 * @author Eddy Ntambwe <eddydarell@gmail.com>
 * @license GNU General Public License v2.0
 * @version 1.1.2
 */

import {
  bgBrightCyan,
  bgBrightGreen,
  bgBrightMagenta,
  bgBrightRed,
  bgBrightWhite,
  bgBrightYellow,
  bgRed,
  bold,
  brightCyan,
  brightRed,
  brightYellow,
  dim,
  green,
  red,
  white,
  yellow,
} from "https://deno.land/std@0.181.0/fmt/colors.ts";
import { load } from "https://deno.land/std@0.181.0/dotenv/mod.ts";
import { basename, dirname } from "https://deno.land/std@0.181.0/path/mod.ts";

// Load environment variables
const env = await load();

// Type definitions
interface WaifuApiResponse {
  images: Array<{
    signature: string;
    extension: string;
    image_id: number;
    favorites: number;
    dominant_color: string;
    source: string;
    artist: {
      artist_id: number;
      name: string;
      patreon: string | null;
      pixiv: string | null;
      twitter: string | null;
      deviant_art: string | null;
    } | null;
    uploaded_at: string;
    liked_at: string | null;
    is_nsfw: boolean;
    width: number;
    height: number;
    byte_size: number;
    url: string;
    preview_url: string;
    tags: Array<{
      tag_id: number;
      name: string;
      description: string;
      is_nsfw: boolean;
    }>;
  }>;
}

interface PexelsApiResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: Array<{
    id: number;
    width: number;
    height: number;
    url: string;
    photographer: string;
    photographer_url: string;
    photographer_id: number;
    avg_color: string;
    src: {
      original: string;
      large2x: string;
      large: string;
      medium: string;
      small: string;
      portrait: string;
      landscape: string;
      tiny: string;
    };
    liked: boolean;
    alt: string;
  }>;
  next_page?: string;
  prev_page?: string;
}

interface SlideImage {
  url: string;
  caption?: string;
  artist?: string;
  source: string;
  tags?: string[];
  description?: string;
  isNsfw?: boolean;
}

interface Config {
  source: "waifu" | "pexels" | "random" | string; // Allow any string for directory paths
  includeNsfw: boolean;
  intervalSeconds: number;
  outputDir: string;
  colors: boolean;
  fill: boolean;
  caption: boolean;
  maxRetries: number;
  timeout: number;
  noSave?: boolean;
  customTags?: string[];
}

interface Tags {
  versatile: string[];
  nsfw: string[];
}

// Logging utility
class Logger {
  private static formatTime(): string {
    return new Date().toISOString().replace("T", " ").slice(0, 19);
  }

  private static isDebugMode(): boolean {
    return Deno.env.get("DEBUG") === "true";
  }

  static info(message: string): void {
    if (this.isDebugMode()) {
      const timestamp = brightCyan(`[${this.formatTime()}]`);
      const level = bgBrightCyan(bold(` INFO `));
      console.log(`${timestamp} ${level} ${white(message)}`);
    }
  }

  static error(message: string, error?: Error): void {
    if (this.isDebugMode()) {
      const timestamp = brightCyan(`[${this.formatTime()}]`);
      const level = bgBrightRed(bold(` ERROR `));
      console.error(`${timestamp} ${level} ${brightRed(message)}`);
      if (error) {
        const stackLabel = bgRed(bold(` STACK `));
        console.error(
          `${timestamp} ${stackLabel} ${red(error.stack || error.message)}`,
        );
      }
    }
  }

  static warn(message: string): void {
    if (this.isDebugMode()) {
      const timestamp = brightCyan(`[${this.formatTime()}]`);
      const level = bgBrightYellow(bold(` WARN `));
      console.warn(`${timestamp} ${level} ${yellow(message)}`);
    }
  }

  static debug(message: string): void {
    if (this.isDebugMode()) {
      const timestamp = brightCyan(`[${this.formatTime()}]`);
      const level = bgBrightMagenta(bold(` DEBUG `));
      console.log(`${timestamp} ${level} ${white(message)}`);
    }
  }

  static success(message: string): void {
    if (this.isDebugMode()) {
      const timestamp = brightCyan(`[${this.formatTime()}]`);
      const level = bgBrightGreen(bold(` SUCCESS `));
      console.log(`${timestamp} ${level} ${green(message)}`);
    }
  }
}

// System dependency checker
class DependencyChecker {
  static async checkJp2a(): Promise<boolean> {
    try {
      const jp2aCheck = new Deno.Command("which", {
        args: ["jp2a"],
        stdout: "piped",
        stderr: "piped",
      });
      const output = await jp2aCheck.output();
      return output.code === 0;
    } catch (error) {
      Logger.error("Failed to check jp2a dependency", error as Error);
      return false;
    }
  }

  static async getJp2aVersion(): Promise<string | null> {
    try {
      const versionCheck = new Deno.Command("jp2a", {
        args: ["--version"],
        stdout: "piped",
        stderr: "piped",
      });
      const output = await versionCheck.output();

      if (output.code !== 0) {
        return null;
      }

      // jp2a outputs version to stderr, not stdout
      const versionText = new TextDecoder().decode(output.stderr);
      // Extract version number from output like "jp2a 1.3.2" or "jp2a version 1.3.2"
      const versionMatch = versionText.match(/jp2a.*?(\d+\.\d+\.\d+)/i);
      return versionMatch ? versionMatch[1] : null;
    } catch (error) {
      Logger.error("Failed to get jp2a version", error as Error);
      return null;
    }
  }

  static compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }

    return 0;
  }

  static async checkAllDependencies(): Promise<void> {
    Logger.info("Checking system dependencies...");

    const jp2aExists = await this.checkJp2a();
    if (!jp2aExists) {
      Logger.error("jp2a is not installed or not in PATH");
      console.error("\nTo install jp2a:");
      console.error("  macOS: brew install jp2a");
      console.error("  Ubuntu/Debian: sudo apt-get install jp2a");
      console.error("  Arch: sudo pacman -S jp2a");
      Deno.exit(1);
    }

    // Check jp2a version and warn if too old
    const jp2aVersion = await this.getJp2aVersion();
    if (jp2aVersion) {
      Logger.info(`jp2a version: ${jp2aVersion}`);

      if (this.compareVersions(jp2aVersion, "1.3.2") < 0) {
        console.warn(`${yellow("⚠️  WARNING:")} jp2a version ${jp2aVersion} detected. Version 1.3.2+ is recommended.`);
        console.warn(`${yellow("   The -c (center) flag is not available in older versions.")}`);
        console.warn(`${yellow("   Images will be centered manually by TTY-Slide.")}\n`);
      }
    } else {
      Logger.warn("Could not determine jp2a version");
    }

    Logger.success("All dependencies satisfied");
  }
}

// Configuration management
class ConfigManager {
  private static readonly DEFAULT_CONFIG: Config = {
    source: "random",
    includeNsfw: false,
    intervalSeconds: 10,
    outputDir: "./slides", // Will be updated by getDefaultImagesDirectory
    colors: false,
    fill: false,
    caption: false,
    maxRetries: 3,
    timeout: 30000,
  };

  private static async getDefaultImagesDirectory(): Promise<string> {
    try {
      // Try to get user's home directory
      const homeDir = Deno.env.get("HOME");
      if (homeDir) {
        const imagesDir = `${homeDir}/Pictures`;
        try {
          await Deno.stat(imagesDir);
          return `${imagesDir}/TTY-Slides`;
        } catch {
          // Pictures directory doesn't exist, fall back to current directory
        }
      }
    } catch {
      // Fall back to current directory if anything fails
    }
    return "./slides";
  }

  static async parseArgs(): Promise<Config> {
    const config = { ...this.DEFAULT_CONFIG };

    // Set default output directory
    config.outputDir = await this.getDefaultImagesDirectory();

    config.noSave = Deno.args.includes("--no-save");
    config.includeNsfw = Deno.args.includes("--nsfw");
    config.colors = Deno.args.includes("--colors");
    config.fill = Deno.args.includes("--fill");
    config.caption = Deno.args.includes("--caption");

    const sourceArg = Deno.args.find((arg) => arg.startsWith("--source="));
    if (sourceArg) {
      const source = sourceArg.split("=")[1];
      // Accept any source - predefined sources or directory paths
      config.source = source;

      // If source looks like a directory path, automatically set --no-save
      if (source !== "waifu" && source !== "pexels" && source !== "random") {
        config.noSave = true;
        Logger.info(`Directory source detected (${source}), automatically enabling --no-save`);
      }
    }

    const intervalArg = Deno.args.find((arg) => arg.startsWith("--interval="));
    if (intervalArg) {
      const interval = parseInt(intervalArg.split("=")[1]);
      if (!isNaN(interval) && interval > 0) {
        config.intervalSeconds = interval;
      }
    }

    const dirArg = Deno.args.find((arg) => arg.startsWith("--dir="));
    if (dirArg) {
      config.outputDir = dirArg.split("=")[1];
    }

    const tagsArg = Deno.args.find((arg) => arg.startsWith("--tags="));
    if (tagsArg) {
      const tags = tagsArg.split("=")[1].split(",").map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      if (tags.length > 0) {
        config.customTags = tags;
        // If NSFW tags are specified, enable NSFW mode
        const nsfwTags = [
          "ass",
          "hentai",
          "milf",
          "oral",
          "paizuri",
          "ecchi",
          "ero",
        ];
        if (tags.some((tag) => nsfwTags.includes(tag.toLowerCase()))) {
          config.includeNsfw = true;
        }
      }
    }

    return config;
  }
}

// Base fetcher interface
interface ImageFetcher {
  fetchRandomImage(config: Config): Promise<SlideImage | null>;
  listAllTags(): void;
  getSource(): string;
}

// Waifu API fetcher
class WaifuFetcher implements ImageFetcher {
  private static readonly API_URL = "https://api.waifu.im/search";

  private static readonly TAGS: Tags = {
    "versatile": [
      "maid",
      "waifu",
      "marin-kitagawa",
      "mori-calliope",
      "raiden-shogun",
      "oppai",
      "selfies",
      "uniform",
      "kamisato-ayaka",
    ],
    "nsfw": [
      "ass",
      "hentai",
      "milf",
      "oral",
      "paizuri",
      "ecchi",
      "ero",
    ],
  };

  getSource(): string {
    return "waifu";
  }

  listAllTags(): void {
    console.log(`\n${bold(brightCyan("Waifu API Tags:"))}\n`);

    console.log(
      `${bold(green("Safe Tags:"))} ${white("(suitable for all audiences)")}`,
    );
    WaifuFetcher.TAGS.versatile.forEach((tag) => {
      console.log(`  ${green("•")} ${white(tag)}`);
    });

    console.log(
      `\n${bold(brightRed("NSFW/Explicit Tags:"))} ${
        yellow("(18+ content only)")
      }`,
    );
    WaifuFetcher.TAGS.nsfw.forEach((tag) => {
      console.log(
        `  ${brightRed("•")} ${white(tag)} ${brightRed("[EXPLICIT]")}`,
      );
    });
  }

  async fetchRandomImage(config: Config): Promise<SlideImage | null> {
    let tagsToUse: string[];

    if (config.customTags && config.customTags.length > 0) {
      tagsToUse = config.customTags;
      Logger.info(`Using custom tags: ${tagsToUse.join(", ")}`);
    } else {
      const tagCategory = config.includeNsfw
        ? [...WaifuFetcher.TAGS.versatile, ...WaifuFetcher.TAGS.nsfw]
        : WaifuFetcher.TAGS.versatile;
      tagsToUse = [tagCategory[Math.floor(Math.random() * tagCategory.length)]];
    }

    Logger.info(`Fetching waifu with tags: ${tagsToUse.join(", ")}...`);

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        const params = {
          included_tags: tagsToUse,
          height: ">=2000",
        };

        const queryParams = new URLSearchParams();
        for (const key in params) {
          const value = params[key as keyof typeof params];
          if (Array.isArray(value)) {
            value.forEach((v) => queryParams.append(key, v));
          } else {
            queryParams.set(key, value);
          }
        }

        const requestUrl = `${WaifuFetcher.API_URL}?${queryParams.toString()}`;
        Logger.debug(`Request URL: ${requestUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        const response = await fetch(requestUrl, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API request failed with status: ${response.status}`);
        }

        const data: WaifuApiResponse = await response.json();
        const image = data.images?.[0];

        if (!image || !image.url) {
          throw new Error("No image found in API response");
        }

        Logger.success(`Successfully fetched waifu image: ${image.url}`);

        return {
          url: image.url,
          source: "waifu",
          artist: image.artist?.name || "Unknown",
          caption: image.artist ? `Artist: ${image.artist.name}` : undefined,
          tags: image.tags?.map(tag => tag.name) || [],
          description: image.tags?.map(tag => tag.description).filter(desc => desc).join(" • ") || undefined,
          isNsfw: image.is_nsfw, // Add NSFW flag from API
        };
      } catch (error) {
        Logger.warn(
          `Attempt ${attempt}/${config.maxRetries} failed: ${
            (error as Error).message
          }`,
        );

        if (attempt === config.maxRetries) {
          Logger.error("All retry attempts failed", error as Error);
          return null;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        Logger.info(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return null;
  }
}

// Pexels API fetcher
class PexelsFetcher implements ImageFetcher {
  private static readonly API_URL = "https://api.pexels.com/v1/search";
  private static readonly API_KEY = env["PEXELS_API_KEY"] || Deno.env.get("PEXELS_API_KEY") || "";

  private static readonly TAGS = [
    "nature", "landscape", "city", "ocean", "forest", "mountains", "sunset", "sunrise",
    "architecture", "building", "street", "travel", "sky", "clouds", "flowers", "animals",
    "portrait", "people", "food", "coffee", "technology", "abstract", "vintage", "modern",
    "minimal", "colorful", "black and white", "urban", "rural", "beach", "snow", "autumn",
    "spring", "summer", "winter", "light", "shadow", "texture", "pattern", "geometric",
    "artistic", "creative", "inspiration", "peaceful", "energy", "motion", "still life"
  ];

  getSource(): string {
    return "pexels";
  }

  listAllTags(): void {
    console.log(`\n${bold(brightCyan("Pexels API Tags:"))}\n`);

    console.log(
      `${bold(green("Available Tags:"))} ${white("(all content is safe for work)")}`,
    );

    // Display tags in columns
    const tagsPerColumn = 6;
    for (let i = 0; i < PexelsFetcher.TAGS.length; i += tagsPerColumn) {
      const tagGroup = PexelsFetcher.TAGS.slice(i, i + tagsPerColumn);
      tagGroup.forEach((tag) => {
        console.log(`  ${green("•")} ${white(tag)}`);
      });
      if (i + tagsPerColumn < PexelsFetcher.TAGS.length) {
        console.log(); // Add space between groups
      }
    }
  }

  async fetchRandomImage(config: Config): Promise<SlideImage | null> {
    if (!PexelsFetcher.API_KEY) {
      Logger.error("Pexels API key not found. Please set PEXELS_API_KEY in .env file or environment variables.");
      return null;
    }

    let searchQuery: string;

    if (config.customTags && config.customTags.length > 0) {
      searchQuery = config.customTags.join(" ");
      Logger.info(`Using custom search query: "${searchQuery}"`);
    } else {
      searchQuery = PexelsFetcher.TAGS[Math.floor(Math.random() * PexelsFetcher.TAGS.length)];
      Logger.info(`Using random search query: "${searchQuery}"`);
    }

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        const randomPage = Math.floor(Math.random() * 10) + 1; // Random page 1-10
        const queryParams = new URLSearchParams({
          query: searchQuery,
          per_page: "20",
          page: randomPage.toString(),
        });

        const requestUrl = `${PexelsFetcher.API_URL}?${queryParams.toString()}`;
        Logger.debug(`Request URL: ${requestUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        const response = await fetch(requestUrl, {
          headers: {
            "Authorization": PexelsFetcher.API_KEY,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API request failed with status: ${response.status}`);
        }

        const data: PexelsApiResponse = await response.json();

        if (!data.photos || data.photos.length === 0) {
          throw new Error("No photos found in API response");
        }

        // Select a random photo from the results
        const randomPhoto = data.photos[Math.floor(Math.random() * data.photos.length)];

        Logger.success(`Successfully fetched Pexels image: ${randomPhoto.src.large}`);

        return {
          url: randomPhoto.src.large,
          source: "pexels",
          artist: randomPhoto.photographer,
          caption: `Photo by ${randomPhoto.photographer} on Pexels`,
          description: randomPhoto.alt || searchQuery,
        };
      } catch (error) {
        Logger.warn(
          `Attempt ${attempt}/${config.maxRetries} failed: ${
            (error as Error).message
          }`,
        );

        if (attempt === config.maxRetries) {
          Logger.error("All retry attempts failed", error as Error);
          return null;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        Logger.info(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return null;
  }
}

// Local directory fetcher
class LocalDirectoryFetcher implements ImageFetcher {
  private directoryPath: string;
  private supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

  constructor(directoryPath: string) {
    this.directoryPath = directoryPath;
  }

  async fetchRandomImage(_config: Config): Promise<SlideImage | null> {
    try {
      // Check if directory exists
      const dirInfo = await Deno.stat(this.directoryPath);
      if (!dirInfo.isDirectory) {
        Logger.error(`Path is not a directory: ${this.directoryPath}`);
        return null;
      }

      // Get all image files from directory
      const imageFiles: string[] = [];
      for await (const entry of Deno.readDir(this.directoryPath)) {
        if (entry.isFile) {
          // Extract extension, handling query parameters and other suffixes
          const fileName = entry.name.toLowerCase();
          const hasImageExtension = this.supportedExtensions.some(ext =>
            fileName.includes(ext)
          );
          if (hasImageExtension) {
            imageFiles.push(`${this.directoryPath}/${entry.name}`);
          }
        }
      }

      if (imageFiles.length === 0) {
        Logger.error(`No supported image files found in directory: ${this.directoryPath}`);
        return null;
      }

      // Select random image
      const randomImage = imageFiles[Math.floor(Math.random() * imageFiles.length)];

      // Get file metadata
      const fileInfo = await Deno.stat(randomImage);
      const fileName = basename(randomImage);
      const fileSize = (fileInfo.size / 1024 / 1024).toFixed(2); // Size in MB

      // Create caption with file metadata
      const caption = `📁 ${fileName} | 💾 ${fileSize} MB | 📅 ${fileInfo.mtime?.toLocaleDateString() || 'Unknown'}`;

      return {
        url: `file://${randomImage}`,
        caption: caption,
        artist: 'Local File',
        source: 'directory',
        description: `Image from local directory: ${dirname(randomImage)}`,
      };

    } catch (error) {
      Logger.error(`Failed to fetch image from directory: ${(error as Error).message}`, error as Error);
      return null;
    }
  }

  listAllTags(): void {
    console.log(`\n${bold(brightCyan("Local Directory Fetcher:"))}`);
    console.log(`${green("•")} Source: ${white(this.directoryPath)}`);
    console.log(`${green("•")} Supported formats: ${white(this.supportedExtensions.join(', '))}`);
    console.log(`${green("•")} Note: Local directory source doesn't use tags for filtering`);
  }

  getSource(): string {
    return `Local Directory (${this.directoryPath})`;
  }
}

// Image fetcher registry
class FetcherRegistry {
  private static fetchers: Map<string, ImageFetcher> = new Map([
    ["waifu", new WaifuFetcher()],
    ["pexels", new PexelsFetcher()],
  ]);

  static getFetcher(source: string): ImageFetcher | null {
    // Check if it's a predefined source
    const predefinedFetcher = this.fetchers.get(source);
    if (predefinedFetcher) {
      return predefinedFetcher;
    }

    // Check if it's a directory path
    if (this.isDirectoryPath(source)) {
      return new LocalDirectoryFetcher(source);
    }

    return null;
  }

  private static isDirectoryPath(source: string): boolean {
    // Check if the source looks like a path (contains / or \ or starts with . or ~)
    return source.includes('/') || source.includes('\\') || source.startsWith('.') || source.startsWith('~') || source.startsWith('/');
  }

  static getRandomFetcher(): ImageFetcher {
    const fetcherEntries = Array.from(this.fetchers.entries());
    const randomEntry = fetcherEntries[Math.floor(Math.random() * fetcherEntries.length)];
    return randomEntry[1];
  }

  static listAllSources(): void {
    console.log(`\n${bold(brightCyan("Available Sources:"))}\n`);

    this.fetchers.forEach((fetcher, source) => {
      console.log(`${green("•")} ${bold(white(source))} - ${fetcher.getSource()} API`);
    });

    console.log(`${green("•")} ${bold(white("random"))} - Randomly select from all sources`);
    console.log(`${green("•")} ${bold(white("/path/to/dir"))} - Use local directory (automatically sets --no-save)`);
  }

  static listAllTags(): void {
    this.fetchers.forEach((fetcher) => {
      fetcher.listAllTags();
      console.log(); // Add spacing between sources
    });
  }
}

// Loading animation class
class LoadingAnimation {
  private static isRunning = false;
  private static intervalId: number | null = null;
  private static frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private static currentFrame = 0;

  static start(message = "Loading..."): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.currentFrame = 0;

    // Hide cursor
    Deno.stdout.writeSync(new TextEncoder().encode("\x1b[?25l"));

    this.intervalId = setInterval(() => {
      const terminalWidth = TerminalUtils.getTerminalWidth();
      const spinner = brightCyan(this.frames[this.currentFrame]);
      const text = `${spinner} ${white(message)}`;
      const padding = Math.max(0, Math.floor((terminalWidth - message.length - 2) / 2));
      const centeredText = " ".repeat(padding) + text;

      // Clear current line and write centered loading text
      Deno.stdout.writeSync(new TextEncoder().encode(`\r\x1b[K${centeredText}`));

      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 80);
  }

  static stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Clear the current line thoroughly and show cursor
    // \r moves to beginning of line, \x1b[K clears from cursor to end of line
    // \x1b[2K clears the entire line, \x1b[?25h shows cursor
    Deno.stdout.writeSync(new TextEncoder().encode("\r\x1b[2K\x1b[?25h"));
  }

  static updateMessage(_message: string): void {
    if (!this.isRunning) return;

    // The interval will pick up the new message on next update
    // For immediate update, we could store the message in a class property
  }
}

// Image processor and display manager
class ImageProcessor {
  static async downloadImage(
    url: string,
    timeout: number,
  ): Promise<Uint8Array> {
    // Handle local file URLs
    if (url.startsWith('file://')) {
      const filePath = url.replace('file://', '');
      try {
        const buffer = await Deno.readFile(filePath);
        Logger.info(
          `Read local file: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`,
        );
        return buffer;
      } catch (error) {
        throw new Error(`Failed to read local file: ${(error as Error).message}`);
      }
    }

    // Handle remote URLs
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }

      const buffer = new Uint8Array(await response.arrayBuffer());
      Logger.info(
        `Downloaded image: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`,
      );
      return buffer;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static async displayImage(buffer: Uint8Array, config: Config): Promise<void> {
    const tmpFile = await Deno.makeTempFile({
      suffix: ".jpg",
      prefix: "slide-",
    });

    try {
      await Deno.writeFile(tmpFile, buffer);

      // Check jp2a version to determine if -c flag is supported
      const jp2aVersion = await DependencyChecker.getJp2aVersion();
      const supportsCenterFlag = jp2aVersion && DependencyChecker.compareVersions(jp2aVersion, "1.3.2") >= 0;

      const args = ["-b"]; // Always include -b (inverted)

      // Only add -c flag if supported (for centering)
      if (supportsCenterFlag) {
        args.push("-c");
      }

      if (config.colors) {
        args.push("--colors");
      }

      // Always reserve space for progress bar and controls header, then size image to fit
      const terminalSize = TerminalUtils.getTerminalSize();
      const reservedLines = 3; // Controls header + progress bar + padding
      const availableHeight = Math.max(10, terminalSize.rows - reservedLines);
      const availableWidth = Math.max(40, terminalSize.columns - 4); // Reserve 2 chars padding on each side

      // Calculate aspect ratios to determine the best fit strategy
      const terminalAspectRatio = availableWidth / availableHeight;

      // Use a threshold to determine if we should constrain by width or height
      // For most terminals, width is typically 2-3x the height in character terms
      // If terminal is very wide (landscape-like), constrain by height to avoid tiny images
      // If terminal is tall/square, constrain by width to fit properly
      if (terminalAspectRatio > 2.5) {
        // Wide terminal: constrain by height, let width adjust proportionally
        args.push("--height=" + availableHeight);
      } else {
        // Tall/square terminal: constrain by width, let height adjust proportionally
        args.push("--width=" + availableWidth);
      }

      if (config.fill) {
        // jp2a --fill flag: fills background of ASCII art with ANSI color
        args.push("--fill");
      }

      args.push(tmpFile);

      Logger.debug(`jp2a command: jp2a ${args.join(" ")}`);

      try {
        if (supportsCenterFlag) {
          // Let jp2a handle everything (centering, sizing) and output directly to terminal
          const jp2a = new Deno.Command("jp2a", {
            args: args,
            stdout: "inherit", // Direct output to terminal for best sizing
            stderr: "piped",
          });

          const output = await jp2a.output();

          if (output.code !== 0) {
            const errorText = new TextDecoder().decode(output.stderr);
            throw new Error(`jp2a failed with exit code ${output.code}: ${errorText}`);
          }
        } else {
          // For older jp2a versions, capture output and center manually
          const jp2a = new Deno.Command("jp2a", {
            args: args,
            stdout: "piped",
            stderr: "piped",
          });

          const output = await jp2a.output();

          if (output.code !== 0) {
            const errorText = new TextDecoder().decode(output.stderr);
            throw new Error(`jp2a failed with exit code ${output.code}: ${errorText}`);
          }

          // Get the ASCII output and center it manually
          const asciiOutput = new TextDecoder().decode(output.stdout);
          this.centerAndDisplayAscii(asciiOutput);
        }
      } catch (error) {
        // Graceful error handling for jp2a failures
        this.displayErrorMessage(error as Error, config);
        throw error; // Re-throw to let caller handle continuation
      }
    } finally {
      try {
        await Deno.remove(tmpFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private static displayErrorMessage(error: Error, _config: Config): void {
    const terminalSize = TerminalUtils.getTerminalSize();
    const terminalWidth = terminalSize.columns;

    // Clear screen but keep the header
    console.clear();
    console.log(brightCyan("🎮 TTY Slide - Keyboard Controls:"));
    console.log(`${green("SPACE")} - Pause/Resume | ${green("N/→")} - Skip | ${green("S")} - Save | ${green("Q")} - Quit\n`);

    // Create error display
    const errorLines = [
      "❌ Failed to convert image to ASCII art",
      "",
      "Possible causes:",
      "• Corrupted or unsupported image format",
      "• jp2a encountered an internal error",
      "• Insufficient system resources",
      "",
      "The slideshow will continue with the next image...",
      "",
      `Error details: ${error.message}`,
    ];

    // Center the error message
    const maxLineLength = Math.max(...errorLines.map(line => line.length));
    const padding = Math.max(0, Math.floor((terminalWidth - maxLineLength) / 2));

    // Add some vertical padding
    console.log("\n".repeat(Math.floor(terminalSize.rows / 4)));

    errorLines.forEach(line => {
      if (line === "") {
        console.log();
        return;
      }

      let coloredLine = line;
      if (line.startsWith("❌")) {
        coloredLine = red(line);
      } else if (line.startsWith("•")) {
        coloredLine = yellow(line);
      } else if (line.startsWith("The slideshow")) {
        coloredLine = green(line);
      } else if (line.startsWith("Error details:")) {
        coloredLine = dim(line);
      } else if (line === "Possible causes:") {
        coloredLine = brightYellow(line);
      }

      const centeredLine = " ".repeat(padding) + coloredLine;
      console.log(centeredLine);
    });
  }

  private static centerAndDisplayAscii(asciiOutput: string): void {
    const lines = asciiOutput.split('\n');
    const terminalWidth = TerminalUtils.getTerminalWidth();

    lines.forEach(line => {
      if (line.trim().length === 0) {
        console.log(); // Preserve empty lines
        return;
      }

      // Calculate padding to center the line
      const padding = Math.max(0, Math.floor((terminalWidth - line.length) / 2));
      const centeredLine = ' '.repeat(padding) + line;
      console.log(centeredLine);
    });
  }

  static async saveImage(
    buffer: Uint8Array,
    slideImage: SlideImage,
    outputDir: string,
  ): Promise<void> {
    // Clean filename and remove URL parameters
    let fileName = "";
    let subDir = "";

    if (slideImage.source === "pexels") {
      // Extract clean filename from Pexels URL and remove query parameters
      const urlParts = slideImage.url.split("/");
      const rawFileName = urlParts[urlParts.length - 1] || `pexels-${Date.now()}.jpg`;
      // Remove everything after ? to clean URL parameters
      fileName = rawFileName.split("?")[0];
      // Ensure it has an extension
      if (!fileName.includes(".")) {
        fileName += ".jpg";
      }
      subDir = "pexels";
    } else if (slideImage.source === "waifu") {
      // Extract filename from Waifu URL
      const urlParts = slideImage.url.split("/");
      fileName = urlParts[urlParts.length - 1] || `waifu-${Date.now()}.jpg`;
      // Remove query parameters if any
      fileName = fileName.split("?")[0];
      // Ensure it has an extension
      if (!fileName.includes(".")) {
        fileName += ".jpg";
      }
      // Determine NSFW or SFW subdirectory
      const isNsfw = slideImage.isNsfw || slideImage.tags?.some(tag =>
        ["ass", "hentai", "milf", "oral", "paizuri", "ecchi", "ero"].includes(tag.toLowerCase())
      ) || false;
      subDir = `waifus/${isNsfw ? "NSFW" : "SFW"}`;
    } else {
      // Default handling for other sources
      const urlParts = slideImage.url.split("/");
      fileName = urlParts[urlParts.length - 1] || `slide-${Date.now()}.jpg`;
      fileName = fileName.split("?")[0]; // Remove query parameters
      if (!fileName.includes(".")) {
        fileName += ".jpg";
      }
      subDir = slideImage.source;
    }

    // Create the full directory path
    const fullDir = subDir ? `${outputDir}/${subDir}` : outputDir;
    const savePath = `${fullDir}/${fileName}`;

    try {
      // Create directory if it doesn't exist
      await Deno.mkdir(fullDir, { recursive: true });

      // Check if file already exists
      await Deno.stat(savePath);
      Logger.debug(`Image already exists: ${savePath}`);
    } catch {
      // File doesn't exist, save it
      await Deno.writeFile(savePath, buffer);
      Logger.success(`Saved image: ${savePath}`);
    }
  }
}

// Utility classes for UI components
class TerminalUtils {
  static getTerminalWidth(): number {
    try {
      return Deno.consoleSize().columns;
    } catch {
      return 80; // fallback width
    }
  }

  static getTerminalSize(): { rows: number; columns: number } {
    try {
      return Deno.consoleSize();
    } catch {
      return { rows: 24, columns: 80 }; // fallback size
    }
  }

  static wrapText(text: string, width: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + " " + word).length <= width) {
        currentLine = currentLine ? currentLine + " " + word : word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  static displayCaption(slideImage: SlideImage): void {
    const terminalWidth = this.getTerminalWidth();
    const separator = "=".repeat(terminalWidth);

    console.log("\n" + brightCyan(separator));

    // Source and artist line
    let sourceInfo = `📷 Source: ${bold(white(slideImage.source.toUpperCase()))}`;
    if (slideImage.artist) {
      sourceInfo += ` | 🎨 ${bold(white(slideImage.artist))}`;
    }
    console.log(sourceInfo);

    // Caption or description
    if (slideImage.caption) {
      console.log(yellow(slideImage.caption));
    }

    if (slideImage.description) {
      const descLines = this.wrapText(`📝 ${slideImage.description}`, terminalWidth);
      descLines.forEach((line) => console.log(green(line)));
    }

    // Tags if available
    if (slideImage.tags && slideImage.tags.length > 0) {
      const tagText = slideImage.tags.join(" • ");
      const tagLines = this.wrapText(`🏷️  ${tagText}`, terminalWidth);
      tagLines.forEach((line) => console.log(brightCyan(line)));
    }

    console.log(brightCyan(separator) + "\n");
  }
}

// Keyboard input handling
class KeyboardHandler {
  private listeners: Map<string, () => void> = new Map();
  private isListening = false;

  constructor() {
    this.setupRawMode();
  }

  private setupRawMode(): void {
    try {
      // Enable raw mode to capture individual key presses
      Deno.stdin.setRaw(true, { cbreak: true });
      this.isListening = true;
      this.startListening();
    } catch {
      Logger.warn("Failed to enable raw mode for keyboard input");
    }
  }

  private async startListening(): Promise<void> {
    const buffer = new Uint8Array(3);
    while (this.isListening) {
      try {
        const nread = await Deno.stdin.read(buffer);
        if (nread === null) break;

        const key = this.parseKeyPress(buffer.slice(0, nread));
        if (key && this.listeners.has(key)) {
          this.listeners.get(key)!();
        }
      } catch {
        // Handle read errors gracefully
        break;
      }
    }
  }

  private parseKeyPress(buffer: Uint8Array): string | null {
    if (buffer.length === 0) return null;

    // Handle single character keys
    if (buffer.length === 1) {
      const char = String.fromCharCode(buffer[0]);

      // Handle special cases
      switch (buffer[0]) {
        case 27: return 'escape';
        case 32: return 'space';
        case 13: return 'enter';
        case 127: return 'backspace';
        case 3: return 'ctrl+c';
        default:
          if (buffer[0] >= 32 && buffer[0] <= 126) {
            return char.toLowerCase();
          }
          return null;
      }
    }

    // Handle escape sequences (arrow keys, etc.)
    if (buffer.length >= 3 && buffer[0] === 27 && buffer[1] === 91) {
      switch (buffer[2]) {
        case 65: return 'arrow-up';
        case 66: return 'arrow-down';
        case 67: return 'arrow-right';
        case 68: return 'arrow-left';
        default: return null;
      }
    }

    return null;
  }

  on(key: string, callback: () => void): void {
    this.listeners.set(key, callback);
  }

  off(key: string): void {
    this.listeners.delete(key);
  }

  destroy(): void {
    this.isListening = false;
    try {
      Deno.stdin.setRaw(false);
    } catch {
      // Ignore errors when disabling raw mode
    }
  }
}

// Main application class
class TTYSlide {
  private config: Config;
  private isRunning = true;
  private isPaused = false;
  private skipRequested = false;
  private saveRequested = false;
  private currentSlideImage: SlideImage | null = null;
  private currentImageBuffer: Uint8Array | null = null;
  private keyboardHandler: KeyboardHandler;

  constructor(config: Config) {
    this.config = config;
    this.keyboardHandler = new KeyboardHandler();
    this.setupSignalHandlers();
    this.setupKeyboardHandlers();
  }

  private setupSignalHandlers(): void {
    Deno.addSignalListener("SIGINT", () => {
      Logger.info("Received SIGINT, shutting down gracefully...");
      this.cleanup();
      Deno.exit(0);
    });
  }

  private setupKeyboardHandlers(): void {
    // Space key: Pause/Resume
    this.keyboardHandler.on('space', () => {
      this.isPaused = !this.isPaused;
      // No console.log here - state change will be reflected in progress bar
    });

    // N key or Right arrow: Skip to next slide
    this.keyboardHandler.on('n', () => {
      this.skipRequested = true;
      // No console.log here - skip will happen immediately
    });

    this.keyboardHandler.on('arrow-right', () => {
      this.skipRequested = true;
      // No console.log here - skip will happen immediately
    });

    // S key: Save current slide (even in --no-save mode)
    this.keyboardHandler.on('s', () => {
      this.saveRequested = true;
      // No console.log here - save will happen at end of slide cycle
    });

    // Q key: Quit
    this.keyboardHandler.on('q', () => {
      this.cleanup();
      Deno.exit(0);
    });

    // Ctrl+C: Also quit (backup)
    this.keyboardHandler.on('ctrl+c', () => {
      this.cleanup();
      Deno.exit(0);
    });
  }

  private cleanup(): void {
    this.isRunning = false;
    LoadingAnimation.stop(); // Ensure loading animation is stopped
    this.keyboardHandler.destroy();
    // Clear terminal on exit
    console.clear();
  }

  async run(): Promise<void> {
    Logger.info("Starting TTY Slide...");
    Logger.info(`Configuration: ${JSON.stringify(this.config, null, 2)}`);

    // Clear screen and show keyboard controls
    console.clear();
    console.log(brightCyan("🎮 TTY Slide - Keyboard Controls:"));
    console.log(`${green("SPACE")} - Pause/Resume | ${green("N/→")} - Skip | ${green("S")} - Save | ${green("Q")} - Quit\n`);

    // Ensure output directory exists
    try {
      await Deno.mkdir(this.config.outputDir, { recursive: true });
    } catch (error) {
      Logger.error(
        `Failed to create output directory: ${this.config.outputDir}`,
        error as Error,
      );
      return;
    }

    while (this.isRunning) {
      try {
        // Reset control flags
        this.skipRequested = false;
        this.saveRequested = false;

        // Start loading animation
        LoadingAnimation.start("Fetching image...");

        let fetcher: ImageFetcher | null;

        if (this.config.source === "random") {
          fetcher = FetcherRegistry.getRandomFetcher();
          Logger.info(`Randomly selected source: ${fetcher.getSource()}`);
        } else {
          fetcher = FetcherRegistry.getFetcher(this.config.source);
        }

        if (!fetcher) {
          LoadingAnimation.stop();
          Logger.error(`Unknown source: ${this.config.source}`);
          await this.sleep(5000);
          continue;
        }

        const slideImage = await fetcher.fetchRandomImage(this.config);

        if (!slideImage) {
          LoadingAnimation.stop();
          Logger.warn("Failed to fetch image, retrying in 5 seconds...");
          await this.sleep(5000);
          continue;
        }

        // Check if skip was requested during fetch
        if (this.skipRequested) {
          LoadingAnimation.stop();
          continue;
        }

        // Update loading message for download phase
        LoadingAnimation.start("Downloading image...");

        const imageBuffer = await ImageProcessor.downloadImage(
          slideImage.url,
          this.config.timeout,
        );

        // Check if skip was requested during download
        if (this.skipRequested) {
          LoadingAnimation.stop();
          continue;
        }

        // Update loading message for processing phase
        LoadingAnimation.start("Converting to ASCII art...");

        // Store current slide for save functionality
        this.currentSlideImage = slideImage;
        this.currentImageBuffer = imageBuffer;

        try {
          // Stop loading animation and clear screen before displaying image
          LoadingAnimation.stop();
          console.clear();
          console.log(brightCyan("🎮 TTY Slide - Keyboard Controls:"));
          console.log(`${green("SPACE")} - Pause/Resume | ${green("N/→")} - Skip | ${green("S")} - Save | ${green("Q")} - Quit\n`);

          await ImageProcessor.displayImage(imageBuffer, this.config);
        } catch (error) {
          LoadingAnimation.stop(); // Stop loading animation on error

          // Check if this is a jp2a error we should handle gracefully
          if (error instanceof Error && error.message.includes("jp2a failed")) {
            Logger.warn(`Image conversion failed: ${error.message}`);
            // Wait a moment to let user see the error message
            await this.sleep(3000);
            continue; // Skip to next image
          } else {
            // Re-throw other types of errors
            throw error;
          }
        }

        if (this.config.caption) {
          TerminalUtils.displayCaption(slideImage);
        }

        if (!this.config.noSave) {
          await ImageProcessor.saveImage(
            imageBuffer,
            slideImage,
            this.config.outputDir,
          );
        }

        if (this.isRunning) {
          await this.handleProgressBarWithControls();
        }

        // Handle save request if triggered during this slide
        if (this.saveRequested && this.currentSlideImage && this.currentImageBuffer) {
          try {
            await ImageProcessor.saveImage(
              this.currentImageBuffer,
              this.currentSlideImage,
              this.config.outputDir,
            );
            // Save success - no console.log to avoid shifting image
          } catch {
            // Save failed - no console.log to avoid shifting image
          }
        }

        // Clear screen for next image (if not paused or skipped)
        if (this.isRunning && !this.isPaused) {
          console.clear();
          console.log(brightCyan("🎮 TTY Slide - Keyboard Controls:"));
          console.log(`${green("SPACE")} - Pause/Resume | ${green("N/→")} - Skip | ${green("S")} - Save | ${green("Q")} - Quit\n`);
        }

      } catch (error) {
        LoadingAnimation.stop(); // Ensure loading animation is stopped on any error
        Logger.error("Unexpected error in main loop", error as Error);
        await this.sleep(5000);
      }
    }

    Logger.info("TTY Slide shut down complete");
    this.cleanup();
  }

  private async sleep(ms: number): Promise<void> {
    let remaining = ms;
    while (remaining > 0 && this.isRunning) {
      const sleepTime = Math.min(remaining, 1000);
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
      remaining -= sleepTime;
    }
  }

  private async handleProgressBarWithControls(): Promise<void> {
    const terminalWidth = TerminalUtils.getTerminalWidth();
    const barWidth = Math.min(60, Math.floor(terminalWidth * 0.6));
    const updateInterval = 100; // Update every 100ms
    const totalUpdates = (this.config.intervalSeconds * 1000) / updateInterval;

    // Move cursor to a new line before starting progress bar
    console.log();

    let currentUpdate = 0;

    while (currentUpdate <= totalUpdates && this.isRunning && !this.skipRequested) {
      const encoder = new TextEncoder();
      const progress = currentUpdate / totalUpdates;
      const filledWidth = Math.floor(progress * (barWidth - 4)); // Reserve 4 chars for play/pause indicator
      const emptyWidth = (barWidth - 4) - filledWidth;

      // Check if paused and create appropriate state indicator
      let stateIndicator: string;
      if (this.isPaused) {
        // ASCII pause symbol: two vertical bars "||"
        stateIndicator = yellow("⏸");
      } else {
        // ASCII play symbol: triangle ">"
        stateIndicator = green("▶");
      }

      // Build progress bar
      let bar = "";
      for (let j = 0; j < filledWidth; j++) {
        bar += bgBrightWhite("█");
      }
      bar += "░".repeat(emptyWidth);

      // Combine state indicator with progress bar
      const fullBar = stateIndicator + " " + bar;

      // Calculate fixed padding to center the bar
      const totalBarLength = 3 + barWidth - 4; // 3 chars for indicator + space, plus actual bar width
      const padding = Math.max(0, Math.floor((terminalWidth - totalBarLength) / 2));
      const centeredBar = " ".repeat(padding) + fullBar;

      // Write the progress bar (always overwrite the same line)
      await Deno.stdout.write(encoder.encode(`\r${centeredBar}`));

      // If paused, wait without incrementing progress
      if (this.isPaused) {
        while (this.isPaused && this.isRunning && !this.skipRequested) {
          await new Promise((resolve) => setTimeout(resolve, updateInterval));
        }
      } else {
        currentUpdate++;
        if (currentUpdate <= totalUpdates) {
          await new Promise((resolve) => setTimeout(resolve, updateInterval));
        }
      }

      // Break if skip requested or not running
      if (this.skipRequested || !this.isRunning) {
        break;
      }
    }

    console.log(); // Move to new line after progress bar completes
  }
}

// Help message and argument parsing
function getColoredHelpMessage(): string {
  return `
${bold(brightCyan("TTY Slide"))} ${white("-")} ${
    green("Terminal Multi-Source Slideshow Viewer")
  }

${
    yellow(
      "A terminal-based slideshow that fetches images from multiple APIs",
    )
  }
${yellow("(Waifu API, Pexels API, etc.) and displays them using jp2a.")}

${bold(brightCyan("Usage:"))}

${bold("Method 1 (Recommended):")}
${white("deno run --allow-net --allow-read --allow-write --allow-run --allow-env")} ${
    bold("tty-slide.ts")
  } ${green("[options]")}

${bold("Method 2 (With deno.json configuration):")}
${white("chmod +x tty-slide.ts && ./")}${bold("tty-slide.ts")} ${green("[options]")}

${bold("Method 3 (Using deno task, if configured):")}
${white("deno task tty-slide")} ${green("[options]")}

${bold(brightCyan("Keyboard Controls:"))}
  ${green("SPACE")}              ${white("Pause/Resume slideshow")}
  ${green("N / →")}               ${white("Skip to next slide immediately")}
  ${green("S")}                  ${white("Save current slide (works even with --no-save)")}
  ${green("Q")}                  ${white("Quit slideshow")}
  ${green("Ctrl+C")}             ${white("Force quit")}

${bold(brightCyan("Options:"))}
  ${green("--source=SOURCE")}    ${
    white("Image source: waifu, pexels, random, or /path/to/directory")
  } ${brightRed("(default: random)")}
  ${green("--nsfw")}             ${white("Include NSFW tags (waifu only)")} ${
    brightRed("(default: false)")
  }
  ${green("--interval=N")}       ${
    white("Set interval between images in seconds")
  } ${brightRed("(default: 10)")}
  ${green("--dir=DIR")}          ${
    white("Set output directory for saved images")
  } ${brightRed("(default: ~/Pictures/TTY-Slides or ./slides)")}
  ${green("--no-save")}          ${white("Do not save images to disk")}
  ${green("--tags=TAG1,TAG2")}   ${
    white("Search tags (waifu) or query terms (pexels)")
  }
  ${green("--colors")}           ${white("Display image in color")} ${
    yellow("(requires jp2a)")
  }
  ${green("--fill")}             ${white("Fill ASCII art background with ANSI color")} ${
    yellow("(requires jp2a)")
  }
  ${green("--caption")}          ${
    white("Display image caption with source and artist info")
  }
  ${green("--list-sources")}     ${white("Show all available sources and exit")}
  ${green("--list-tags")}        ${white("Show all available tags and exit")}
  ${green("--help")}             ${white("Show this help message")}

${bold(brightCyan("Examples:"))}
  ${
    white(
      "deno run --allow-net --allow-read --allow-write --allow-run --allow-env tty-slide.ts",
    )
  } ${green("--colors --caption")}
  ${
    white(
      "deno run --allow-net --allow-read --allow-write --allow-run --allow-env tty-slide.ts",
    )
  } ${green("--source=pexels --tags=nature,landscape")}
  ${
    white(
      "deno run --allow-net --allow-read --allow-write --allow-run --allow-env tty-slide.ts",
    )
  } ${green("--source=waifu --nsfw --interval=5")}
  ${
    white(
      "deno run --allow-net --allow-read --allow-write --allow-run --allow-env tty-slide.ts",
    )
  } ${green("--source=random --caption --fill")}
  ${
    white(
      "deno run --allow-net --allow-read --allow-write --allow-run --allow-env tty-slide.ts",
    )
  } ${green("--source=./my-photos --colors --caption --interval=3")}

${bold(brightCyan("Environment Variables:"))}
  ${green("PEXELS_API_KEY")}     ${white("Your Pexels API key")} ${
    yellow("(required for Pexels source)")
  }
  ${green("DEBUG=true")}         ${white("Enable all logging output")} ${
    yellow("(INFO, SUCCESS, WARN, ERROR, DEBUG)")
  }
                     ${
    brightRed("Without DEBUG=true, only the progress bar and caption are shown")
  }

${bold(brightCyan("API Keys:"))}
${yellow("Create a")} ${white(".env")} ${yellow("file in the same directory with:")}
  ${green("PEXELS_API_KEY")}${white("=your_pexels_api_key_here")}

${yellow("Get your free Pexels API key at:")} ${
    brightCyan("https://www.pexels.com/api/")
  }
`;
}

// Main execution function
async function main(): Promise<void> {
  try {
    // Show help if requested
    if (Deno.args.includes("--help") || Deno.args.includes("-h")) {
      console.log(getColoredHelpMessage());
      Deno.exit(0);
    }

    // List sources if requested
    if (Deno.args.includes("--list-sources")) {
      FetcherRegistry.listAllSources();
      Deno.exit(0);
    }

    // List tags if requested
    if (Deno.args.includes("--list-tags")) {
      FetcherRegistry.listAllTags();
      Deno.exit(0);
    }

    // Check dependencies
    await DependencyChecker.checkAllDependencies();

    // Parse configuration
    const config = await ConfigManager.parseArgs();

    // Start the application
    const app = new TTYSlide(config);
    await app.run();
  } catch (error) {
    Logger.error("Fatal error during startup", error as Error);
    Deno.exit(1);
  }
}

// Run the application
if (import.meta.main) {
  await main();
}
