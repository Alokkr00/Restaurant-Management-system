import { describe, it, expect, beforeEach } from 'vitest';
import { SupportBundleCollector } from '../src/shared/support-bundle.js';

describe('SupportBundleCollector - Diagnostics Compilation & PII Sanitization', () => {
  let mockDb: any;
  let collector: SupportBundleCollector;

  beforeEach(() => {
    mockDb = {
      prepare: (sql: string) => ({
        get: () => {
          if (sql.includes('MAX(version)')) return { maxVer: 2 };
          if (sql.includes('SELECT menu_version_id')) return { menu_version_id: 'menu-v2-prod' };
          if (sql.includes('FROM sync_outbox')) return { cnt: 0, maxSeq: 42, oldest: null };
          if (sql.includes('FROM print_jobs')) return { cnt: 0, last_error: null };
          if (sql.includes('COUNT(*)')) return { cnt: 10 };
          return {};
        },
      }),
    };

    collector = new SupportBundleCollector(mockDb);
  });

  it('compiles full system diagnostics package with schema and outbox metrics', () => {
    const bundle = collector.generateDiagnosticsBundle('store-104', false);

    expect(bundle.storeId).toBe('store-104');
    expect(bundle.schemaVersion).toBe(2);
    expect(bundle.activeMenuVersion).toBe('menu-v2-prod');
    expect(bundle.guidedRecoveryRunbooks.length).toBeGreaterThan(0);
  });

  it('redacts employee PIN hashes, phone numbers, and secret tokens', () => {
    const rawData = {
      storeId: 'store-104',
      customer_name: 'John Customer',
      phone: '9820111223',
      email: 'john@example.com',
      auth_token: 'secret_jwt_token_123',
      user: {
        userId: 'usr-1',
        pin_hash: 'a1b2c3d4e5f60718:8e9c56f8f5370335e985b3bcf72c3d42c38d2121e784566c3a647f11818ff243',
      },
    };

    const sanitized = SupportBundleCollector.redactPII(rawData);

    expect(sanitized.customer_name).toBe('[REDACTED_PII]');
    expect(sanitized.phone).toBe('[REDACTED_PII]');
    expect(sanitized.email).toBe('[REDACTED_PII]');
    expect(sanitized.auth_token).toBe('[REDACTED_SECRET]');
    expect(sanitized.user.pin_hash).toBe('[REDACTED_SECRET]');
  });
});
