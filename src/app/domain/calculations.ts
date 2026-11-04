import {
  InventoryMovement,
  PendingCostBreakdown,
  Product,
  Profitability,
  TimeEntry,
  WorkOrder,
} from './models';

const MONEY_PRECISION = 100;
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * MONEY_PRECISION) / MONEY_PRECISION;
export const isValidQuantity = (value: number): boolean => Number.isFinite(value) && value > 0;

export function stockForProduct(product: Product, movements: InventoryMovement[]): number {
  return roundMoney(
    product.openingStock +
      movements
        .filter((movement) => movement.productId === product.id)
        .reduce((sum, movement) => sum + movement.stockDelta, 0),
  );
}

export function allocatedQuantity(
  workOrderId: string,
  productId: string,
  movements: InventoryMovement[],
): number {
  return roundMoney(
    movements
      .filter(
        (movement) => movement.workOrderId === workOrderId && movement.productId === productId,
      )
      .reduce((sum, movement) => sum + movement.allocationDelta, 0),
  );
}

export function materialCost(workOrderId: string, movements: InventoryMovement[]): number {
  return roundMoney(
    movements
      .filter((movement) => movement.workOrderId === workOrderId)
      .reduce((sum, movement) => sum + movement.allocationDelta * movement.unitCost, 0),
  );
}

