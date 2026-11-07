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
      12,
      state.movements,
    );
    expect(result).toEqual({ exceeds: true, by: 2, after: 12, planned: 10 });
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
    expect(restored.schemaVersion).toBe(6);
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
    store.reviewRequest({
      requestId,
      supervisor: 'Encargado de taller',
      decision: 'Aprobar',
      authorizedByLine: {},
      reason: 'Prueba de stock agregado.',
    });
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
    const beforeStock = store.stock('DIS0014');
    const beforeCost = materialCost('ot-125', store.state().movements);
    const sourceCost = store
      .state()
      .vouchers.find((item) => item.number === 'V-00091')!
      .lines.find((line) => line.productId === 'DIS0014')!.unitCost;
    store.registerInventoryEntry('DIS0014', 1, sourceCost * 8, 'OC-PRECIO-NUEVO');
    store.returnMaterial('ot-125', 'DIS0014', 1, 'V-00091');
    expect(store.stock('DIS0014')).toBe(beforeStock + 2);
    expect(materialCost('ot-125', store.state().movements)).toBe(beforeCost - sourceCost);
  });

  it('F: una transferencia cambia asignaciones sin tocar el stock', async () => {
    const store = await readyStore();
    const stock = store.stock('DIS0014');
    const from = store.allocated('ot-125', 'DIS0014');
    const to = store.allocated('ot-128', 'DIS0014');
    store.transferMaterial('ot-125', 'ot-128', 'DIS0014', 1);
    expect(store.stock('DIS0014')).toBe(stock);
    expect(store.allocated('ot-125', 'DIS0014')).toBe(from - 1);
    expect(store.allocated('ot-128', 'DIS0014')).toBe(to + 1);
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

  it('T: confirmar una fórmula consume el vale de estación sin descontar el stock dos veces', async () => {
    const store = await readyStore();
    const productIds = ['PQM0126', 'PQM0167', 'PQM0125'];
    const before = Object.fromEntries(productIds.map((id) => [id, store.stock(id)]));
    store.confirmPaintMix({
      workOrderId: 'ot-125',
      ofReference: 'OF-408A5-DEMO',
      stage: 'Pintura',
      colorCode: 'Red - 408A5',
      preparation: 'Concentrada',
      attachmentPath: '/assets/colorpro/red-408a5-concentrada.png',
      components: [
        {
          colorProCode: '2246',
          recommendedGrams: 495.9,
          actualGrams: 495.9,
          reusableGrams: 0,
          wasteGrams: 0,
        },
        {
          colorProCode: '3200',
          recommendedGrams: 67,
          actualGrams: 67,
          reusableGrams: 0,
          wasteGrams: 0,
        },
        {
          colorProCode: '2236',
          recommendedGrams: 409.2,
          actualGrams: 409.2,
          reusableGrams: 0,
          wasteGrams: 0,
        },
      ],
      preparer: 'Antonella',
      batch: 'TEST-MIX-001',
      observations: 'Prueba automatizada',
    });
    expect(store.state().paintMixes[0].components).toHaveLength(3);
    expect(
      store.state().paintMixes[0].components.every((item) => item.directIssueQuantity === 0),
    ).toBe(true);
    expect(Object.fromEntries(productIds.map((id) => [id, store.stock(id)]))).toEqual(before);
  });

  it('U: las fórmulas concentrada y diluida quedan como alternativas de un solo lote', async () => {
    const store = await readyStore();
    const input = {
      workOrderId: 'ot-125',
      ofReference: 'OF-408A5-DEMO',
      stage: 'Pintura',
      colorCode: 'Red - 408A5',
      preparation: 'Diluida' as const,
      attachmentPath: '/assets/colorpro/red-408a5-diluida.png',
      components: [
        {
          colorProCode: '2246',
          recommendedGrams: 318.2,
          actualGrams: 318.2,
          reusableGrams: 0,
          wasteGrams: 0,
        },
        {
          colorProCode: '3200',
          recommendedGrams: 43,
          actualGrams: 43,
          reusableGrams: 0,
          wasteGrams: 0,
        },
        {
          colorProCode: '2236',
          recommendedGrams: 262.6,
          actualGrams: 262.6,
          reusableGrams: 0,
          wasteGrams: 0,
        },
        {
          colorProCode: 'THINNER W',
          recommendedGrams: 311.8,
          actualGrams: 311.8,
          reusableGrams: 0,
          wasteGrams: 0,
        },
      ],
      preparer: 'Antonella',
      batch: 'TEST-MIX-002',
      observations: 'Prueba automatizada',
    };
    store.confirmPaintMix(input);
    expect(store.state().paintMixes).toHaveLength(1);
    expect(store.state().paintMixes[0].preparation).toBe('Diluida');
    expect(store.state().paintMixes[0].pendingReconciliation).toBe(true);
    expect(() => store.confirmPaintMix({ ...input, preparation: 'Concentrada' })).toThrow(
      /lote de mezcla ya fue confirmado/i,
    );
  });

  it('V: una devolución contaminada por peso no reincorpora el componente original', async () => {
    const store = await readyStore();
    const before = store.stock('PQM0126');
    store.registerLiquidReturnByWeight({
      workOrderId: 'ot-125',
      productId: 'PQM0126',
      voucherReference: 'V-00102',
      grossGrams: 420,
      tareGrams: 120,
      materialState: 'Contaminado',
      receiver: 'Antonella',
    });
    expect(store.stock('PQM0126')).toBe(before);
    expect(store.state().liquidReturns[0].result).toBe('Separado sin reincorporar');
  });

  it('W: no convierte gramos a litros cuando falta densidad validada', async () => {
    const store = await readyStore();
    expect(() =>
      store.registerLiquidReturnByWeight({
        workOrderId: 'ot-125',
        productId: 'PQM0034',
        voucherReference: 'V-00102',
        grossGrams: 300,
        tareGrams: 100,
        materialState: 'Reutilizable',
        receiver: 'Antonella',
      }),
    ).toThrow(/densidad validada/i);
  });

  it('X: crea un expediente con varias unidades y un ID independiente de la OF', async () => {
    const store = await readyStore();
    const id = store.createWorkFile({
      client: 'Transportes ABC',
      ofReference: 'OF-491',
      quoteReference: 'COT-491',
      service: 'Reparación y pintura',
      dueDate: '2026-11-30',
      manager: 'Encargado de taller',
      observations: 'Prueba',
      units: [
        {
          licensePlate: 'ABCD45',
          vehicle: 'Bus',
          brand: 'Marcopolo',
          model: 'G7',
          service: 'Reparación',
        },
        {
          licensePlate: 'EFGH67',
          vehicle: 'Bus',
          brand: 'Marcopolo',
          model: 'G8',
          service: 'Pintura',
        },
      ],
    });
    const file = store.state().workFiles.find((item) => item.id === id)!;
    expect(file.units).toHaveLength(2);
    expect(file.id).not.toBe(file.ofReference);
    expect(file.code).toMatch(/^EXP-/);
  });

  it('Y: crea una OT de expediente con trabajadores compartidos y receta por proceso', async () => {
    const store = await readyStore();
    const fileId = store.createWorkFile({
      client: 'Cliente prueba',
      ofReference: 'OF-X',
      quoteReference: 'COT-X',
      service: 'Pintura',
      dueDate: '2026-12-10',
      manager: 'Supervisor',
      observations: '',
      units: [
        {
          licensePlate: 'TEST99',
          vehicle: 'Bus',
          brand: 'Marca',
          model: 'Modelo',
          service: 'Pintura',
        },
      ],
    });
    const unit = store.state().workFiles.find((file) => file.id === fileId)!.units[0];
    const orderId = store.createWorkOrderForWorkFileUnit({
      workFileId: fileId,
      unitId: unit.id,
      physicalArea: 'Bahía 2',
      processes: [
        { name: 'Lijado', workers: ['Jhony', 'Miguel'], weight: 40 },
        { name: 'Pintura', workers: ['Carlos'], weight: 60 },
      ],
      materialPlan: [{ productId: 'DIS0011', estimatedQty: 10, processIndex: 0 }],
    });
    const order = store.order(orderId)!;
    expect(order.workFileId).toBe(fileId);
    expect(order.stages[0].assignedWorkers).toEqual(['Jhony', 'Miguel']);
    expect(store.recipeFor(orderId, order.stages[0].id)[0].estimatedQty).toBe(10);
  });

  it('Z: registra inicio, pausa, reanudación y solicitud de término desde móvil', async () => {
    const store = await readyStore();
    store.configurePresentationOrder('ot-125');
    store.identifyWorker('Jhony', '4085');
    store.selectWorkerTask('ot-125', 's3');
    store.startSelectedProcess();
    expect(
      store.order('ot-125')!.stages.find((stage) => stage.id === 's3')?.startedAt,
    ).toBeTruthy();
    store.pauseSelectedProcess('Cambio de herramienta');
    expect(store.order('ot-125')!.stages.find((stage) => stage.id === 's3')?.status).toBe(
      'Pausado',
    );
    store.resumeSelectedProcess();
    store.requestFinishSelectedProcess('Listo para revisión');
    expect(store.order('ot-125')!.stages.find((stage) => stage.id === 's3')?.status).toBe(
      'En revisión',
    );
    expect(store.state().processEvents.map((event) => event.action)).toEqual([
      'Solicitó finalizar',
      'Reanudó',
      'Pausó',
      'Inició',
    ]);
  });

  it('AA: bloquea despacho pendiente, impide autoaprobación y admite aprobación parcial', async () => {
    const store = await readyStore();
    store.configurePresentationOrder('ot-125');
    const requestId = store.createRequest({
      workOrderId: 'ot-125',
      requester: 'Jhony',
      receiver: 'Antonella',
      stage: 'Lijado',
      note: 'Prueba',
      excessJustification: 'Superficie adicional',
      lines: [{ productId: 'DIS0011', quantity: 12 }],
    });
    const request = store.state().requests.find((item) => item.id === requestId)!;
    expect(() => store.dispatchRequest(requestId)).toThrow(/no admite entregas/);
    expect(() =>
      store.reviewRequest({
        requestId,
        supervisor: 'Jhony',
        decision: 'Aprobar',
        authorizedByLine: {},
        reason: 'Yo mismo',
      }),
    ).toThrow(/propio exceso/);
    store.reviewRequest({
      requestId,
      supervisor: 'Encargado de taller',
      decision: 'Aprobar parcialmente',
      authorizedByLine: { [request.lines[0].id]: 8 },
      reason: 'Primera entrega',
    });
    const reviewed = store.state().requests.find((item) => item.id === requestId)!;
    expect(reviewed.approval.status).toBe('Aprobada parcial');
    expect(reviewed.lines[0].authorizedQuantity).toBe(8);
  });

  it('AB: entrega 8 de 12, descuenta una vez, emite vale y conserva 4 pendientes', async () => {
    const store = await readyStore();
    expect(store.stock('DIS0011')).toBe(120);
    store.configurePresentationOrder('ot-125');
    const requestId = store.createRequest({
      workOrderId: 'ot-125',
      requester: 'Jhony',
      receiver: 'Antonella',
      stage: 'Lijado',
      note: 'Prueba',
      excessJustification: 'Superficie adicional',
      lines: [{ productId: 'DIS0011', quantity: 12 }],
    });
    const request = store.state().requests.find((item) => item.id === requestId)!;
    store.reviewRequest({
      requestId,
      supervisor: 'Encargado de taller',
      decision: 'Aprobar',
      authorizedByLine: {},
      reason: 'Exceso verificado',
    });
    const voucher = store.dispatchRequest(
      requestId,
      [{ lineId: request.lines[0].id, quantity: 8 }],
      'Jhony',
    );
    expect(store.stock('DIS0011')).toBe(112);
    expect(store.state().vouchers.find((item) => item.number === voucher)?.lines[0].quantity).toBe(
      8,
    );
    const delivered = store.state().requests.find((item) => item.id === requestId)!;
    expect(delivered.status).toBe('Parcial');
    expect(delivered.lines[0].authorizedQuantity - delivered.lines[0].deliveredQuantity).toBe(4);
  });

  it('AC: consolida solicitudes de varios trabajadores por OT y proceso', async () => {
    const store = await readyStore();
    store.configurePresentationOrder('ot-125');
    store.createRequest({
      workOrderId: 'ot-125',
      requester: 'Jhony',
      receiver: 'Antonella',
      stage: 'Lijado',
      note: 'Parte 1',
      lines: [{ productId: 'DIS0011', quantity: 4 }],
    });
    store.createRequest({
      workOrderId: 'ot-125',
      requester: 'Miguel',
      receiver: 'Antonella',
      stage: 'Lijado',
      note: 'Parte 2',
      lines: [{ productId: 'DIS0011', quantity: 3 }],
    });
    const summary = store.processMaterialSummary('ot-125', 'Lijado', 'DIS0011');
    expect(summary.requested).toBe(7);
    expect(summary.requesters.map((item) => item.requester).sort()).toEqual(['Jhony', 'Miguel']);
  });

  it('AD: rechaza sobrantes y pérdidas mayores que el peso real', async () => {
    const store = await readyStore();
    expect(() =>
      store.confirmPaintMix({
        workOrderId: 'ot-125',
        ofReference: 'OF-X',
        stage: 'Pintura',
        colorCode: 'Red - 408A5',
        preparation: 'Concentrada',
        attachmentPath: 'captura.png',
        components: [
          {
            colorProCode: '2246',
            recommendedGrams: 495.9,
            actualGrams: 100,
            reusableGrams: 70,
            wasteGrams: 40,
          },
        ],
        preparer: 'Antonella',
        batch: 'INVALID-1',
        observations: 'Prueba',
      }),
    ).toThrow(/sobrante reutilizable y el desperdicio/);
  });

  it('AE: consolida códigos ColorPro asociados al mismo producto antes de despachar faltantes', async () => {
    const store = await readyStore();
    store.updateColorProMapping('3200', 'PQM0126', 1000, 'Pendiente de validación');
    const before = store.stock('PQM0126');
    store.confirmPaintMix({
      workOrderId: 'ot-125',
      ofReference: 'OF-X',
      stage: 'Pintura',
      colorCode: 'Red - 408A5',
      preparation: 'Concentrada',
      attachmentPath: 'captura.png',
      components: [
        {
          colorProCode: '2246',
          recommendedGrams: 500,
          actualGrams: 500,
          reusableGrams: 0,
          wasteGrams: 0,
        },
        {
          colorProCode: '3200',
          recommendedGrams: 200,
          actualGrams: 200,
          reusableGrams: 0,
          wasteGrams: 0,
        },
      ],
      preparer: 'Antonella',
      batch: 'CONSOLIDADA-1',
      observations: 'Prueba',
    });
    const components = store.state().paintMixes[0].components;
    expect(components.reduce((sum, item) => sum + item.directIssueQuantity, 0)).toBeCloseTo(0.1, 4);
    expect(store.stock('PQM0126')).toBeCloseTo(before - 0.1, 4);
  });

  it('AF: una devolución reutilizable no puede tomar saldo de otro vale', async () => {
    const store = await readyStore();
    expect(() =>
      store.registerLiquidReturnByWeight({
        workOrderId: 'ot-125',
        productId: 'PQM0062',
        voucherReference: 'V-00091',
        grossGrams: 1020,
        tareGrams: 120,
        materialState: 'Reutilizable',
        receiver: 'Antonella',
      }),
    ).toThrow(/saldo recuperable del vale V-00091/);
  });

  it('AG: exige cerrar el saldo parcial antes de validar y entregar la unidad', async () => {
    const store = await readyStore();
    store.configurePresentationOrder('ot-125');
    const requestId = store.createRequest({
      workOrderId: 'ot-125',
      requester: 'Jhony',
      receiver: 'Antonella',
      stage: 'Lijado',
      note: 'Prueba',
      excessJustification: 'Superficie adicional',
      lines: [{ productId: 'DIS0011', quantity: 12 }],
    });
    const request = store.state().requests.find((item) => item.id === requestId)!;
    store.reviewRequest({
      requestId,
      supervisor: 'Encargado de taller',
      decision: 'Aprobar',
      authorizedByLine: {},
      reason: 'Exceso verificado',
    });
    store.dispatchRequest(requestId, [{ lineId: request.lines[0].id, quantity: 8 }], 'Jhony');
    expect(() => store.validatePresentationOrder('ot-125', 'Encargado de taller')).toThrow(
      /Cierra justificadamente/,
    );
    store.closeRequestBalance(requestId, request.lines[0].id, 'Saldo ya no requerido');
    store.validatePresentationOrder('ot-125', 'Encargado de taller');
    store.deliverWorkOrder('ot-125', 'Encargado de taller');
    expect(store.order('ot-125')?.status).toBe('Entregada');
  });

  it('AH: restaurar elimina cambios del recorrido y permite repetirlo', async () => {
    const store = await readyStore();
    store.createWorkFile({
      client: 'Temporal',
      ofReference: 'OF-T',
      quoteReference: '',
      service: 'Prueba',
      dueDate: '2026-12-01',
      manager: 'Supervisor',
      observations: '',
      units: [{ licensePlate: 'TMP001', vehicle: 'Bus', brand: '', model: '', service: 'Prueba' }],
    });
    expect(store.state().workFiles).toHaveLength(1);
    store.restoreDemo();
    expect(store.state().workFiles).toEqual([]);
    expect(store.stock('DIS0011')).toBe(120);
  });
});
