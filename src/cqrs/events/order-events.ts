import { CreateOrderCommand } from '../commands/order-commands.js';

export type VectorClock = Record<string, number>;

export interface DomainEvent<T = any> {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateVersion: number;
  storeId: string;
  terminalId: string;
  vectorClock: VectorClock;
  timestamp: string;
  payload: T;
}

export interface OrderCreatedPayload extends CreateOrderCommand {
  createdAt: string;
}

export interface OrderCreatedEvent extends DomainEvent<OrderCreatedPayload> {
  eventType: 'OrderCreated';
}

export interface OrderBumpedPayload {
  orderId: string;
  ticketId: string;
  station: string;
  previousStatus: string;
  newStatus: string;
  bumpedAt: string;
}

export interface OrderBumpedEvent extends DomainEvent<OrderBumpedPayload> {
  eventType: 'OrderBumped';
}

export interface OrderCancelledPayload {
  orderId: string;
  reason: string;
  restoredStock: boolean;
  cancelledAt: string;
}

export interface OrderCancelledEvent extends DomainEvent<OrderCancelledPayload> {
  eventType: 'OrderCancelled';
}

export type OrderEvent = OrderCreatedEvent | OrderBumpedEvent | OrderCancelledEvent;
