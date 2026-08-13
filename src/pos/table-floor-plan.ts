// ─── Domain Types ────────────────────────────────────────────────────────────

export type TableStatus = 'VACANT' | 'SEATED' | 'ORDERING' | 'SERVED' | 'CLOSED';

export interface Table {
  tableId: string;
  label: string;         // e.g. "Table 4", "Bar 2", "Patio 1"
  seats: number;
  section: string;       // e.g. "Main Floor", "Patio", "Bar"
  status: TableStatus;
  openTicketId?: string;
  seatedAt?: string;
  covers?: number;       // Number of guests seated
  serverName?: string;
}

export type CourseStatus = 'HELD' | 'FIRED' | 'BUMPED';

export interface CourseItem {
  menuItemId: string;
  itemName: string;
  quantity: number;
  modifiers?: string[];
  courseStatus: CourseStatus;
}

export interface TableTicket {
  ticketId: string;
  tableId: string;
  storeId: string;
  openedAt: string;
  covers: number;
  serverName: string;
  courses: CourseItem[][];  // Array of course rounds: [appetizers[], mains[], desserts[]]
  activeCourseIndex: number;
  isClosed: boolean;
  closedAt?: string;
  totalBeforeTax: number;
}

export interface TableTransferRecord {
  transferId: string;
  fromTableId: string;
  toTableId: string;
  ticketId: string;
  transferredAt: string;
  authorizedBy: string;
}

// ─── Table Floor Plan Engine ─────────────────────────────────────────────────

export class TableFloorPlanEngine {
  private floorPlan: Map<string, Table>;
  private openTickets: Map<string, TableTicket>;
  private transferLog: TableTransferRecord[];

  constructor() {
    this.floorPlan = new Map([
      ['tbl-1',  { tableId: 'tbl-1',  label: 'Table 1',  seats: 2, section: 'Main Floor', status: 'VACANT' }],
      ['tbl-2',  { tableId: 'tbl-2',  label: 'Table 2',  seats: 4, section: 'Main Floor', status: 'VACANT' }],
      ['tbl-3',  { tableId: 'tbl-3',  label: 'Table 3',  seats: 4, section: 'Main Floor', status: 'VACANT' }],
      ['tbl-4',  { tableId: 'tbl-4',  label: 'Table 4',  seats: 6, section: 'Main Floor', status: 'VACANT' }],
      ['tbl-5',  { tableId: 'tbl-5',  label: 'Table 5',  seats: 2, section: 'Main Floor', status: 'VACANT' }],
      ['tbl-6',  { tableId: 'tbl-6',  label: 'Table 6',  seats: 8, section: 'Private Dining', status: 'VACANT' }],
      ['bar-1',  { tableId: 'bar-1',  label: 'Bar Seat 1', seats: 1, section: 'Bar', status: 'VACANT' }],
      ['bar-2',  { tableId: 'bar-2',  label: 'Bar Seat 2', seats: 1, section: 'Bar', status: 'VACANT' }],
      ['pat-1',  { tableId: 'pat-1',  label: 'Patio 1',  seats: 4, section: 'Patio', status: 'VACANT' }],
      ['pat-2',  { tableId: 'pat-2',  label: 'Patio 2',  seats: 4, section: 'Patio', status: 'VACANT' }],
    ]);
    this.openTickets = new Map();
    this.transferLog = [];
  }

  // ─── Read Floor State ───────────────────────────────────────────────────

  public getFloorPlan(): Table[] {
    return Array.from(this.floorPlan.values());
  }

  public getTable(tableId: string): Table {
    const table = this.floorPlan.get(tableId);
    if (!table) throw new Error(`Table ${tableId} not found on floor plan`);
    return table;
  }

  public getOpenTicket(ticketId: string): TableTicket {
    const ticket = this.openTickets.get(ticketId);
    if (!ticket) throw new Error(`Ticket ${ticketId} not found`);
    return ticket;
  }

  // ─── Seating & Ticket Management ────────────────────────────────────────

  /**
   * Seats a party at a table and opens a fresh ticket.
   * Throws if the table is already occupied.
   */
  public seatTable(tableId: string, covers: number, serverName: string, storeId: string): TableTicket {
    const table = this.getTable(tableId);
    if (table.status !== 'VACANT') {
      throw new Error(`Table ${tableId} is ${table.status} — cannot seat a new party`);
    }
    if (covers > table.seats) {
      throw new Error(`Table ${tableId} has ${table.seats} seats — cannot seat ${covers} covers`);
    }

    const ticket: TableTicket = {
      ticketId: `TKT-${tableId.toUpperCase()}-${Date.now()}`,
      tableId,
      storeId,
      openedAt: new Date().toISOString(),
      covers,
      serverName,
      courses: [[]],   // Start with one empty course
      activeCourseIndex: 0,
      isClosed: false,
      totalBeforeTax: 0,
    };

    this.openTickets.set(ticket.ticketId, ticket);

    table.status = 'SEATED';
    table.openTicketId = ticket.ticketId;
    table.seatedAt = ticket.openedAt;
    table.covers = covers;
    table.serverName = serverName;

    return ticket;
  }

