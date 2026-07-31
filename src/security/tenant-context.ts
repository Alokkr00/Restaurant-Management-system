import crypto from 'crypto';

export type UserRole =
  | 'HQ_ADMIN'
  | 'REGIONAL_MANAGER'
  | 'FRANCHISEE_OWNER'
  | 'STORE_MANAGER'
  | 'KITCHEN_LEAD'
  | 'CASHIER';

export interface TenantContext {
  platformId: string;
  tenantId: string;
  brandId: string;
  regionId?: string;
  storeId?: string;
  franchiseeId?: string;
  user: {
    userId: string;
    email: string;
    role: UserRole;
    allowedStoreIds: string[];
  };
}

export interface JWTClaims {
  sub: string;
  email: string;
  role: UserRole;
  platformId: string;
  tenantId: string;
  brandId: string;
  storeIds: string[];
  franchiseeId?: string;
  iat: number;
  exp: number;
}

export class JWTAuthService {
  private secret: string = 'rms_enterprise_jwt_secret_2026';

  /**
   * Issues signed JWT token carrying full tenant & RBAC claims context.
   */
  public issueToken(context: TenantContext): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);

    const payloadObj: JWTClaims = {
      sub: context.user.userId,
      email: context.user.email,
      role: context.user.role,
      platformId: context.platformId,
      tenantId: context.tenantId,
      brandId: context.brandId,
      storeIds: context.user.allowedStoreIds,
      franchiseeId: context.franchiseeId,
      iat: now,
      exp: now + 86400, // 24 hour token expiry
    };

    const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }

  /**
   * Verifies JWT token and extracts claims context.
   */
  public verifyToken(token: string): JWTClaims {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT format');

    const [header, payload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', this.secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSig) {
      throw new Error('JWT signature verification failed');
    }

    const claims: JWTClaims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (claims.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('JWT token expired');
    }

    return claims;
  }
}
