import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  PathResolver,
  getDirectory,
  resolveDataPath,
  resolveLogPath,
  resolveExportPath,
  resolveBackupPath,
  resolveBundlePath,
  resolveTempPath,
  resolveSafePath,
  migrateRootDatabaseIfExists,
} from '../src/shared/path-resolver.js';

describe('Dynamic Platform-Agnostic Directory Resolution (PADR)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset process.env and singleton before each test
    process.env = { ...originalEnv };
    PathResolver.resetInstance();
  });

  afterEach(() => {
    process.env = originalEnv;
    PathResolver.resetInstance();
  });

  describe('Standard Directory Resolution & Auto-Provisioning', () => {
    it('resolves all standard directory categories cleanly', () => {
      const categories = ['data', 'logs', 'exports', 'backups', 'bundles', 'temp'] as const;

      for (const cat of categories) {
        const dir = getDirectory(cat);
        expect(typeof dir).toBe('string');
        expect(dir.length).toBeGreaterThan(0);
        expect(fs.existsSync(dir)).toBe(true);
        expect(path.isAbsolute(dir)).toBe(true);
      }
    });

    it('resolves sub-paths accurately using helper functions', () => {
      const dbPath = resolveDataPath('test-store.db.json');
      expect(dbPath).toContain('data');
      expect(dbPath.endsWith('test-store.db.json')).toBe(true);

      const logPath = resolveLogPath('edge.log');
      expect(logPath).toContain('logs');
      expect(logPath.endsWith('edge.log')).toBe(true);

      const exportPath = resolveExportPath('netsuite', 'gl-export.csv');
      expect(exportPath).toContain('exports');
      expect(exportPath).toContain('netsuite');
      expect(exportPath.endsWith('gl-export.csv')).toBe(true);
      expect(fs.existsSync(path.dirname(exportPath))).toBe(true);

      const backupPath = resolveBackupPath('checkpoint-1.bak');
      expect(backupPath).toContain('backups');
      expect(backupPath.endsWith('checkpoint-1.bak')).toBe(true);

      const bundlePath = resolveBundlePath('bundle-store-104.json');
      expect(bundlePath).toContain('bundles');
      expect(bundlePath.endsWith('bundle-store-104.json')).toBe(true);

      const tempPath = resolveTempPath('spool-001.tmp');
      expect(tempPath).toContain('temp');
      expect(tempPath.endsWith('spool-001.tmp')).toBe(true);
    });
  });

  describe('Environment Variable Overrides (Tier 1 & Tier 2)', () => {
    it('honors RMS_DATA_DIR explicit environment variable override', () => {
      const customDataDir = path.join(os.tmpdir(), `custom-rms-data-${Date.now()}`);
      process.env.RMS_DATA_DIR = customDataDir;
      PathResolver.resetInstance();

      const resolved = resolveDataPath('orders.db.json');
      expect(resolved.startsWith(path.resolve(customDataDir))).toBe(true);
      expect(fs.existsSync(customDataDir)).toBe(true);

      // Clean up
      try { fs.rmdirSync(customDataDir); } catch {}
    });

    it('honors RMS_BASE_DIR environment variable for all subdirectories', () => {
      const customBaseDir = path.join(os.tmpdir(), `custom-rms-base-${Date.now()}`);
      process.env.RMS_BASE_DIR = customBaseDir;
      PathResolver.resetInstance();

      const dataDir = getDirectory('data');
      const logsDir = getDirectory('logs');
      const exportsDir = getDirectory('exports');

      expect(dataDir).toBe(path.resolve(customBaseDir, 'data'));
      expect(logsDir).toBe(path.resolve(customBaseDir, 'logs'));
      expect(exportsDir).toBe(path.resolve(customBaseDir, 'exports'));

      // Clean up
      try {
        fs.rmSync(customBaseDir, { recursive: true, force: true });
      } catch {}
    });
  });

  describe('Path Traversal Security Shield (resolveSafePath)', () => {
    const safeBaseDir = path.join(os.tmpdir(), `safe-boundary-${Date.now()}`);

    beforeEach(() => {
      if (!fs.existsSync(safeBaseDir)) {
        fs.mkdirSync(safeBaseDir, { recursive: true });
      }
    });

    afterEach(() => {
      try {
        fs.rmSync(safeBaseDir, { recursive: true, force: true });
      } catch {}
    });

    it('allows valid relative paths within the base directory', () => {
      const safePath = resolveSafePath(safeBaseDir, 'reports/daily-sales.json');
      expect(safePath.startsWith(path.resolve(safeBaseDir))).toBe(true);
      expect(safePath.endsWith('daily-sales.json')).toBe(true);
    });

    it('blocks directory traversal attempts using parent relative dot-dots (POSIX)', () => {
      expect(() => {
        resolveSafePath(safeBaseDir, '../../etc/passwd');
      }).toThrow(/Security Violation/);
    });

    it('blocks directory traversal attempts using Windows backslash dot-dots', () => {
      expect(() => {
        resolveSafePath(safeBaseDir, '..\\..\\Windows\\System32');
      }).toThrow(/Security Violation/);
    });

    it('sanitizes null-byte injection attempts', () => {
      const result = resolveSafePath(safeBaseDir, 'subfolder/clean\0file.txt');
      expect(result.includes('\0')).toBe(false);
      expect(result.endsWith('cleanfile.txt')).toBe(true);
    });
  });

  describe('Legacy Database Migration & Platform Diagnostics', () => {
    it('migrates legacy database from root if target does not yet exist', () => {
      const testLegacyName = `test-legacy-${Date.now()}.db.json`;
      const testLegacyPath = path.resolve(process.cwd(), testLegacyName);
      const testTargetName = `migrated-${Date.now()}.db.json`;
      const targetDataPath = resolveDataPath(testTargetName);

      // Create dummy legacy file
      fs.writeFileSync(testLegacyPath, JSON.stringify({ migrated: true }), 'utf8');

      try {
        migrateRootDatabaseIfExists(testLegacyName, testTargetName);
        expect(fs.existsSync(targetDataPath)).toBe(true);

        const content = JSON.parse(fs.readFileSync(targetDataPath, 'utf8'));
        expect(content.migrated).toBe(true);
      } finally {
        // Clean up
        try { fs.unlinkSync(testLegacyPath); } catch {}
        try { fs.unlinkSync(targetDataPath); } catch {}
      }
    });

    it('provides comprehensive platform diagnostics', () => {
      const diagnostics = PathResolver.getInstance().getPlatformDiagnostics();

      expect(diagnostics.platform).toBe(process.platform);
      expect(diagnostics.architecture).toBe(process.arch);
      expect(diagnostics.nodeVersion).toBe(process.version);
      expect(typeof diagnostics.projectRoot).toBe('string');
      expect(diagnostics.directories.data).toBeDefined();
      expect(diagnostics.directories.logs).toBeDefined();
      expect(diagnostics.directories.exports).toBeDefined();
    });
  });
});
