import { createDemoState } from '../data/demo-data';
import {
  allocatedQuantity,
  allocationLots,
  exceedsPlan,
  isValidQuantity,
  laborCost,
  materialCost,
  profitability,
  recommendedPendingCosts,
  originalBudget,
  stockForProduct,
} from './calculations';
import { InventoryMovement } from './models';
import { DemoStore } from '../services/demo-store.service';

describe('reglas críticas FRAESPA', () => {
  it('A: ningún producto parte con stock físico negativo', () => {
    const state = createDemoState();
    expect(
      state.products
        .map((item) => ({ code: item.code, stock: stockForProduct(item, state.movements) }))
        .filter((item) => item.stock < 0),
    ).toEqual([]);
  });

  it('B y C: los vales multítem tienen un solo movimiento histórico por línea', () => {
    const state = createDemoState();
    const voucher = state.vouchers.find((item) => item.number === 'V-00091')!;
    expect(voucher.lines.length).toBe(3);
    expect(
      voucher.lines.every(
        (line) =>
          state.movements.filter((movement) => movement.id === line.sourceMovementId).length === 1,
      ),
    ).toBe(true);
  });

  it('E y G: una devolución parcial revierte el lote y costo histórico, no el costo vigente', () => {
    const state = createDemoState();
    const source = state.movements.find((item) => item.id === 'm1')!;
    const returned: InventoryMovement = {
      id: 'return',
      createdAt: '2026-11-04',
      type: 'Devolución',
      productId: source.productId,
      quantity: 2,
      stockDelta: 2,
      allocationDelta: -2,
      unitCost: source.unitCost,
      workOrderId: source.workOrderId,
      reference: 'DEV',
      user: 'Test',
      sourceMovementId: source.id,
    };
    state.products.find((item) => item.id === source.productId)!.unitCost = 99999;
    expect(materialCost('ot-125', [...state.movements, returned])).toBe(
      materialCost('ot-125', state.movements) - 2 * source.unitCost,
    );
    expect(
      allocationLots('ot-125', source.productId, [...state.movements, returned]).find(
        (lot) => lot.movement.id === source.id,
      )?.remainingQuantity,
    ).toBe(source.quantity - 2);
  });

  it('F: transferir cambia asignaciones sin cambiar stock físico total', () => {
    const state = createDemoState();
    const product = state.products.find((item) => item.id === 'DIS0011')!;
    const before = stockForProduct(product, state.movements);
    const pair: InventoryMovement[] = [
      {
        id: 'out',
        createdAt: '',
        type: 'Transferencia salida',
        productId: product.id,
        quantity: 1,
        stockDelta: 0,
        allocationDelta: -1,
        unitCost: 750,
        workOrderId: 'ot-125',
        relatedWorkOrderId: 'ot-128',
        reference: 'TR',
        user: 'Test',
        sourceMovementId: 'm1',
      },
      {
        id: 'in',
        createdAt: '',
        type: 'Transferencia entrada',
        productId: product.id,
        quantity: 1,
        stockDelta: 0,
        allocationDelta: 1,
        unitCost: 750,
        workOrderId: 'ot-128',
        relatedWorkOrderId: 'ot-125',
        reference: 'TR',
        user: 'Test',
        sourceMovementId: 'out',
      },
    ];
    expect(stockForProduct(product, [...state.movements, ...pair])).toBe(before);
    expect(allocatedQuantity('ot-125', product.id, [...state.movements, ...pair])).toBe(
      allocatedQuantity('ot-125', product.id, state.movements) - 1,
    );
  });

  it('H: el exceso se advierte y las cantidades inválidas se rechazan por separado', () => {
    const state = createDemoState();
    const result = exceedsPlan(
      state.workOrders.find((item) => item.id === 'ot-125')!,
      'DIS0011',
      5,
      state.movements,
    );
    expect(result).toEqual({ exceeds: true, by: 3, after: 13, planned: 10 });
    expect([0, -1, Number.NaN, Infinity].every((value) => !isValidQuantity(value))).toBe(true);
  });

  it('I: las horas por trabajador actualizan el costo laboral con su tarifa histórica', () => {
    const state = createDemoState();
    const order = state.workOrders.find((item) => item.id === 'ot-125')!;
    const base = laborCost(order, state.timeEntries);
    const extra = { ...state.timeEntries[0], id: 'new', hours: 2, hourlyCost: 15000 };
    expect(laborCost(order, [...state.timeEntries, extra])).toBe(base + 30000);
  });

  it('J: una entrada de inventario incrementa stock pero nunca consumo de OT', () => {
    const state = createDemoState();
    const product = state.products[0];
    const entry: InventoryMovement = {
      id: 'entry',
      createdAt: '',
      type: 'Ingreso',
      productId: product.id,
      quantity: 7,
      stockDelta: 7,
      allocationDelta: 0,
      unitCost: 1234,
      reference: 'OC-1',
      user: 'Test',
    };
    expect(stockForProduct(product, [...state.movements, entry])).toBe(
      stockForProduct(product, state.movements) + 7,
    );
    expect(materialCost('ot-125', [...state.movements, entry])).toBe(
      materialCost('ot-125', state.movements),
    );
  });

  it('K: una OT sin precio no inventa rentabilidad', () => {
    const state = createDemoState();
    const order = state.workOrders.find((item) => item.salePrice === null)!;
    const result = profitability(order, state.movements, state.timeEntries);
    expect(result.income).toBeNull();
    expect(result.projectedMargin).toBeNull();
    expect(result.risk).toBe('Sin datos');
  });

  it('L: terminar operativamente no confirma resultado final sin cierre económico', () => {
    const state = createDemoState();
    const order = {
      ...state.workOrders.find((item) => item.salePrice !== null)!,
      status: 'Terminada' as const,
      economicStatus: 'Pendiente de conciliación' as const,
    };
    expect(
      profitability(order, state.movements, state.timeEntries).finalManagementResult,
    ).toBeNull();
  });

  it('M: el consolidado usa exactamente los mismos resultados que rentabilidad', () => {
    const state = createDemoState();
    const financial = state.workOrders.filter((item) => item.salePrice !== null);
    const results = financial.map((item) =>
      profitability(item, state.movements, state.timeEntries),
    );
    expect(results.reduce((sum, item) => sum + item.projectedFinalCost, 0)).toBe(
      financial.reduce(
        (sum, item) =>
          sum + profitability(item, state.movements, state.timeEntries).projectedFinalCost,
        0,
      ),
    );
  });

  it('N: una OT dentro del presupuesto mantiene su costo proyectado sin duplicar entregas u horas', () => {
    const state = createDemoState();
    const order = structuredClone(state.workOrders.find((item) => item.id === 'ot-125')!);
    order.pendingCosts = recommendedPendingCosts(order, state.movements, state.timeEntries);
    const base = profitability(order, state.movements, state.timeEntries);
    expect(base.projectedFinalCost).toBe(originalBudget(order));

    const delivery: InventoryMovement = {
      id: 'within-budget-delivery',
      createdAt: '2026-11-04T12:00:00',
      type: 'Despacho',
      productId: 'DIS0011',
      quantity: 1,
      stockDelta: -1,
      allocationDelta: 1,
      unitCost: 750,
      workOrderId: order.id,
      reference: 'TEST',
      user: 'Test',
    };
    const movements = [...state.movements, delivery];
    order.pendingCosts = recommendedPendingCosts(order, movements, state.timeEntries);
    const after = profitability(order, movements, state.timeEntries);
    expect(after.accumulatedCost).toBe(base.accumulatedCost + 750);
    expect(after.projectedFinalCost).toBe(originalBudget(order));
    expect(after.additionalCost).toBe(0);
  });

  it('O: una OT que realmente excede una categoría proyecta costo adicional', () => {
    const state = createDemoState();
    const order = structuredClone(state.workOrders.find((item) => item.id === 'ot-125')!);
    const overrun: InventoryMovement = {
      id: 'real-overrun',
      createdAt: '2026-11-04T12:00:00',
      type: 'Despacho',
      productId: 'PNT0102',
      quantity: 40,
      stockDelta: -40,
      allocationDelta: 40,
      unitCost: 24990,
      workOrderId: order.id,
      reference: 'TEST',
      user: 'Test',
    };
    const movements = [...state.movements, overrun];
    order.pendingCosts = recommendedPendingCosts(order, movements, state.timeEntries);
    const result = profitability(order, movements, state.timeEntries);
    expect(result.projectedFinalCost).toBeGreaterThan(originalBudget(order));
    expect(result.additionalCost).toBeGreaterThan(0);
  });

  it('P: las horas demostrativas se distribuyen en jornadas de hasta ocho horas', () => {
    const state = createDemoState();
    expect(state.timeEntries.every((entry) => entry.hours > 0 && entry.hours <= 8)).toBe(true);
  });

  it('Q: OT-125 coincide con el costo estimado comercial de $2.200.000', () => {
    const state = createDemoState();
    const order = state.workOrders.find((item) => item.id === 'ot-125')!;
    const agreement = state.agreements.find((item) => item.id === order.agreementId)!;
    expect(originalBudget(order)).toBe(2200000);
    expect(originalBudget(order)).toBe(agreement.estimatedCost);
  });

  it('R y S: el estado completo se serializa y restaura para repetir la demo', () => {
    const state = createDemoState();
    const restored = JSON.parse(JSON.stringify(state));
    expect(restored.schemaVersion).toBe(3);
    expect(restored.requests[0].lines.length).toBeGreaterThan(1);
    expect(restored.pendingOperations).toEqual([]);
  });
});

