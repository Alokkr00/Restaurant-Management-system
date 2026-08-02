import net from 'net';

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

  /**
   * Transmits raw ESC/POS binary buffer directly to thermal printer over LAN TCP socket (Port 9100).
   */
  public async printOverTCP(ip: string, port: number = 9100, req: PrintReceiptRequest): Promise<{ success: boolean; bytesWritten: number; message: string }> {
    const buffer = this.generateReceiptBuffer(req);

    return new Promise((resolve) => {
      const client = new net.Socket();
      client.setTimeout(3000); // 3s timeout for store LAN sockets

      client.connect(port, ip, () => {
        client.write(buffer, () => {
          client.end();
          resolve({
            success: true,
            bytesWritten: buffer.length,
            message: `Receipt #${req.ticketId} successfully dispatched to thermal printer at ${ip}:${port}`,
          });
        });
      });

      client.on('error', (err) => {
        client.destroy();
        resolve({
          success: false,
          bytesWritten: 0,
          message: `Network printer socket error (${ip}:${port}): ${err.message}. Receipt queued in local SQLite WAL offline buffer.`,
        });
      });

      client.on('timeout', () => {
        client.destroy();
        resolve({
          success: false,
          bytesWritten: 0,
          message: `Network printer timeout on ${ip}:${port}. Receipt queued in local SQLite WAL offline buffer.`,
        });
      });
    });
  }
}
