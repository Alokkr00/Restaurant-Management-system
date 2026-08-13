import { describe, it, expect, beforeEach } from 'vitest';
import { TableFloorPlanEngine } from '../src/pos/table-floor-plan.js';

describe('Table Floor Plan Engine', () => {
  let engine: TableFloorPlanEngine;

  beforeEach(() => {
    engine = new TableFloorPlanEngine();
  });

  it('seats a party and opens a ticket with correct state', () => {
    const ticket = engine.seatTable('tbl-2', 3, 'Sarah Jenkins', 'store-104');

    expect(ticket.covers).toBe(3);
    expect(ticket.serverName).toBe('Sarah Jenkins');
    expect(ticket.isClosed).toBe(false);
    expect(ticket.courses.length).toBe(1); // One empty course to start

    const table = engine.getTable('tbl-2');
    expect(table.status).toBe('SEATED');
    expect(table.openTicketId).toBe(ticket.ticketId);
  });

  it('throws when seating a party at an already occupied table', () => {
    engine.seatTable('tbl-3', 2, 'Mike', 'store-104');
    expect(() => engine.seatTable('tbl-3', 2, 'John', 'store-104')).toThrow('cannot seat a new party');
  });

  it('holds items and fires them to KDS — advancing the course index', () => {
    const ticket = engine.seatTable('tbl-4', 4, 'Alex Doe', 'store-104');

    engine.holdItems(ticket.ticketId, [
      { menuItemId: 'item-103', itemName: 'Spicy Buffalo Wings', quantity: 2, modifiers: ['Extra Crispy'] },
    ]);

    expect(ticket.courses[0][0].courseStatus).toBe('HELD');

    const result = engine.fireCourse(ticket.ticketId);
    expect(result.firedItems[0].courseStatus).toBe('FIRED');
    expect(result.nextCourseIndex).toBe(1);
    expect(ticket.courses.length).toBe(2); // New empty course for mains

    // Verify table is now SERVED
    const table = engine.getTable('tbl-4');
    expect(table.status).toBe('SERVED');
  });

  it('transfers an open ticket to a vacant table', () => {
    const ticket = engine.seatTable('tbl-1', 2, 'Jane', 'store-104');
    const transfer = engine.transferTable('tbl-1', 'tbl-5', 'Manager Smith');

    expect(transfer.fromTableId).toBe('tbl-1');
    expect(transfer.toTableId).toBe('tbl-5');
    expect(transfer.ticketId).toBe(ticket.ticketId);

    // Source table should now be VACANT
    expect(engine.getTable('tbl-1').status).toBe('VACANT');
    // Destination table should be active
    expect(engine.getTable('tbl-5').status).not.toBe('VACANT');
    expect(engine.getTable('tbl-5').openTicketId).toBe(ticket.ticketId);
  });

  it('throws when transferring to an already occupied table', () => {
    engine.seatTable('tbl-1', 2, 'A', 'store-104');
    engine.seatTable('tbl-2', 3, 'B', 'store-104');

    expect(() => engine.transferTable('tbl-1', 'tbl-2', 'Manager')).toThrow('cannot transfer to occupied table');
  });

  it('closes a table and returns change after payment', () => {
    const ticket = engine.seatTable('tbl-6', 5, 'Chris', 'store-104');
    engine.holdItems(ticket.ticketId, [
      { menuItemId: 'item-101', itemName: 'Large Pepperoni Pizza', quantity: 2 },
    ]);
    engine.fireCourse(ticket.ticketId);

    const { closedTicket, change } = engine.closeTable('tbl-6', [
      { type: 'CASH', amount: 100 }, // Overpay — expect change
    ]);

    expect(closedTicket.isClosed).toBe(true);
    expect(change).toBeGreaterThanOrEqual(0);
    expect(engine.getTable('tbl-6').status).toBe('VACANT');
  });

  it('throws when closing a table with insufficient payment', () => {
    const ticket = engine.seatTable('tbl-2', 2, 'Bob', 'store-104');
    engine.holdItems(ticket.ticketId, [
      { menuItemId: 'item-101', itemName: 'Large Pepperoni Pizza', quantity: 10 }, // Expensive order
    ]);
    engine.fireCourse(ticket.ticketId);

    expect(() => engine.closeTable('tbl-2', [{ type: 'CASH', amount: 1 }])).toThrow('Insufficient payment');
  });
});
