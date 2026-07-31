import { POSTransaction } from '../shared/types.js';

export interface VirtualBrand {
  brandId: string;
  brandName: string;
  conceptCategory: string;
  colorBadge: string;
}

export interface RoutedGhostKitchenOrder {
  orderId: string;
  brand: VirtualBrand;
  transaction: POSTransaction;
  targetKDSStation: 'PIZZA_LINE' | 'WING_FRYER' | 'PASTA_STATION';
  timestamp: string;
}

export class MultiBrandGhostKitchenRouter {
  private brands: Map<string, VirtualBrand> = new Map([
    ['brand-pizza', { brandId: 'brand-pizza', brandName: 'Artisanal Pizza Co.', conceptCategory: 'PIZZA', colorBadge: '#3b82f6' }],
    ['brand-wings', { brandId: 'brand-wings', brandName: 'Wild Wings Express', conceptCategory: 'WINGS', colorBadge: '#f59e0b' }],
    ['brand-pasta', { brandId: 'brand-pasta', brandName: 'Craft Pasta Lab', conceptCategory: 'PASTA', colorBadge: '#10b981' }],
  ]);

  /**
   * Routes incoming order to the appropriate virtual brand and kitchen station.
   */
  public routeOrder(brandId: string, transaction: POSTransaction): RoutedGhostKitchenOrder {
    const brand = this.brands.get(brandId) || this.brands.get('brand-pizza')!;

    let targetKDSStation: RoutedGhostKitchenOrder['targetKDSStation'] = 'PIZZA_LINE';
    if (brand.conceptCategory === 'WINGS') {
      targetKDSStation = 'WING_FRYER';
    } else if (brand.conceptCategory === 'PASTA') {
      targetKDSStation = 'PASTA_STATION';
    }

    return {
      orderId: transaction.id,
      brand,
      transaction,
      targetKDSStation,
      timestamp: new Date().toISOString(),
    };
  }
}
