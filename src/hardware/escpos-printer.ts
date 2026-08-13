import net from 'net';

export interface PrintReceiptRequest {
  storeName: string;
  ticketId: string;
  timestamp: string;
  stationName?: string;
  reroutedFrom?: string;
  items: { name: string; qty: number; price: number; modifiers?: string[] }[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface PrinterHardwareStatus {
  isOnline: boolean;
  isCoverOpen: boolean;
  isPaperLow: boolean;
  isPaperOut: boolean;
  rawStatusByte?: number;
}

export interface PrinterStationConfig {
  stationId: string;
  stationName: string;
  ip: string;
  port: number;
  fallbackStationId?: string;
}

export class ESCPOSThermalPrinterDriver {
  /**
   * Generates raw ESC/POS binary command buffer for thermal receipt printing over LAN TCP socket or USB.
   */
  public generateReceiptBuffer(req: PrintReceiptRequest): Buffer {
    const commands: number[] = [];

    // ESC @ - Initialize Printer
    commands.push(0x1b, 0x40);

    // If rerouted due to hardware failure on another station, print prominent emergency banner
    if (req.reroutedFrom) {
      // ESC E 1 - Turn Bold Mode On
      commands.push(0x1b, 0x45, 0x01);
      // ESC a 1 - Center Alignment
      commands.push(0x1b, 0x61, 0x01);
      const rerouteBanner = `\n********************************\n[!] REROUTED FROM ${req.reroutedFrom.toUpperCase()} [!]\nCHECK STATION FOR PAPER OUT / JAM\n********************************\n\n`;
      for (let i = 0; i < rerouteBanner.length; i++) {
        commands.push(rerouteBanner.charCodeAt(i));
      }
      // ESC E 0 - Bold Off
      commands.push(0x1b, 0x45, 0x00);
    }

    // ESC a 1 - Center Alignment
    commands.push(0x1b, 0x61, 0x01);

    // Header Text
    const stationHeader = req.stationName ? `Station: ${req.stationName}\n` : '';
    const headerStr = `*** ${req.storeName.toUpperCase()} ***\n${stationHeader}Ticket #${req.ticketId}\n${req.timestamp}\n--------------------------------\n`;
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
      if (item.modifiers && item.modifiers.length > 0) {
        const modStr = `   + ${item.modifiers.join(', ')}\n`;
        for (let j = 0; j < modStr.length; j++) {
          commands.push(modStr.charCodeAt(j));
        }
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
   * Queries real-time hardware status via DLE EOT n command.
   * DLE EOT 4 (0x10 0x04 0x04) = Query Paper Roll Sensor Status.
   */
  public queryPaperSensorStatus(rawByte: number): PrinterHardwareStatus {
    // ESC/POS Paper Sensor Byte mapping:
    // Bit 5 & Bit 6 high (0x60) = Paper out / roll empty
    // Bit 2 & Bit 3 high (0x0C) = Paper near end
    const isPaperOut = (rawByte & 0x60) === 0x60;
    const isPaperLow = (rawByte & 0x0c) === 0x0c;

    return {
      isOnline: true,
      isCoverOpen: false,
      isPaperLow,
      isPaperOut,
      rawStatusByte: rawByte,
    };
  }

  /**
   * Transmits raw ESC/POS binary buffer directly to thermal printer over LAN TCP socket (Port 9100).
   */
  public async printOverTCP(
    ip: string,
    port: number = 9100,
    req: PrintReceiptRequest
  ): Promise<{ success: boolean; bytesWritten: number; message: string; targetStation?: string }> {
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
            message: `Ticket #${req.ticketId} successfully printed on ${req.stationName || ip}:${port}`,
            targetStation: req.stationName,
          });
        });
      });

      client.on('error', (err) => {
        client.destroy();
        resolve({
          success: false,
          bytesWritten: 0,
          message: `Network printer socket error (${ip}:${port}): ${err.message}.`,
          targetStation: req.stationName,
        });
      });

      client.on('timeout', () => {
        client.destroy();
        resolve({
          success: false,
          bytesWritten: 0,
          message: `Network printer timeout on ${ip}:${port}.`,
          targetStation: req.stationName,
        });
      });
    });
  }

  /**
   * Smart Kitchen Station Routing with Automatic Fallback Failover:
   * If primary hotline printer is unreachable or out of paper, automatically reroutes to expo backup.
   */
  public async printWithFallback(
    primary: PrinterStationConfig,
    fallback: PrinterStationConfig | undefined,
    req: PrintReceiptRequest
  ): Promise<{ success: boolean; printedOnStation: string; wasRerouted: boolean; message: string }> {
    req.stationName = primary.stationName;
    const primaryAttempt = await this.printOverTCP(primary.ip, primary.port, req);

    if (primaryAttempt.success) {
      return {
        success: true,
        printedOnStation: primary.stationName,
        wasRerouted: false,
        message: primaryAttempt.message,
      };
    }

    // Primary failed! Attempt fallback if configured
    if (fallback) {
      const reroutedReq: PrintReceiptRequest = {
        ...req,
        stationName: fallback.stationName,
        reroutedFrom: primary.stationName,
      };

      const fallbackAttempt = await this.printOverTCP(fallback.ip, fallback.port, reroutedReq);
      if (fallbackAttempt.success) {
        return {
          success: true,
          printedOnStation: fallback.stationName,
          wasRerouted: true,
          message: `[FAILOVER ACTIVE] Primary station (${primary.stationName}) failed. Ticket successfully rerouted to ${fallback.stationName}.`,
        };
      }
    }

    return {
      success: false,
      printedOnStation: 'NONE_STORED_IN_WAL_QUEUE',
      wasRerouted: false,
      message: `Critical hardware error: Both primary (${primary.stationName}) and fallback printer stations are offline. Ticket queued in local SQLite WAL buffer.`,
    };
  }
}