export function allocationLots(
  workOrderId: string,
  productId: string,
  movements: InventoryMovement[],
): Array<{ movement: InventoryMovement; remainingQuantity: number }> {
  const lots = movements
    .filter(
      (movement) =>
        movement.workOrderId === workOrderId &&
        movement.productId === productId &&
        movement.allocationDelta > 0,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return lots
    .map((movement) => {
      const consumed = movements
        .filter(
          (candidate) =>
            candidate.sourceMovementId === movement.id && candidate.allocationDelta < 0,
        )
        .reduce((sum, candidate) => sum + Math.abs(candidate.allocationDelta), 0);
      return {
        movement,
        remainingQuantity: roundMoney(Math.max(0, movement.allocationDelta - consumed)),
      };
    })
    .filter((lot) => lot.remainingQuantity > 0);
}

export function laborCost(order: WorkOrder, timeEntries: TimeEntry[] = []): number {
  const orderEntries = timeEntries.filter((entry) => entry.workOrderId === order.id);
  if (orderEntries.length)
    return roundMoney(orderEntries.reduce((sum, entry) => sum + entry.hours * entry.hourlyCost, 0));
  return roundMoney(
    order.stages.reduce((sum, stage) => sum + stage.actualHours * order.laborRate, 0),
  );
}

export function originalBudget(order: WorkOrder): number {
  return roundMoney(
    order.materialBudget +
      order.laborBudget +
      order.serviceBudget +
      order.otherDirectBudget +
      order.productionOverheadBudget +
      order.adminBudget,
  );
}

export function actualCostBreakdown(
  order: WorkOrder,
  movements: InventoryMovement[],
  timeEntries: TimeEntry[] = [],
): Omit<PendingCostBreakdown, 'updatedAt' | 'explanation' | 'source'> {
  return {
    materials: materialCost(order.id, movements),
    labor: laborCost(order, timeEntries),
    externalServices: roundMoney(order.externalServicesActual),
    otherDirect: roundMoney(order.otherDirectActual),
    productionOverhead: roundMoney(order.productionOverheadActual),
    administration: roundMoney(order.adminActual),
  };
}

export function recommendedPendingCosts(
  order: WorkOrder,
  movements: InventoryMovement[],
  timeEntries: TimeEntry[] = [],
  updatedAt = new Date().toISOString(),
): PendingCostBreakdown {
  const actual = actualCostBreakdown(order, movements, timeEntries);
  return {
    materials: roundMoney(Math.max(0, order.materialBudget - actual.materials)),
    labor: roundMoney(Math.max(0, order.laborBudget - actual.labor)),
    externalServices: roundMoney(Math.max(0, order.serviceBudget - actual.externalServices)),
    otherDirect: roundMoney(Math.max(0, order.otherDirectBudget - actual.otherDirect)),
    productionOverhead: roundMoney(
      Math.max(0, order.productionOverheadBudget - actual.productionOverhead),
    ),
    administration: roundMoney(Math.max(0, order.adminBudget - actual.administration)),
    updatedAt,
    explanation:
      'Saldo estimado por categoría: presupuesto original menos costo acumulado, sin volver a sumar gastos ya registrados.',
    source: 'Recalculado desde presupuesto',
  };
}

export function pendingCostTotal(pending?: PendingCostBreakdown): number {
  if (!pending) return 0;
  return roundMoney(
    pending.materials +
      pending.labor +
      pending.externalServices +
      pending.otherDirect +
      pending.productionOverhead +
      pending.administration,
  );
}

export function stageHours(orderId: string, stageId: string, timeEntries: TimeEntry[]): number {
  return roundMoney(
    timeEntries
      .filter((entry) => entry.workOrderId === orderId && entry.stageId === stageId)
      .reduce((sum, entry) => sum + entry.hours, 0),
  );
}

export function profitability(
  order: WorkOrder,
  movements: InventoryMovement[],
  timeEntries: TimeEntry[] = [],
): Profitability {
  const income =
    order.salePrice === null
      ? null
      : roundMoney(
          order.salePrice + order.approvedExtras - order.discounts + order.commercialAdjustments,
        );
  const orderMovements = movements.filter((movement) => movement.workOrderId === order.id);
  const materialsDelivered = roundMoney(
    orderMovements
      .filter((movement) => movement.allocationDelta > 0)
      .reduce((sum, movement) => sum + movement.allocationDelta * movement.unitCost, 0),
  );
  const materialsRecovered = roundMoney(
    orderMovements
      .filter((movement) => movement.allocationDelta < 0)
      .reduce((sum, movement) => sum + Math.abs(movement.allocationDelta * movement.unitCost), 0),
  );
  const materials = roundMoney(materialsDelivered - materialsRecovered);
  const labor = laborCost(order, timeEntries);
  const directCost = roundMoney(
    materials + labor + order.externalServicesActual + order.otherDirectActual,
  );
  const productionCost = roundMoney(directCost + order.productionOverheadActual);
  const managementResult =
    income === null ? null : roundMoney(income - productionCost - order.adminActual);
  const contributionMargin = income === null ? null : roundMoney(income - directCost);
  const accumulatedCost = roundMoney(productionCost + order.adminActual);
  const budget = originalBudget(order);
  const pendingCost = order.pendingCosts
    ? pendingCostTotal(order.pendingCosts)
    : roundMoney(order.pendingCostEstimate);
  const projectedFinalCost = roundMoney(accumulatedCost + pendingCost);
  const additionalCost = roundMoney(Math.max(0, projectedFinalCost - budget));
  const projectedMargin = income === null ? null : roundMoney(income - projectedFinalCost);
  const projectedMarginPct =
    income !== null && income > 0 && projectedMargin !== null ? projectedMargin / income : null;
  const economicallyClosed = order.economicStatus === 'Cerrada económicamente';
  const finalManagementResult = economicallyClosed ? managementResult : null;
  const finalMarginPct =
    economicallyClosed && income !== null && income > 0 && finalManagementResult !== null
      ? finalManagementResult / income
      : null;
  const risk =
    projectedMargin === null
      ? 'Sin datos'
      : projectedMargin < 0
        ? 'Crítico'
        : projectedMarginPct !== null && projectedMarginPct < 0.12
          ? 'Atención'
          : 'Saludable';
  return {
    income,
    materials,
    materialsDelivered,
    materialsRecovered,
    labor,
    directCost,
    productionCost,
    managementResult,
    finalManagementResult,
    finalMarginPct,
    contributionMargin,
    originalBudget: budget,
    accumulatedCost,
    pendingCost,
    additionalCost,
    projectedFinalCost,
    projectedMargin,
    projectedMarginPct,
    risk,
  };
}

export function exceedsPlan(
  order: WorkOrder,
  productId: string,
  requested: number,
  movements: InventoryMovement[],
  pendingRequested = 0,
): { exceeds: boolean; by: number; after: number; planned: number } {
  const planned =
    order.materialPlan.find((line) => line.productId === productId)?.estimatedQty ?? 0;
  const after = roundMoney(
    allocatedQuantity(order.id, productId, movements) + requested + pendingRequested,
  );
  return { exceeds: after > planned, by: roundMoney(Math.max(0, after - planned)), after, planned };
}

export function formatClp(value: number | null): string {
  if (value === null) return 'No disponible';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}
