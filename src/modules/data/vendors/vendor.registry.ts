/**
 * Registry for data import vendors
 */

import type { IDataVendor, VendorId } from './vendor.types';


/**
 * Global registry of data import vendors
 */
const _vendorRegistry = new Map<VendorId, IDataVendor>();


/**
 * Register a data import vendor
 */
export function registerDataVendor(vendor: IDataVendor): void {
  if (_vendorRegistry.has(vendor.id)) {
    console.warn(`[Data Import] Vendor ${vendor.id} is already registered`);
    return;
  }
  _vendorRegistry.set(vendor.id, vendor);
}


/**
 * Get a vendor by ID
 */
export function getDataVendor(vendorId: VendorId): IDataVendor | null {
  return _vendorRegistry.get(vendorId) || null;
}


/**
 * Get all registered vendors
 */
export function getAllDataVendors(): IDataVendor[] {
  return Array.from(_vendorRegistry.values());
}


/**
 * Check if a vendor is registered
 */
export function hasDataVendor(vendorId: VendorId): boolean {
  return _vendorRegistry.has(vendorId);
}
