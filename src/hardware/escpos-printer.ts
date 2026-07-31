export interface PrintReceiptRequest {
  storeName: string;
  ticketId: string;
  timestamp: string;
  items: { name: string; qty: number; price: number }[];
  subtotal: number;
  tax: number;
  total: number;
}

export class ESCPOSThermalPrinterDriver {
  /**
   * Generates raw ESC/POS binary command buffer for thermal receipt printing over LAN TCP socket or USB.
   */
  public generateReceiptBuffer(req: PrintReceiptRequest): Buffer {
    const commands: number[] = [];

    // ESC @ - Initialize Printer
    commands.push(0x1b, 0x40);

    // ESC a 1 - Center Alignment
    commands.push(0x1b, 0x61, 0x01);

    // Header Text
    const headerStr = `*** ${req.storeName.toUpperCase()} ***\nReceipt #${req.ticketId}\n${req.timestamp}\n--------------------------------\n`;
    for (let i = 0; i < headerStr.length; i++) {
      commands.push(headerStr.charCodeAt(i));
    }

    // ESC a 0 - Left Alignment
    commands.push(0x1b, 0x61, 0x00);

    // Items
    req.items.forEach((item) => {
      const line = `${item.qty}x ${item.name.padEnd(20, ' ')} $${(item.qty * item.price).toFixed(2)}\n`;
      for (let i = 0; i < line.length; i++) {
        commands.push(line.charCodeAt(i));
      }
    });

    // Totals
    const totalStr = `--------------------------------\nSubtotal: $${req.subtotal.toFixed(2)}\nTax: $${req.tax.toFixed(2)}\nTOTAL: $${req.total.toFixed(2)}\n================================\n\n`;
    for (let i = 0; i < totalStr.length; i++) {
      commands.push(totalStr.charCodeAt(i));
    }

    // GS V 0 - Full Paper Cut
    commands.push(0x1d, 0x56, 0x00);

    return Buffer.from(commands);
  }
}
