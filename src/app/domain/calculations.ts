import { InventoryMovement, Product, Profitability, WorkOrder } from './models';

export function stockForProduct(product: Product, movements: InventoryMovement[]): number {
  return product.openingStock + movements.filter((movement) => movement.productId === product.id).reduce((sum, movement) => sum + movement.stockDelta, 0);
}

export function allocatedQuantity(workOrderId: string, productId: string, movements: InventoryMovement[]): number {
  return movements
    .filter((movement) => movement.workOrderId === workOrderId && movement.productId === productId)
    .reduce((sum, movement) => sum + movement.allocationDelta, 0);
}

export function materialCost(workOrderId: string, movements: InventoryMovement[]): number {
  return movements
    .filter((movement) => movement.workOrderId === workOrderId)
    .reduce((sum, movement) => sum + movement.allocationDelta * movement.unitCost, 0);
}

export function laborCost(order: WorkOrder): number {
  return order.stages.reduce((sum, stage) => sum + stage.actualHours * order.laborRate, 0);
}

export function profitability(order: WorkOrder, movements: InventoryMovement[]): Profitability {
  const income = order.salePrice === null ? null : order.salePrice + order.approvedExtras - order.discounts + order.commercialAdjustments;
  const materials = materialCost(order.id, movements);
  const labor = laborCost(order);
  const directCost = materials + labor + order.externalServicesActual + order.otherDirectActual;
  const productionCost = directCost + order.productionOverheadActual;
  const managementResult = income === null ? null : income - productionCost - order.adminActual;
  const contributionMargin = income === null ? null : income - directCost;
  const projectedFinalCost = productionCost + order.adminActual + order.pendingCostEstimate;
  const projectedMargin = income === null ? null : income - projectedFinalCost;
  const projectedMarginPct = income && projectedMargin !== null ? projectedMargin / income : null;
  const risk = projectedMargin === null ? 'Sin datos' : projectedMargin < 0 ? 'Crítico' : projectedMarginPct !== null && projectedMarginPct < 0.12 ? 'Atención' : 'Saludable';
  return { income, materials, labor, directCost, productionCost, managementResult, contributionMargin, projectedFinalCost, projectedMargin, projectedMarginPct, risk };
}

export function exceedsPlan(order: WorkOrder, productId: string, requested: number, movements: InventoryMovement[]): { exceeds: boolean; by: number; after: number; planned: number } {
  const planned = order.materialPlan.find((line) => line.productId === productId)?.estimatedQty ?? 0;
  const after = allocatedQuantity(order.id, productId, movements) + requested;
  return { exceeds: after > planned, by: Math.max(0, after - planned), after, planned };
}

export function formatClp(value: number | null): string {
  if (value === null) return 'No disponible';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
}