  /**
   * Adds items to the current active course (HELD state — not yet sent to KDS).
   * Items stay HELD until fireCourse() is called.
   */
  public holdItems(ticketId: string, items: Omit<CourseItem, 'courseStatus'>[]): TableTicket {
    const ticket = this.getOpenTicket(ticketId);
    const table = this.floorPlan.get(ticket.tableId);
    if (!table) throw new Error('Table not found for ticket');

    const heldItems: CourseItem[] = items.map((i) => ({ ...i, courseStatus: 'HELD' }));
    ticket.courses[ticket.activeCourseIndex].push(...heldItems);

    // Update ticket total from held items
    ticket.totalBeforeTax = ticket.courses.flat().reduce(
      (sum, item) => sum + item.quantity * 10, // In production: lookup basePrice from recipe/menu
      0
    );

    table.status = 'ORDERING';
    return ticket;
  }

  /**
   * Fires all HELD items on the active course to the KDS.
   * Transitions items from HELD → FIRED.
   * Advances the course index to begin capturing the next course round.
   */
  public fireCourse(ticketId: string): { firedItems: CourseItem[]; nextCourseIndex: number } {
    const ticket = this.getOpenTicket(ticketId);
    const table = this.floorPlan.get(ticket.tableId);

    const activeCourse = ticket.courses[ticket.activeCourseIndex];
    const heldItems = activeCourse.filter((i) => i.courseStatus === 'HELD');
    if (heldItems.length === 0) {
      throw new Error(`No HELD items to fire on course ${ticket.activeCourseIndex} for ticket ${ticketId}`);
    }

    // Fire all HELD → FIRED
    heldItems.forEach((item) => {
      item.courseStatus = 'FIRED';
    });

    // Advance to next course round
    ticket.courses.push([]);
    ticket.activeCourseIndex += 1;

    if (table) table.status = 'SERVED';

    return { firedItems: heldItems, nextCourseIndex: ticket.activeCourseIndex };
  }

  /**
   * Transfers an open ticket from one table to another.
   * The source table is freed (VACANT), the destination must be VACANT.
   */
  public transferTable(
    fromTableId: string,
    toTableId: string,
    authorizedBy: string
  ): TableTransferRecord {
    const fromTable = this.getTable(fromTableId);
    const toTable = this.getTable(toTableId);

    if (!fromTable.openTicketId) {
      throw new Error(`Table ${fromTableId} has no open ticket to transfer`);
    }
    if (toTable.status !== 'VACANT') {
      throw new Error(`Target table ${toTableId} is ${toTable.status} — cannot transfer to occupied table`);
    }

    const ticket = this.getOpenTicket(fromTable.openTicketId);

    // Move ticket to new table
    ticket.tableId = toTableId;
    toTable.status = fromTable.status;
    toTable.openTicketId = fromTable.openTicketId;
    toTable.seatedAt = fromTable.seatedAt;
    toTable.covers = fromTable.covers;
    toTable.serverName = fromTable.serverName;

    // Free source table
    fromTable.status = 'VACANT';
    delete fromTable.openTicketId;
    delete fromTable.seatedAt;
    delete fromTable.covers;
    delete fromTable.serverName;

    const record: TableTransferRecord = {
      transferId: `XFER-${Date.now()}`,
      fromTableId,
      toTableId,
      ticketId: ticket.ticketId,
      transferredAt: new Date().toISOString(),
      authorizedBy,
    };

    this.transferLog.push(record);
    return record;
  }

  /**
   * Closes a table after payment is confirmed.
   * Validates that payments sum to the bill total (within ±0.01 rounding).
   * Resets the table to VACANT for the next party.
   */
  public closeTable(
    tableId: string,
    payments: { type: string; amount: number }[]
  ): { closedTicket: TableTicket; change: number } {
    const table = this.getTable(tableId);
    if (!table.openTicketId) {
      throw new Error(`Table ${tableId} has no open ticket`);
    }

    const ticket = this.getOpenTicket(table.openTicketId);
    const totalTendered = payments.reduce((sum, p) => sum + p.amount, 0);
    const billTotal = ticket.totalBeforeTax * 1.05; // 5% GST (India restaurant rate)

    if (totalTendered < billTotal - 0.01) {
      throw new Error(
        `Insufficient payment: bill is ₹${billTotal.toFixed(2)}, tendered ₹${totalTendered.toFixed(2)}`
      );
    }

    const change = Math.max(0, totalTendered - billTotal);

    ticket.isClosed = true;
    ticket.closedAt = new Date().toISOString();

    // Free the table
    table.status = 'VACANT';
    delete table.openTicketId;
    delete table.seatedAt;
    delete table.covers;
    delete table.serverName;

    return { closedTicket: ticket, change };
  }

  public getTransferLog(): TableTransferRecord[] {
    return [...this.transferLog];
  }
}
