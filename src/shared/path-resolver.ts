import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

export type DirectoryCategory = 'data' | 'logs' | 'exports' | 'backups' | 'bundles' | 'temp';

export interface PlatformDiagnostics {
  platform: string;
  architecture: string;
  nodeVersion: string;
  projectRoot: string;
  isDocker: boolean;
  isProduction: boolean;
  directories: Record<DirectoryCategory, string>;
}

/**
 * Dynamic Platform-Agnostic Directory Resolver (PADR)
 * 
 * Provides unified, environment-aware, and secure directory management across
 * Windows 10 IoT, Ubuntu/Debian, Alpine Docker containers, and macOS.
 * 
 * Features:
 * 1. Project Root Anchoring via ESM import.meta.url (independent of process.cwd()).
 * 2. Multi-tier resolution hierarchy (Env Vars -> Docker -> Production OS -> Dev/Test).
 * 3. Automatic directory recursive provisioning (ensureDirSync).
 * 4. Path Traversal Shield (resolveSafePath).
 * 5. Seamless legacy file migration from root to data/.
 */
export class PathResolver {
  private static instance: PathResolver;
  private projectRoot: string;
  private isDockerEnvironment: boolean;
  private isProductionEnvironment: boolean;
  private directoryCache: Map<DirectoryCategory, string> = new Map();

  constructor() {
    this.projectRoot = this.detectProjectRoot();
    this.isDockerEnvironment = this.detectDocker();
    this.isProductionEnvironment = process.env.NODE_ENV === 'production';
    this.ensureAllDirectories();
  }

  public static getInstance(): PathResolver {
    if (!PathResolver.instance) {
      PathResolver.instance = new PathResolver();
    }
    return PathResolver.instance;
  }

  /**
   * Reset instance (useful for unit tests manipulating env vars)
   */
  public static resetInstance(): void {
    PathResolver.instance = new PathResolver();
  }

  /**
   * Detects the project root by traversing upwards from the current ESM module
   * until a package.json is found. Falls back to process.cwd() if not found.
   */
  private detectProjectRoot(): string {
    try {
      let currentDir = path.dirname(fileURLToPath(import.meta.url));
      while (currentDir !== path.dirname(currentDir)) {
        const pkgPath = path.join(currentDir, 'package.json');
        if (fs.existsSync(pkgPath)) {
          return currentDir;
        }
        currentDir = path.dirname(currentDir);
      }
    } catch {
      // Fallback in edge runtimes or bundles
    }
    return process.cwd();
  }

  /**
   * Detects whether the process is executing inside a Docker container
   */
  private detectDocker(): boolean {
    if (fs.existsSync('/.dockerenv')) {
      return true;
    }
    try {
      if (fs.existsSync('/proc/1/cgroup')) {
        const content = fs.readFileSync('/proc/1/cgroup', 'utf8');
        if (content.includes('docker') || content.includes('kubepods') || content.includes('containerd')) {
          return true;
        }
      }
    } catch {
      // Non-Linux systems will fail silently
    }
    return false;
  }

  /**
   * Resolves the canonical directory for a given category
   */
  public getDirectory(category: DirectoryCategory): string {
    const cached = this.directoryCache.get(category);
    if (cached) {
      return cached;
    }

    let dir: string;

    // Tier 1: Explicit Environment Variable
    const envVarName = `RMS_${category.toUpperCase()}_DIR`;
    if (process.env[envVarName]) {
      dir = path.resolve(process.env[envVarName]!);
    }
    // Tier 2: Base Directory Environment Variable
    else if (process.env.RMS_BASE_DIR) {
      dir = path.resolve(process.env.RMS_BASE_DIR, category);
    }
    // Tier 3: Docker Container Mode (/app/data volume alignment)
    else if (this.isDockerEnvironment) {
      if (category === 'data') {
        dir = '/app/data';
      } else {
        dir = path.join('/app', category);
      }
    }
    // Tier 4: Production OS-Level Installation
    else if (this.isProductionEnvironment) {
      dir = this.getProductionOSDirectory(category);
    }
    // Tier 5: Development / Local Workspace Mode (Anchored to project root)
    else {
      dir = path.join(this.projectRoot, category);
    }

    // Normalize path for current OS
    dir = path.normalize(dir);

    // Auto-provision directory
    this.ensureDirectory(dir);

    this.directoryCache.set(category, dir);
    return dir;
  }

