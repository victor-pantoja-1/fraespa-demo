import { createDemoState } from '../data/demo-data';
import { allocatedQuantity, exceedsPlan, laborCost, materialCost, profitability, stockForProduct } from './calculations';
import { InventoryMovement } from './models';

describe('critical FRAESPA business rules', () => {
  it('calculates physical stock from opening balance and movements', () => {
    const state = createDemoState();
    const product = state.products.find((item) => item.id === 'DIS0011')!;
    expect(stockForProduct(product, state.movements)).toBe(product.openingStock - 8 - 28 - 24);
  });

  it('values voucher allocations at the historical movement cost', () => {
    const state = createDemoState();
    expect(materialCost('ot-125', state.movements)).toBeCloseTo(8 * 750 + 4 * 1760 + 0.8 * 33694 + 0.5 * 119990, 2);
  });

  it('a usable return increases stock and reduces OT allocation', () => {
    const state = createDemoState();
    const returned: InventoryMovement = { id: 'return', createdAt: '', type: 'Devolución', productId: 'DIS0011', quantity: 2, stockDelta: 2, allocationDelta: -2, unitCost: 750, workOrderId: 'ot-125', reference: 'DEV', user: 'Test' };
    const movements = [...state.movements, returned];
    expect(allocatedQuantity('ot-125', 'DIS0011', movements)).toBe(6);
    expect(stockForProduct(state.products.find((item) => item.id === 'DIS0011')!, movements)).toBe(9);
  });

  it('a transfer changes allocations without duplicating physical stock', () => {
    const state = createDemoState();
    const product = state.products.find((item) => item.id === 'DIS0011')!;
    const before = stockForProduct(product, state.movements);
    const pair: InventoryMovement[] = [
      { id: 'out', createdAt: '', type: 'Transferencia salida', productId: 'DIS0011', quantity: 1, stockDelta: 0, allocationDelta: -1, unitCost: 750, workOrderId: 'ot-125', relatedWorkOrderId: 'ot-128', reference: 'TR', user: 'Test' },
      { id: 'in', createdAt: '', type: 'Transferencia entrada', productId: 'DIS0011', quantity: 1, stockDelta: 0, allocationDelta: 1, unitCost: 750, workOrderId: 'ot-128', relatedWorkOrderId: 'ot-125', reference: 'TR', user: 'Test' },
    ];
    expect(stockForProduct(product, [...state.movements, ...pair])).toBe(before);
    expect(allocatedQuantity('ot-125', 'DIS0011', [...state.movements, ...pair])).toBe(7);
  });

  it('warns when a request would exceed the material plan', () => {
    const state = createDemoState();
    const result = exceedsPlan(state.workOrders.find((item) => item.id === 'ot-125')!, 'DIS0011', 5, state.movements);
    expect(result).toEqual({ exceeds: true, by: 3, after: 13, planned: 10 });
  });

  it('calculates direct labor from recorded hours and the OT rate', () => {
    const order = createDemoState().workOrders.find((item) => item.id === 'ot-125')!;
    expect(laborCost(order)).toBe(71 * 12000);
  });

  it('keeps accumulated cost separate from projected final cost', () => {
    const state = createDemoState();
    const order = state.workOrders.find((item) => item.id === 'ot-125')!;
    const result = profitability(order, state.movements);
    expect(result.projectedFinalCost).toBe(result.productionCost + order.adminActual + order.pendingCostEstimate);
    expect(result.projectedMargin).toBe((result.income ?? 0) - result.projectedFinalCost);
  });

  it('round-trips the complete demo state for local persistence', () => {
    const state = createDemoState();
    const restored = JSON.parse(JSON.stringify(state));
    expect(restored.workOrders.length).toBe(state.workOrders.length);
    expect(restored.movements[0].unitCost).toBe(state.movements[0].unitCost);
    expect(restored.agreements[0].quoteNumber).toBe('COT-2026-041');
  });
});
