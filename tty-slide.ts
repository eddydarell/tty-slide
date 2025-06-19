#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-run --allow-env

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
 * deno run --allow-net --allow-read --allow-write --allow-run --allow-env tty-slide.ts --colors
 *
 * # Or simply:
 * chmod +x tty-slide.ts
 * ./tty-slide.ts --source=pexels --tags=nature,landscape --interval=5 --colors --fill
 * ```
 *
 * @author Eddy Ntambwe <eddydarell@gmail.com>
 * @license MIT
 * @version 1.0.0
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

    Logger.success("All dependencies satisfied");
  }
}

// Configuration management
class ConfigManager {
  private static readonly DEFAULT_CONFIG: Config = {
    source: "random",
    includeNsfw: false,
    intervalSeconds: 10,
    outputDir: "./slides",
    colors: false,
    fill: false,
    caption: false,
    maxRetries: 3,
    timeout: 30000,
  };

  static parseArgs(): Config {
    const config = { ...this.DEFAULT_CONFIG };

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

      const args = ["-c", "-b"];

      if (config.colors) {
        args.push("--colors");
      }

      if (config.fill) {
        args.push("--fill");
      }

      args.push(tmpFile);

      Logger.debug(`jp2a command: jp2a ${args.join(" ")}`);

      const jp2a = new Deno.Command("jp2a", {
        args: args,
        stdout: "inherit",
        stderr: "piped",
      });

      const output = await jp2a.output();

      if (output.code !== 0) {
        const errorText = new TextDecoder().decode(output.stderr);
        throw new Error(`jp2a failed: ${errorText}`);
      }
    } finally {
      try {
        await Deno.remove(tmpFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  static async saveImage(
    buffer: Uint8Array,
    slideImage: SlideImage,
    outputDir: string,
  ): Promise<void> {
    const urlParts = slideImage.url.split("/");
    const fileName = urlParts[urlParts.length - 1] || `slide-${Date.now()}.jpg`;
    const savePath = `${outputDir}/${slideImage.source}-${fileName}`;

    try {
      await Deno.stat(savePath);
      Logger.debug(`Image already exists: ${savePath}`);
    } catch {
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

  static async displayProgressBar(
    totalSeconds: number,
    _message: string,
  ): Promise<void> {
    const terminalWidth = this.getTerminalWidth();
    const barWidth = Math.min(60, Math.floor(terminalWidth * 0.6));
    const updateInterval = 10; // ms
    const totalUpdates = (totalSeconds * 1000) / updateInterval;

    for (let i = 0; i <= totalUpdates; i++) {
      const progress = i / totalUpdates;
      const filledWidth = Math.floor(progress * barWidth);
      const emptyWidth = barWidth - filledWidth;

      let bar = "";
      for (let j = 0; j < filledWidth; j++) {
        bar += bgBrightWhite("█");
      }

      bar += "░".repeat(emptyWidth);

      const padding = Math.floor((terminalWidth - barWidth) / 2);
      const centeredBar = " ".repeat(padding) + bar;

      const encoder = new TextEncoder();
      await Deno.stdout.write(encoder.encode(`\r${centeredBar}`));

      if (i < totalUpdates) {
        await new Promise((resolve) => setTimeout(resolve, updateInterval));
      }
    }

    console.log();
  }
}

// Main application class
class TTYSlide {
  private config: Config;
  private isRunning = true;

  constructor(config: Config) {
    this.config = config;
    this.setupSignalHandlers();
  }

  private setupSignalHandlers(): void {
    Deno.addSignalListener("SIGINT", () => {
      Logger.info("Received SIGINT, shutting down gracefully...");
      Deno.exit(0);
    });
  }

  async run(): Promise<void> {
    Logger.info("Starting TTY Slide...");
    Logger.info(`Configuration: ${JSON.stringify(this.config, null, 2)}`);

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
        let fetcher: ImageFetcher | null;

        if (this.config.source === "random") {
          fetcher = FetcherRegistry.getRandomFetcher();
          Logger.info(`Randomly selected source: ${fetcher.getSource()}`);
        } else {
          fetcher = FetcherRegistry.getFetcher(this.config.source);
        }

        if (!fetcher) {
          Logger.error(`Unknown source: ${this.config.source}`);
          await this.sleep(5000);
          continue;
        }

        const slideImage = await fetcher.fetchRandomImage(this.config);

        if (!slideImage) {
          Logger.warn("Failed to fetch image, retrying in 5 seconds...");
          await this.sleep(5000);
          continue;
        }

        const imageBuffer = await ImageProcessor.downloadImage(
          slideImage.url,
          this.config.timeout,
        );

        await ImageProcessor.displayImage(imageBuffer, this.config);

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
          await TerminalUtils.displayProgressBar(
            this.config.intervalSeconds,
            "Next image in",
          );
        }
      } catch (error) {
        Logger.error("Unexpected error in main loop", error as Error);
        await this.sleep(5000);
      }
    }

    Logger.info("TTY Slide shut down complete");
  }

  private async sleep(ms: number): Promise<void> {
    let remaining = ms;
    while (remaining > 0 && this.isRunning) {
      const sleepTime = Math.min(remaining, 1000);
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
      remaining -= sleepTime;
    }
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

${white("deno run --allow-net --allow-read --allow-write --allow-run --allow-env")} ${
    bold("tty-slide.ts")
  } ${green("[options]")}

${bold("OR")}

${white("chmod +x tty-slide.ts")}
${white("./")}${bold("tty-slide.ts")} ${green("[options]")}

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
  } ${brightRed("(default: ./slides)")}
  ${green("--no-save")}          ${white("Do not save images to disk")}
  ${green("--tags=TAG1,TAG2")}   ${
    white("Search tags (waifu) or query terms (pexels)")
  }
  ${green("--colors")}           ${white("Display image in color")} ${
    yellow("(requires jp2a)")
  }
  ${green("--fill")}             ${white("Fill the terminal with the image")} ${
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
    const config = ConfigManager.parseArgs();

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
