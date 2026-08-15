export type DeviceType = 'THERMAL_PRINTER' | 'CASH_DRAWER' | 'PAYMENT_TERMINAL' | 'BARCODE_SCANNER' | 'CUSTOMER_DISPLAY';
export type ConnectionType = 'NETWORK_TCP' | 'USB_RAW' | 'SERIAL' | 'BLUETOOTH';

export interface SupportedHardwareSpec {
  modelId: string;
  manufacturer: string;
  modelName: string;
  deviceType: DeviceType;
  supportedConnections: ConnectionType[];
  paperWidthMm?: 58 | 80;
  columnWidthChars?: 32 | 42 | 48;
  characterEncoding?: 'CP437' | 'WPC1252' | 'UTF-8' | 'GB18030';
  supportsCutter?: boolean;
  supportsDrawerKick?: boolean;
  drawerKickCode?: number[]; // ESC/POS binary sequence, e.g. [0x1b, 0x70, 0x00, 0x19, 0xfa]
  portDefault?: number; // e.g. 9100 for ESC/POS Raw TCP
}

export interface StoreDeviceBinding {
  deviceId: string;
  storeId: string;
  modelId: string;
  deviceRole: 'HOTLINE_PRINTER' | 'EXPO_PRINTER' | 'RECEIPT_PRINTER' | 'COUNTER_DRAWER' | 'COUNTER_TERMINAL';
  connectionType: ConnectionType;
  networkHost?: string;
  networkPort?: number;
  usbVendorId?: string;
  usbProductId?: string;
  fallbackDeviceId?: string;
  isActive: boolean;
}

export class HardwareRegistry {
  public static readonly SUPPORTED_DEVICES: SupportedHardwareSpec[] = [
    {
      modelId: 'EPSON-TM-T88VI',
      manufacturer: 'Epson',
      modelName: 'TM-T88VI Thermal Receipt Printer',
      deviceType: 'THERMAL_PRINTER',
      supportedConnections: ['NETWORK_TCP', 'USB_RAW'],
      paperWidthMm: 80,
      columnWidthChars: 48,
      characterEncoding: 'CP437',
      supportsCutter: true,
      supportsDrawerKick: true,
      drawerKickCode: [0x1b, 0x70, 0x00, 0x19, 0xfa],
      portDefault: 9100,
    },
    {
      modelId: 'STAR-TSP143III',
      manufacturer: 'Star Micronics',
      modelName: 'TSP143III Ethernet Thermal Printer',
      deviceType: 'THERMAL_PRINTER',
      supportedConnections: ['NETWORK_TCP', 'USB_RAW'],
      paperWidthMm: 80,
      columnWidthChars: 48,
      characterEncoding: 'WPC1252',
      supportsCutter: true,
      supportsDrawerKick: true,
      drawerKickCode: [0x07], // Star pulse
      portDefault: 9100,
    },
    {
      modelId: 'SUNMI-58MM-CLOUD',
      manufacturer: 'Sunmi',
      modelName: 'Sunmi Cloud 58mm Kitchen & Receipt Printer',
      deviceType: 'THERMAL_PRINTER',
      supportedConnections: ['NETWORK_TCP'],
      paperWidthMm: 58,
      columnWidthChars: 32,
      characterEncoding: 'UTF-8',
      supportsCutter: false,
      supportsDrawerKick: true,
      drawerKickCode: [0x1b, 0x70, 0x00, 0x19, 0xfa],
      portDefault: 9100,
    },
    {
      modelId: 'APG-VASARIO-DRAWER',
      manufacturer: 'APG Cash Drawer',
      modelName: 'Vasario Series 24V RJ11 Drawer',
      deviceType: 'CASH_DRAWER',
      supportedConnections: ['NETWORK_TCP', 'USB_RAW'],
      supportsDrawerKick: true,
      drawerKickCode: [0x1b, 0x70, 0x00, 0x19, 0xfa],
    },
    {
      modelId: 'PINELABS-PLUTUS-A920',
      manufacturer: 'Pine Labs / Pax',
      modelName: 'Plutus Android Smart POS Terminal',
      deviceType: 'PAYMENT_TERMINAL',
      supportedConnections: ['NETWORK_TCP', 'BLUETOOTH'],
      portDefault: 8080,
    },
    {
      modelId: 'ZEBRA-DS2208-SCANNER',
      manufacturer: 'Zebra',
      modelName: 'DS2208 1D/2D Handheld Barcode Scanner',
      deviceType: 'BARCODE_SCANNER',
      supportedConnections: ['USB_RAW'],
    },
  ];

  private devices: Map<string, StoreDeviceBinding> = new Map();

  constructor(initialBindings: StoreDeviceBinding[] = []) {
    for (const d of initialBindings) {
      this.devices.set(d.deviceId, d);
    }
  }

  public registerDevice(binding: StoreDeviceBinding): void {
    const spec = HardwareRegistry.SUPPORTED_DEVICES.find(s => s.modelId === binding.modelId);
    if (!spec) {
      throw new Error(`Device model '${binding.modelId}' is not certified in the Supported Hardware Registry.`);
    }
    this.devices.set(binding.deviceId, binding);
  }

  public getDevice(deviceId: string): StoreDeviceBinding | undefined {
    return this.devices.get(deviceId);
  }

  public getDeviceSpec(modelId: string): SupportedHardwareSpec | undefined {
    return HardwareRegistry.SUPPORTED_DEVICES.find(s => s.modelId === modelId);
  }

  /**
   * Resolves active printer for a station with automatic fallback routing
   */
  public resolveActivePrinter(targetDeviceId: string): {
    primary: StoreDeviceBinding;
    fallback?: StoreDeviceBinding;
    spec: SupportedHardwareSpec;
  } {
    const primary = this.devices.get(targetDeviceId);
    if (!primary) {
      throw new Error(`Device '${targetDeviceId}' is not registered.`);
    }

    const spec = this.getDeviceSpec(primary.modelId);
    if (!spec) {
      throw new Error(`Spec for model '${primary.modelId}' not found.`);
    }

    let fallback: StoreDeviceBinding | undefined;
    if (primary.fallbackDeviceId) {
      fallback = this.devices.get(primary.fallbackDeviceId);
    }

    return { primary, fallback, spec };
  }

  /**
   * Generates ESC/POS pulse buffer to open cash drawer
   */
  public static generateCashDrawerKickBuffer(spec: SupportedHardwareSpec): Buffer {
    const codes = spec.drawerKickCode || [0x1b, 0x70, 0x00, 0x19, 0xfa];
    return Buffer.from(codes);
  }
}