  /**
   * OS-specific production directories
   */
  private getProductionOSDirectory(category: DirectoryCategory): string {
    const platform = process.platform;

    if (platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
      return path.join(localAppData, 'EnterpriseRMS', category);
    }

    if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'EnterpriseRMS', category);
    }

    // Default Linux / POSIX system service
    // If running as root / daemon in /var/lib/enterprise-rms
    try {
      const systemPath = path.join('/var', 'lib', 'enterprise-rms', category);
      if (fs.existsSync(systemPath)) {
        return systemPath;
      }
    } catch {
      // Ignored
    }

    // Fallback to user home for unprivileged Linux execution
    return path.join(os.homedir(), '.enterprise-rms', category);
  }

  /**
   * Recursively ensures directory existence
   */
  public ensureDirectory(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    } catch (err: any) {
      // If permission fails, fall back to temporary directory
      console.warn(`[PADR] Warning: Unable to create directory "${dirPath}" (${err.message}). Falling back to temp.`);
      const fallback = path.join(os.tmpdir(), 'enterprise-rms', path.basename(dirPath));
      if (!fs.existsSync(fallback)) {
        fs.mkdirSync(fallback, { recursive: true });
      }
    }
  }

  /**
   * Provisions all standard directories
   */
  public ensureAllDirectories(): void {
    const categories: DirectoryCategory[] = ['data', 'logs', 'exports', 'backups', 'bundles', 'temp'];
    for (const cat of categories) {
      this.getDirectory(cat);
    }
  }

  /**
   * Resolves a file path inside the DATA directory
   */
  public resolveDataPath(...segments: string[]): string {
    return path.join(this.getDirectory('data'), ...segments);
  }

  /**
   * Resolves a file path inside the LOGS directory
   */
  public resolveLogPath(...segments: string[]): string {
    return path.join(this.getDirectory('logs'), ...segments);
  }

  /**
   * Resolves a file path inside the EXPORTS directory
   */
  public resolveExportPath(...segments: string[]): string {
    const exportDir = this.getDirectory('exports');
    const fullPath = path.join(exportDir, ...segments);
    // Ensure parent sub-directory exists (e.g. exports/netsuite or exports/adp)
    this.ensureDirectory(path.dirname(fullPath));
    return fullPath;
  }

  /**
   * Resolves a file path inside the BACKUPS directory
   */
  public resolveBackupPath(...segments: string[]): string {
    return path.join(this.getDirectory('backups'), ...segments);
  }

  /**
   * Resolves a file path inside the BUNDLES directory
   */
  public resolveBundlePath(...segments: string[]): string {
    return path.join(this.getDirectory('bundles'), ...segments);
  }

  /**
   * Resolves a file path inside the TEMP directory
   */
  public resolveTempPath(...segments: string[]): string {
    return path.join(this.getDirectory('temp'), ...segments);
  }

  /**
   * Path Traversal Shield: Resolves a safe path confined strictly within baseDir
   * Throws Error if path traversal is attempted (e.g. `../../etc/passwd` or `..\..\Windows`)
   */
  public resolveSafePath(baseDir: string, userInput: string): string {
    const normalizedBase = path.resolve(baseDir);
    // Remove null bytes and sanitize input
    const sanitizedInput = userInput.replace(/\0/g, '');
    const resolvedPath = path.resolve(normalizedBase, sanitizedInput);

    // Enforce boundary containment
    if (!resolvedPath.startsWith(normalizedBase + path.sep) && resolvedPath !== normalizedBase) {
      throw new Error(`Security Violation: Path traversal attempted outside boundary directory "${baseDir}". Input: "${userInput}"`);
    }

    return resolvedPath;
  }

  /**
   * Migrates legacy database files sitting in root/cwd to the designated data directory
   * Ensures zero data loss during upgrade.
   */
  public migrateRootDatabaseIfExists(legacyFilename: string, targetFilename: string): void {
    try {
      const targetPath = this.resolveDataPath(targetFilename);
      if (fs.existsSync(targetPath)) {
        // Target already exists in data directory, no migration needed
        return;
      }

      // Check root directory and process.cwd()
      const candidatePaths = [
        path.join(this.projectRoot, legacyFilename),
        path.resolve(process.cwd(), legacyFilename),
      ];

      for (const legacyPath of candidatePaths) {
        if (fs.existsSync(legacyPath) && legacyPath !== targetPath) {
          console.log(`[PADR] Migrating legacy database from "${legacyPath}" to "${targetPath}"...`);
          fs.copyFileSync(legacyPath, targetPath);
          console.log(`[PADR] Legacy database migrated successfully.`);
          break;
        }
      }
    } catch (err: any) {
      console.error(`[PADR] Error during legacy database migration: ${err.message}`);
    }
  }

  /**
   * Returns complete platform diagnostics for support bundles and audit logs
   */
  public getPlatformDiagnostics(): PlatformDiagnostics {
    return {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      projectRoot: this.projectRoot,
      isDocker: this.isDockerEnvironment,
      isProduction: this.isProductionEnvironment,
      directories: {
        data: this.getDirectory('data'),
        logs: this.getDirectory('logs'),
        exports: this.getDirectory('exports'),
        backups: this.getDirectory('backups'),
        bundles: this.getDirectory('bundles'),
        temp: this.getDirectory('temp'),
      },
    };
  }
}