async function readyStore(): Promise<DemoStore> {
  localStorage.clear();
  const store = new DemoStore();
  for (let attempt = 0; attempt < 50 && !store.ready(); attempt += 1)
    await new Promise((resolve) => setTimeout(resolve, 5));
  expect(store.ready()).toBe(true);
  store.restoreDemo();
  return store;
}

describe('flujos integrados de la demo', () => {
  beforeEach(() => localStorage.clear());

  it('B, C y D: un despacho multítem descuenta una sola vez y conserva el saldo parcial', async () => {
    const store = await readyStore();
    const beforeLija = store.stock('DIS0011');
    const beforeCinta = store.stock('CIN0010');
    const requestId = store.createRequest({
      workOrderId: 'ot-125',
      requester: 'Jhony',
      receiver: 'Carlos',
      stage: 'Preparación y lijado',
      note: 'Prueba',
      excessJustification: 'Prueba controlada de entrega parcial',
      lines: [
        { productId: 'DIS0011', quantity: 2 },
        { productId: 'CIN0010', quantity: 1 },
      ],
    });
    const request = store.state().requests.find((item) => item.id === requestId)!;
    const number = store.dispatchRequest(
      requestId,
      [
        { lineId: request.lines[0].id, quantity: 1 },
        { lineId: request.lines[1].id, quantity: 1 },
      ],
      'Carlos',
    );
    expect(store.state().vouchers.find((item) => item.number === number)?.lines).toHaveLength(2);
    expect(store.stock('DIS0011')).toBe(beforeLija - 1);
    expect(store.stock('CIN0010')).toBe(beforeCinta - 1);
    expect(store.state().requests.find((item) => item.id === requestId)?.status).toBe('Parcial');
    expect(
      store.state().requests.find((item) => item.id === requestId)?.lines[0].deliveredQuantity,
    ).toBe(1);
  });

  it('A: rechaza dos líneas del mismo producto cuando su suma excede el stock', async () => {
    const store = await readyStore();
    const beforeStock = store.stock('DIS0011');
    const beforeMovements = store.state().movements.length;
    const each = Math.floor(beforeStock / 2) + 1;
    const requestId = store.createRequest({
      workOrderId: 'ot-125',
      requester: 'Jhony',
      receiver: 'Jhony',
      stage: 'Preparación y lijado',
      note: 'Prueba de stock agregado',
      excessJustification: 'Prueba automatizada controlada',
      lines: [
        { productId: 'DIS0011', quantity: each },
        { productId: 'DIS0011', quantity: each },
      ],
    });
    const request = store.state().requests.find((item) => item.id === requestId)!;
    expect(() =>
      store.dispatchRequest(requestId, [
        { lineId: request.lines[0].id, quantity: each },
        { lineId: request.lines[1].id, quantity: each },
      ]),
    ).toThrow(/líneas suman/);
    expect(store.stock('DIS0011')).toBe(beforeStock);
    expect(store.state().movements.length).toBe(beforeMovements);
  });

  it('E y G: devolver desde un vale usa el costo histórico aunque cambie el precio vigente', async () => {
    const store = await readyStore();
    const beforeStock = store.stock('DIS0011');
    const beforeCost = materialCost('ot-125', store.state().movements);
    const sourceCost = store
      .state()
      .vouchers.find((item) => item.number === 'V-00091')!
      .lines.find((line) => line.productId === 'DIS0011')!.unitCost;
    store.registerInventoryEntry('DIS0011', 1, sourceCost * 8, 'OC-PRECIO-NUEVO');
    store.returnMaterial('ot-125', 'DIS0011', 1, 'V-00091');
    expect(store.stock('DIS0011')).toBe(beforeStock + 2);
    expect(materialCost('ot-125', store.state().movements)).toBe(beforeCost - sourceCost);
  });

  it('F: una transferencia cambia asignaciones sin tocar el stock', async () => {
    const store = await readyStore();
    const stock = store.stock('DIS0011');
    const from = store.allocated('ot-125', 'DIS0011');
    const to = store.allocated('ot-128', 'DIS0011');
    store.transferMaterial('ot-125', 'ot-128', 'DIS0011', 1);
    expect(store.stock('DIS0011')).toBe(stock);
    expect(store.allocated('ot-125', 'DIS0011')).toBe(from - 1);
    expect(store.allocated('ot-128', 'DIS0011')).toBe(to + 1);
  });

  it('I: registrar horas agrega costo laboral sin duplicar el mismo parte', async () => {
    const store = await readyStore();
    const stage = store.order('ot-125')!.stages[0];
    const before = store.profitability('ot-125')!.labor;
    const projectedBefore = store.profitability('ot-125')!.projectedFinalCost;
    store.recordHours('ot-125', stage.id, 'emp-jhony', '2026-11-04', 1.5, 'Extra');
    expect(store.profitability('ot-125')!.labor).toBeGreaterThan(before);
    expect(store.profitability('ot-125')!.projectedFinalCost).toBe(projectedBefore);
    expect(() =>
      store.recordHours('ot-125', stage.id, 'emp-jhony', '2026-11-04', 1.5, 'Extra'),
    ).toThrow(/ya existe/);
  });

  it('N: un ingreso aprobado se convierte en una OT vinculada una sola vez', async () => {
    const store = await readyStore();
    const code = store.registerIntake({
      agreementId: 'agr-multi',
      client: 'Buses Costa Norte',
      vehicle: 'TEST99',
      brand: 'Marcopolo',
      model: 'G8',
    });
    const intake = store.state().intakes.find((item) => item.code === code)!;
    const orderId = store.createWorkOrderFromIntake({
      intakeId: intake.id,
      service: 'Pintura',
      dueDate: '2026-12-01',
      assignedWorkers: ['Jhony'],
      template: 'Pintura',
    });
    expect(store.order(orderId)?.intakeId).toBe(intake.id);
    expect(store.state().intakes.find((item) => item.id === intake.id)?.workOrderId).toBe(orderId);
    expect(() =>
      store.createWorkOrderFromIntake({
        intakeId: intake.id,
        service: 'Pintura',
        dueDate: '2026-12-01',
        assignedWorkers: ['Jhony'],
        template: 'Pintura',
      }),
    ).toThrow(/ya tiene una OT/);
  });

  it('P: el selector de rol cambia la visibilidad demostrativa sin fingir autenticación', async () => {
    const store = await readyStore();
    store.setRole('Trabajador');
    expect(store.state().role).toBe('Trabajador');
    store.setRole('Gerente');
    expect(store.state().role).toBe('Gerente');
  });
});
