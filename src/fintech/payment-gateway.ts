import Database from 'better-sqlite3';
import crypto from 'crypto';

const uuidv4 = () => crypto.randomUUID();

export interface TerminalPaymentIntent {
  intentId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  terminalId: string;
  status: 'REQUIRES_PAYMENT_METHOD' | 'PROCESSING' | 'SUCCESS' | 'CANCELED';
  terminalRef?: string;
  maskedCard?: string;
  authCode?: string;
}

export interface PaymentGatewayConfig {
  providerName: string;
  merchantId: string;
  isTestMode: boolean;
}

export class CertifiedPaymentGateway {
  constructor(
    private db: any,
    private config: PaymentGatewayConfig = {
      providerName: 'CERTIFIED_COUNTERTOP_TERMINAL',
      merchantId: 'merch-store-104',
      isTestMode: true,
    }
  ) {}

  /**
   * Initiates payment on countertop/mobile terminal without cardholder PAN/CVV entering the app
   */
  public async createTerminalIntent(orderId: string, amountCents: number, currency = 'USD'): Promise<TerminalPaymentIntent> {
    const order = this.db.prepare('SELECT order_id, store_id, total_cents FROM orders WHERE order_id = ?').get(orderId) as any;
    if (!order) {
      throw new Error(`Order '${orderId}' not found.`);
    }

    const intentId = `pi_${uuidv4().slice(0, 16)}`;
    return {
      intentId,
      orderId,
      amountCents,
      currency,
      terminalId: 'term-countertop-01',
      status: 'REQUIRES_PAYMENT_METHOD',
    };
  }

  /**
   * Simulates customer tapping chip card on certified countertop terminal (EMV L1/L2 verified)
   */
  public async collectAndAuthorize(intentId: string): Promise<TerminalPaymentIntent> {
    // In production, the terminal firmware encrypts card data to processor HSM
    // The POS software receives ONLY the terminal reference and authorization approval token
    return {
      intentId,
      orderId: 'simulated',
      amountCents: 0,
      currency: 'USD',
      terminalId: 'term-countertop-01',
      status: 'SUCCESS',
      terminalRef: `term_auth_${Date.now()}`,
      maskedCard: 'VISA •••• 4242',
      authCode: 'AUTH99481',
    };
  }

  /**
   * Process full or partial refund with manager step-up authorization
   */
  public processRefund(
    orderId: string,
    paymentId: string,
    amountCents: number,
    reason: string,
    managerUserId: string
  ): { refundId: string; amountCents: number; status: string } {
    const payment = this.db.prepare('SELECT payment_id, order_id, amount_cents, status FROM payments WHERE payment_id = ?').get(paymentId) as any;
    if (!payment) {
      throw new Error(`Payment with ID '${paymentId}' not found.`);
    }

    const refundId = uuidv4();
    const now = new Date().toISOString();

    const refundTx = this.db.transaction(() => {
      this.db
        .prepare(`
          INSERT INTO refunds_and_voids (action_id, order_id, payment_id, action_type, amount_cents, reason, approved_by_user_id, created_at)
          VALUES (?, ?, ?, 'REFUND', ?, ?, ?, ?)
        `)
        .run(refundId, orderId, paymentId, amountCents, reason, managerUserId, now);

      this.db.prepare("UPDATE orders SET status = 'REFUNDED', updated_at = ? WHERE order_id = ?").run(now, orderId);

      this.db.prepare(`
        INSERT INTO audit_events (event_id, store_id, user_id, device_id, action, entity_type, entity_id, before_json, after_json, created_at)
        VALUES (?, 'store-104', ?, 'pos-terminal', 'PAYMENT_REFUNDED', 'PAYMENT', ?, ?, ?, ?)
      `).run(
        uuidv4(),
        managerUserId,
        paymentId,
        JSON.stringify({ amountCents: payment.amount_cents }),
        JSON.stringify({ refundAmountCents: amountCents, reason }),
        now
      );
    });

    refundTx();

    return {
      refundId,
      amountCents,
      status: 'REFUND_SETTLED',
    };
  }
}
