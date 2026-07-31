import { POSTransaction, POSOrderItem } from '../shared/types.js';

export interface DeliverectWebhookPayload {
  deliverectChannelOrderId: string;
  channel: 'DOORDASH' | 'UBEREATS' | 'GRUBHUB' | 'ZOMATO';
  storeId: string;
  customerName: string;
  items: {
    channelSku: string;
    quantity: number;
    price: number;
  }[];
  paymentStatus: 'PAID';
  estimatedPickupTime: string;
}

export interface KitchenPacingStatus {
  activeTicketCount: number;
  thresholdTickets: number;
  isPacingActive: boolean;
  addedDelayMinutes: number;
}

export class DeliverectIntegrationEngine {
  private activeTicketThreshold: number = 15; // Trigger pacing when > 15 active orders
  private skuMapping: Map<string, string> = new Map([
    ['DD-PEP-PIZZA', 'item-101'],
    ['UE-PEP-PIZZA', 'item-101'],
    ['GH-PEP-PIZZA', 'item-101'],
  ]);

  /**
   * Transforms Deliverect channel payload into internal POS Transaction.
   */
  public ingestChannelOrder(payload: DeliverectWebhookPayload): POSTransaction {
    const posItems: POSOrderItem[] = payload.items.map((item) => {
      const internalItemId = this.skuMapping.get(item.channelSku) || 'item-101';
      return {
        menuItemId: internalItemId,
        quantity: item.quantity,
        unitPrice: item.price,
      };
    });

    const subtotal = posItems.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
    const tax = Number((subtotal * 0.08).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));

    return {
      id: `deliv-${payload.deliverectChannelOrderId}`,
      storeId: payload.storeId,
      terminalId: `AGGREGATOR-${payload.channel}`,
      timestamp: new Date().toISOString(),
      items: posItems,
      subtotal,
      tax,
      total,
      tenders: [{ type: 'CARD', amount: total, transactionRef: payload.deliverectChannelOrderId }],
      offlineMode: false,
      synced: true,
    };
  }

  /**
   * Generates Auto-86ing webhook payload to disable out-of-stock items across all delivery apps (< 10s).
   */
  public generateAuto86Webhook(storeId: string, menuItemId: string, sku: string): {
    webhookUrl: string;
    payload: { storeId: string; sku: string; status: 'OUT_OF_STOCK'; timestamp: string };
  } {
    return {
      webhookUrl: 'https://api.deliverect.com/v1/availability/86',
      payload: {
        storeId,
        sku,
        status: 'OUT_OF_STOCK',
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Kitchen Pacing Engine: Dynamically extends customer delivery ETAs when KDS tickets exceed threshold.
   */
  public evaluateKitchenPacing(currentActiveTickets: number): KitchenPacingStatus {
    const isPacingActive = currentActiveTickets >= this.activeTicketThreshold;
    const addedDelayMinutes = isPacingActive
      ? Math.ceil((currentActiveTickets - this.activeTicketThreshold + 1) / 5) * 15
      : 0;

    return {
      activeTicketCount: currentActiveTickets,
      thresholdTickets: this.activeTicketThreshold,
      isPacingActive,
      addedDelayMinutes,
    };
  }
}