// Convenience exported singleton helper functions
export const pathResolver = {
  getDirectory: (category: DirectoryCategory) => PathResolver.getInstance().getDirectory(category),
  resolveDataPath: (...segments: string[]) => PathResolver.getInstance().resolveDataPath(...segments),
  resolveLogPath: (...segments: string[]) => PathResolver.getInstance().resolveLogPath(...segments),
  resolveExportPath: (...segments: string[]) => PathResolver.getInstance().resolveExportPath(...segments),
  resolveBackupPath: (...segments: string[]) => PathResolver.getInstance().resolveBackupPath(...segments),
  resolveBundlePath: (...segments: string[]) => PathResolver.getInstance().resolveBundlePath(...segments),
  resolveTempPath: (...segments: string[]) => PathResolver.getInstance().resolveTempPath(...segments),
  resolveSafePath: (baseDir: string, userInput: string) => PathResolver.getInstance().resolveSafePath(baseDir, userInput),
  migrateRootDatabaseIfExists: (legacy: string, target: string) => PathResolver.getInstance().migrateRootDatabaseIfExists(legacy, target),
  getPlatformDiagnostics: () => PathResolver.getInstance().getPlatformDiagnostics(),
};

export const getDirectory = (category: DirectoryCategory) => PathResolver.getInstance().getDirectory(category);
export const resolveDataPath = (...segments: string[]) => PathResolver.getInstance().resolveDataPath(...segments);
export const resolveLogPath = (...segments: string[]) => PathResolver.getInstance().resolveLogPath(...segments);
export const resolveExportPath = (...segments: string[]) => PathResolver.getInstance().resolveExportPath(...segments);
export const resolveBackupPath = (...segments: string[]) => PathResolver.getInstance().resolveBackupPath(...segments);
export const resolveBundlePath = (...segments: string[]) => PathResolver.getInstance().resolveBundlePath(...segments);
export const resolveTempPath = (...segments: string[]) => PathResolver.getInstance().resolveTempPath(...segments);
export const resolveSafePath = (baseDir: string, userInput: string) => PathResolver.getInstance().resolveSafePath(baseDir, userInput);
export const migrateRootDatabaseIfExists = (legacy: string, target: string) => PathResolver.getInstance().migrateRootDatabaseIfExists(legacy, target);
