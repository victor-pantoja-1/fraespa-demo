import { Injectable, computed, signal } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { createDemoState } from '../data/demo-data';
import {
  allocatedQuantity,
  allocationLots,
  exceedsPlan,
  isValidQuantity,
  profitability,
  recommendedPendingCosts,
  pendingCostTotal,
  roundMoney,
  stageHours,
  stockForProduct,
} from '../domain/calculations';
import {
  AuditEvent,
  ColorProMapping,
  CommercialAgreement,
  DirectCostEntry,
  DemoState,
  InventoryMovement,
  MaterialRequest,
  MaterialRequestLine,
  MaterialVoucher,
  PaintMix,
  PaintPreparation,
  Role,
  TimeEntry,
  VehicleIntake,
  VoucherLine,
  WorkOrder,
} from '../domain/models';

interface StoredState {
  id: string;
  payload: DemoState;
}
interface RequestInput {
  workOrderId: string;
  requester: string;
  receiver: string;
  stage: string;
  lines: Array<{ productId: string; quantity: number; note?: string }>;
  note: string;
  excessJustification?: string;
}
interface DeliveryInput {
  lineId: string;
  quantity: number;
}
interface NewWorkOrderInput {
  intakeId: string;
  service: string;
  dueDate: string;
  assignedWorkers: string[];
  template: 'Pintura' | 'Reparación' | 'Preparación';
}
interface PaintMixInput {
  workOrderId: string;
  ofReference: string;
  stage: string;
  colorCode: string;
  preparation: PaintPreparation;
  attachmentPath: string;
  components: Array<{
    colorProCode: string;
    recommendedGrams: number;
    actualGrams: number;
    reusableGrams: number;
    wasteGrams: number;
  }>;
  preparer: string;
  batch: string;
  observations: string;
}
interface LiquidReturnInput {
  productId: string;
  workOrderId: string;
  voucherReference: string;
  grossGrams: number;
  tareGrams: number;
  materialState: 'Reutilizable' | 'Mezcla identificada' | 'Contaminado' | 'Desperdicio';
  receiver: string;
}

class FraespaDatabase extends Dexie {
  states!: Table<StoredState, string>;
  constructor() {
    super('fraespa-demo');
    this.version(1).stores({ states: 'id' });
  }
}

@Injectable({ providedIn: 'root' })
export class DemoStore {
  private readonly database = new FraespaDatabase();
  private readonly internalState = signal<DemoState>(createDemoState());
  readonly state = this.internalState.asReadonly();
  readonly ready = signal(false);
  readonly storageError = signal('');
  readonly activeOrders = computed(() =>
    this.state().workOrders.filter((order) =>
      ['En proceso', 'En evaluación', 'Recibida', 'En control de calidad'].includes(order.status),
    ),
  );
  readonly pendingRequests = computed(() =>
    this.state().requests.filter(
      (request) => request.status === 'Pendiente' || request.status === 'Parcial',
    ),
  );
  readonly financialOrders = computed(() =>
    this.state().workOrders.filter((order) => order.salePrice !== null),
  );

  constructor() {
    void this.hydrate();
  }

  private async hydrate(): Promise<void> {
    try {
      const stored = await this.database.states.get('main');
      if (stored?.payload?.schemaVersion === 4) this.internalState.set(stored.payload);
      else if (stored?.payload) this.internalState.set(createDemoState());
    } catch (error) {
      try {
        const fallback = localStorage.getItem('fraespa-demo-state');
        const parsed = fallback ? (JSON.parse(fallback) as DemoState) : null;
        if (parsed?.schemaVersion === 4) this.internalState.set(parsed);
      } catch {
        this.storageError.set(
          `No fue posible recuperar el estado local: ${error instanceof Error ? error.message : 'error desconocido'}`,
        );
      }
    } finally {
      this.ready.set(true);
    }
  }

  private persist(state: DemoState): void {
    void this.database.states
      .put({ id: 'main', payload: state })
      .then(() => this.storageError.set(''))
      .catch((databaseError) => {
        try {
          localStorage.setItem('fraespa-demo-state', JSON.stringify(state));
          this.storageError.set(
            'IndexedDB no estuvo disponible; se utilizó almacenamiento local de respaldo.',
          );
        } catch {
          this.storageError.set(
            `No se pudo guardar la operación: ${databaseError instanceof Error ? databaseError.message : 'error de almacenamiento'}`,
          );
        }
      });
  }

  private mutate(
    change: (state: DemoState) => void,
    operational = true,
    syncType = 'Operación local',
    syncSummary = 'Cambio guardado localmente',
  ): void {
    if (!this.ready())
      throw new Error('La base local todavía se está cargando. Intenta nuevamente en un momento.');
    const next = structuredClone(this.internalState());
    change(next);
    if (operational && next.offline) {
      next.pendingOperations.unshift({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        type: syncType,
        status: 'Pendiente',
        summary: syncSummary,
      });
      next.pendingSync = next.pendingOperations.filter(
        (item) => item.status === 'Pendiente',
      ).length;
    }
    this.internalState.set(next);
    this.persist(next);
  }

  private event(
    state: DemoState,
    title: string,
    detail: string,
    kind: AuditEvent['kind'] = 'info',
  ): void {
    state.audit.unshift({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      title,
      detail,
      kind,
    });
  }

  private refreshAutomaticPending(state: DemoState, order: WorkOrder): void {
    if (order.pendingCosts?.source === 'Ajuste manual') return;
    order.pendingCosts = recommendedPendingCosts(order, state.movements, state.timeEntries);
    order.pendingCostEstimate = pendingCostTotal(order.pendingCosts);
  }

  product(productId: string) {
    return this.state().products.find((item) => item.id === productId);
  }
  order(orderId: string) {
    return this.state().workOrders.find((item) => item.id === orderId);
  }
  employee(employeeId: string) {
    return this.state().employees.find((item) => item.id === employeeId);
  }
  stock(productId: string): number {
    const item = this.product(productId);
    return item ? stockForProduct(item, this.state().movements) : 0;
  }
  allocated(orderId: string, productId: string): number {
    return allocatedQuantity(orderId, productId, this.state().movements);
  }
  stageHours(orderId: string, stageId: string): number {
    return stageHours(orderId, stageId, this.state().timeEntries);
  }
  profitability(orderId: string) {
    const order = this.order(orderId);
    return order ? profitability(order, this.state().movements, this.state().timeEntries) : null;
  }

  setRole(role: Role): void {
    this.mutate((state) => {
      state.role = role;
    }, false);
  }

  createRequest(input: RequestInput): string {
    let requestId = '';
    this.mutate(
      (state) => {
        const order = state.workOrders.find((item) => item.id === input.workOrderId);
        if (
          !order ||
          !input.requester.trim() ||
          !input.receiver.trim() ||
          !input.stage.trim() ||
          !input.lines.length
        )
          throw new Error('Completa OT, responsables, etapa y al menos un material.');
        const normalizedLines: MaterialRequestLine[] = input.lines.map((line) => {
          const item = state.products.find((product) => product.id === line.productId);
          if (!item || !isValidQuantity(Number(line.quantity)))
            throw new Error('Todas las líneas deben tener un producto y una cantidad válida.');
          return {
            id: crypto.randomUUID(),
            productId: item.id,
            requestedQuantity: roundMoney(Number(line.quantity)),
            deliveredQuantity: 0,
            closedQuantity: 0,
            note: line.note,
          };
        });
        const hasUnplanned = normalizedLines.some(
          (line) => !order.materialPlan.some((planLine) => planLine.productId === line.productId),
        );
        const hasExcess = normalizedLines.some((line) => {
          const alreadyPending = state.requests
            .filter(
              (request) =>
                request.workOrderId === order.id &&
                ['Pendiente', 'Parcial'].includes(request.status),
            )
            .flatMap((request) => request.lines)
            .filter((pendingLine) => pendingLine.productId === line.productId)
            .reduce(
              (sum, pendingLine) =>
                sum +
                Math.max(
                  0,
                  pendingLine.requestedQuantity -
                    pendingLine.deliveredQuantity -
                    pendingLine.closedQuantity,
                ),
              0,
            );
          return exceedsPlan(
            order,
            line.productId,
            line.requestedQuantity,
            state.movements,
            alreadyPending,
          ).exceeds;
        });
        if ((hasUnplanned || hasExcess) && !input.excessJustification?.trim())
          throw new Error(
            'Agrega una justificación para materiales no planificados o cantidades que superan el plan.',
          );
        requestId = crypto.randomUUID();
        state.requests.unshift({
          id: requestId,
          createdAt: new Date().toISOString(),
          workOrderId: order.id,
          requester: input.requester.trim(),
          receiver: input.receiver.trim(),
          stage: input.stage.trim(),
          lines: normalizedLines,
          status: 'Pendiente',
          note: input.note.trim(),
          excessJustification: input.excessJustification?.trim(),
        });
        this.event(
          state,
          hasExcess || hasUnplanned ? 'Solicitud con advertencia' : 'Solicitud registrada',
          `${input.requester} solicitó ${normalizedLines.length} material(es) para ${order.number}.`,
          hasExcess || hasUnplanned ? 'warning' : 'info',
        );
      },
      true,
      'Solicitud de materiales',
      `${input.lines.length} línea(s) para ${input.workOrderId}`,
    );
    return requestId;
  }

  dispatchRequest(
    requestId: string,
    deliveries?: DeliveryInput[],
    receiver?: string,
    justification?: string,
  ): string {
    let voucherNumber = '';
    this.mutate(
      (state) => {
        const request = state.requests.find((item) => item.id === requestId);
        if (!request || !['Pendiente', 'Parcial'].includes(request.status))
          throw new Error('La solicitud ya no admite entregas.');
        const order = state.workOrders.find((item) => item.id === request.workOrderId);
        if (!order) throw new Error('No se encontró la OT vinculada.');
        const selected = (
          deliveries?.length
            ? deliveries
            : request.lines.map((line) => ({
                lineId: line.id,
                quantity: line.requestedQuantity - line.deliveredQuantity - line.closedQuantity,
              }))
        ).filter((delivery) => Number(delivery.quantity) > 0);
        if (!selected.length) throw new Error('Indica al menos una cantidad a entregar.');

        const prepared = selected.map((delivery) => {
          const line = request.lines.find((item) => item.id === delivery.lineId);
          if (!line || !isValidQuantity(Number(delivery.quantity)))
            throw new Error('Cantidad de entrega inválida.');
          const quantity = roundMoney(Number(delivery.quantity));
          const pending = roundMoney(
            line.requestedQuantity - line.deliveredQuantity - line.closedQuantity,
          );
          if (quantity > pending)
            throw new Error('La entrega supera el saldo pendiente de la solicitud.');
          const product = state.products.find((item) => item.id === line.productId);
          if (!product) throw new Error('Producto no encontrado.');
          const alert = exceedsPlan(order, product.id, quantity, state.movements);
          return { line, product, quantity, alert };
        });
        if (new Set(selected.map((delivery) => delivery.lineId)).size !== selected.length)
          throw new Error('No se puede incluir dos veces la misma línea de solicitud.');
        const totalsByProduct = new Map<string, number>();
        for (const item of prepared)
          totalsByProduct.set(
            item.product.id,
            roundMoney((totalsByProduct.get(item.product.id) ?? 0) + item.quantity),
          );
        for (const [productId, total] of totalsByProduct) {
          const product = state.products.find((item) => item.id === productId)!;
          const available = stockForProduct(product, state.movements);
          if (total > available)
            throw new Error(
              `Stock insuficiente de ${product.code}. Las líneas suman ${total} ${product.unit} y hay ${available} disponibles.`,
            );
        }
        if (
          prepared.some((item) => item.alert.exceeds) &&
          !(justification?.trim() || request.excessJustification?.trim())
        )
          throw new Error('El despacho supera el plan. Registra una justificación para continuar.');

        const nextSequence =
          Math.max(
            0,
            ...state.vouchers.map((voucher) => Number(voucher.number.replace(/\D/g, '')) || 0),
          ) + 1;
        voucherNumber = `V-${String(nextSequence).padStart(5, '0')}`;
        const now = new Date().toISOString();
        const voucherId = crypto.randomUUID();
        const voucherLines: VoucherLine[] = prepared.map(({ line, product, quantity }) => {
          const movementId = crypto.randomUUID();
          state.movements.unshift({
            id: movementId,
            createdAt: now,
            type: 'Despacho',
            productId: product.id,
            quantity,
            stockDelta: -quantity,
            allocationDelta: quantity,
            unitCost: product.unitCost,
            workOrderId: order.id,
            reference: voucherNumber,
            user: 'Luis · Bodega',
            note: justification?.trim() || request.note,
            sourceVoucherId: voucherId,
          });
          line.deliveredQuantity = roundMoney(line.deliveredQuantity + quantity);
          return {
            requestLineId: line.id,
            productId: product.id,
            requestedQuantity: line.requestedQuantity,
            quantity,
            unitCost: product.unitCost,
            sourceMovementId: movementId,
          };
        });
        request.receiver = receiver?.trim() || request.receiver;
        const remaining = request.lines.reduce(
          (sum, line) =>
            sum +
            Math.max(0, line.requestedQuantity - line.deliveredQuantity - line.closedQuantity),
          0,
        );
        request.status = remaining > 0 ? 'Parcial' : 'Entregada';
        this.refreshAutomaticPending(state, order);
        const voucher: MaterialVoucher = {
          id: voucherId,
          requestId: request.id,
          number: voucherNumber,
          createdAt: now,
          workOrderId: order.id,
          requester: request.requester,
          receiver: request.receiver,
          warehouseKeeper: 'Luis',
          stage: request.stage,
          status: 'Emitido',
          lines: voucherLines,
          note: justification?.trim() || request.note,
        };
        state.vouchers.unshift(voucher);
        const hadExcess = prepared.some((item) => item.alert.exceeds);
        this.event(
          state,
          hadExcess
            ? 'Despacho con exceso autorizado'
            : request.status === 'Parcial'
              ? 'Entrega parcial registrada'
              : 'Vale de salida emitido',
          `${voucherNumber}: ${voucherLines.length} línea(s) para ${order.number}.`,
          hadExcess ? 'warning' : 'success',
        );
      },
      true,
      'Despacho de bodega',
      `Vale asociado a solicitud ${requestId}`,
    );
    return voucherNumber;
  }

  closeRequestBalance(requestId: string, lineId: string, justification: string): void {
    this.mutate(
      (state) => {
        if (!justification.trim()) throw new Error('Indica por qué se cierra el saldo.');
        const request = state.requests.find((item) => item.id === requestId);
        const line = request?.lines.find((item) => item.id === lineId);
        if (!request || !line) throw new Error('Línea no encontrada.');
        line.closedQuantity = roundMoney(line.requestedQuantity - line.deliveredQuantity);
        request.status = request.lines.every(
          (item) => item.deliveredQuantity + item.closedQuantity >= item.requestedQuantity,
        )
          ? 'Cerrada'
          : 'Parcial';
        this.event(
          state,
          'Saldo de solicitud cerrado',
          `${line.closedQuantity} unidades cerradas con justificación: ${justification}`,
          'info',
        );
      },
      true,
      'Cierre de solicitud',
      justification,
    );
  }

  createQuotation(
    input: Omit<CommercialAgreement, 'id' | 'quoteNumber' | 'date' | 'status'>,
  ): string {
    let quoteNumber = '';
    this.mutate(
      (state) => {
        if (
          !input.client.trim() ||
          !input.service.trim() ||
          !Number.isFinite(input.netPrice) ||
          input.netPrice <= 0 ||
          !Number.isInteger(input.units) ||
          input.units < 1
        )
          throw new Error('Completa cliente, servicio, precio y unidades válidas.');
        quoteNumber = `COT-2026-${String(45 + state.agreements.length).padStart(3, '0')}`;
        state.agreements.unshift({
          ...input,
          id: crypto.randomUUID(),
          quoteNumber,
          date: new Date().toISOString().slice(0, 10),
          status: 'Borrador',
        });
        this.event(
          state,
          'Cotización creada',
          `${quoteNumber} para ${input.client} por ${input.units} unidad(es).`,
          'success',
        );
      },
      true,
      'Cotización',
      input.client,
    );
    return quoteNumber;
  }

  approveQuotation(agreementId: string): void {
    this.mutate(
      (state) => {
        const agreement = state.agreements.find((item) => item.id === agreementId);
        if (!agreement) throw new Error('Cotización no encontrada.');
        agreement.status = 'Aprobada';
        this.event(
          state,
          'Cotización aprobada',
          `${agreement.quoteNumber} quedó disponible para programar ingresos.`,
          'success',
        );
      },
      true,
      'Aprobación comercial',
      agreementId,
    );
  }

  registerIntake(
    input: Omit<VehicleIntake, 'id' | 'code' | 'date' | 'status' | 'workOrderId'>,
  ): string {
    let code = '';
    this.mutate(
      (state) => {
        const agreement = state.agreements.find((item) => item.id === input.agreementId);
        if (
          !agreement ||
          agreement.status !== 'Aprobada' ||
          !input.client.trim() ||
          !input.vehicle.trim() ||
          !input.brand.trim() ||
          !input.model.trim()
        )
          throw new Error('Completa los campos obligatorios y selecciona un acuerdo aprobado.');
        const recentDuplicate = state.intakes.find(
          (item) =>
            item.agreementId === input.agreementId &&
            item.vehicle.toLowerCase() === input.vehicle.toLowerCase() &&
            Date.now() - new Date(item.date).getTime() < 10000,
        );
        if (recentDuplicate) return void (code = recentDuplicate.code);
        if (
          state.intakes.filter((item) => item.agreementId === agreement.id).length >=
          agreement.units
        )
          throw new Error('El acuerdo ya tiene registradas todas sus unidades previstas.');
        code = `ING-2026-${String(89 + state.intakes.length).padStart(4, '0')}`;
        state.intakes.unshift({
          ...input,
          id: crypto.randomUUID(),
          code,
          date: new Date().toISOString(),
          status: 'Recibida',
        });
        this.event(
          state,
          'Unidad recibida',
          `${input.vehicle} ingresó con código ${code} y quedó vinculada a ${agreement.quoteNumber}.`,
          'success',
        );
      },
      true,
      'Ingreso de unidad',
      input.vehicle,
    );
    return code;
  }

  createWorkOrderFromIntake(input: NewWorkOrderInput): string {
    let orderId = '';
    this.mutate(
      (state) => {
        const intake = state.intakes.find((item) => item.id === input.intakeId);
        if (!intake || intake.status === 'OT creada' || intake.workOrderId)
          throw new Error('El ingreso ya tiene una OT o no está disponible.');
        const agreement = state.agreements.find((item) => item.id === intake.agreementId);
        if (!agreement || !input.service.trim() || !input.dueDate || !input.assignedWorkers.length)
          throw new Error('Completa servicio, fecha de entrega y trabajadores.');
        const nextNumber =
          Math.max(
            134,
            ...state.workOrders
              .filter((item) => item.referenceType !== 'OF')
              .map((item) => Number(item.number.replace(/\D/g, '')) || 0),
          ) + 1;
        orderId = `ot-${nextNumber}`;
        const templates = {
          Pintura: [
            ['DIS0011', 20],
            ['CIN0010', 10],
            ['PNT0102', 15],
            ['BAR-450HS', 4],
          ] as Array<[string, number]>,
          Reparación: [
            ['DIS0008', 12],
            ['PQM0062', 4],
            ['PQM0215', 6],
            ['DIS0011', 14],
          ] as Array<[string, number]>,
          Preparación: [
            ['DIS0011', 16],
            ['DIS0014', 10],
            ['CIN0010', 8],
            ['PQM0034', 5],
          ] as Array<[string, number]>,
        };
        const workerName = input.assignedWorkers[0];
        const stages = [
          {
            id: crypto.randomUUID(),
            name: 'Diagnóstico y preparación',
            owner: workerName,
            progress: 0,
            plannedHours: 24,
            actualHours: 0,
            plannedStart: intake.date.slice(0, 10),
            plannedEnd: input.dueDate,
            status: 'Pendiente' as const,
          },
        ];
        const salePrice = agreement.priceScope === 'Por unidad' ? agreement.netPrice : null;
        const order: WorkOrder = {
          id: orderId,
          number: `OT-${nextNumber}`,
          referenceType: 'Demo',
          sourceLabel: 'Creada desde ingreso',
          intakeId: intake.id,
          agreementId: agreement.id,
          client: intake.client,
          vehicle: intake.vehicle,
          model: intake.model,
          brand: intake.brand,
          service: input.service.trim(),
          status: 'Pendiente de inicio',
          economicStatus: salePrice === null ? 'Aprobada' : 'Aprobada',
          progress: 0,
          intakeDate: intake.date.slice(0, 10),
          dueDate: input.dueDate,
          salePrice,
          approvedExtras: 0,
          discounts: 0,
          commercialAdjustments: 0,
          materialBudget: (agreement.estimatedCost * 0.4) / agreement.units,
          laborBudget: (agreement.estimatedCost * 0.35) / agreement.units,
          serviceBudget: (agreement.estimatedCost * 0.15) / agreement.units,
          otherDirectBudget: 0,
          productionOverheadBudget: (agreement.estimatedCost * 0.07) / agreement.units,
          adminBudget: (agreement.estimatedCost * 0.03) / agreement.units,
          externalServicesActual: 0,
          otherDirectActual: 0,
          productionOverheadActual: 0,
          adminActual: 0,
          pendingCostEstimate: agreement.estimatedCost / agreement.units,
          pendingCosts: {
            materials: (agreement.estimatedCost * 0.4) / agreement.units,
            labor: (agreement.estimatedCost * 0.35) / agreement.units,
            externalServices: (agreement.estimatedCost * 0.15) / agreement.units,
            otherDirect: 0,
            productionOverhead: (agreement.estimatedCost * 0.07) / agreement.units,
            administration: (agreement.estimatedCost * 0.03) / agreement.units,
            updatedAt: new Date().toISOString(),
            explanation: 'Estimación inicial distribuida según el presupuesto comercial aprobado.',
            source: 'Recalculado desde presupuesto',
          },
          productionOverheadAllocation:
            'Asignación demostrativa por OT según horas productivas previstas.',
          adminAllocation:
            'Asignación demostrativa proporcional al ingreso presupuestado de la OT.',
          budgetExplanation:
            'Presupuesto unitario derivado del costo estimado comercial del acuerdo aprobado.',
          laborRate: 0,
          stages,
          materialPlan: templates[input.template].map(([productId, estimatedQty]) => ({
            productId,
            estimatedQty,
            originalEstimatedQty: estimatedQty,
          })),
          materialPlanRevision: 1,
          assignedWorkers: input.assignedWorkers,
          financialDataSimulated: true,
        };
        state.workOrders.unshift(order);
        intake.status = 'OT creada';
        intake.workOrderId = order.id;
        this.event(
          state,
          'Orden creada desde ingreso',
          `${order.number} quedó vinculada a ${intake.code} y ${agreement.quoteNumber}.`,
          'success',
        );
      },
      true,
      'Creación de OT',
      input.intakeId,
    );
    return orderId;
  }

  updateMaterialPlan(orderId: string, productId: string, quantity: number, note = ''): void {
    this.mutate(
      (state) => {
        const order = state.workOrders.find((item) => item.id === orderId);
        const product = state.products.find((item) => item.id === productId);
        if (!order || !product || !isValidQuantity(quantity))
          throw new Error('Producto o cantidad inválidos.');
        const existing = order.materialPlan.find((item) => item.productId === productId);
        if (existing) existing.estimatedQty = roundMoney(quantity);
        else
          order.materialPlan.push({
            productId,
            estimatedQty: roundMoney(quantity),
            originalEstimatedQty: 0,
            note,
          });
        order.materialPlanRevision = (order.materialPlanRevision ?? 1) + 1;
        this.event(
          state,
          'Plan de materiales revisado',
          `${order.number}: ${product.code} quedó planificado en ${quantity} ${product.unit}. Revisión ${order.materialPlanRevision}.`,
          'info',
        );
      },
      true,
      'Revisión de plan',
      `${orderId} · ${productId}`,
    );
  }

  removeMaterialPlanLine(orderId: string, productId: string): void {
    this.mutate(
      (state) => {
        const order = state.workOrders.find((item) => item.id === orderId);
        if (!order || allocatedQuantity(orderId, productId, state.movements) > 0)
          throw new Error('No se puede eliminar un material que ya tiene entregas.');
        order.materialPlan = order.materialPlan.filter((item) => item.productId !== productId);
        order.materialPlanRevision = (order.materialPlanRevision ?? 1) + 1;
        this.event(
          state,
          'Material retirado del plan',
          `${productId} fue retirado de ${order.number}.`,
          'info',
        );
      },
      true,
      'Revisión de plan',
      `${orderId} · eliminar ${productId}`,
    );
  }

  copyMaterialPlan(fromOrderId: string, toOrderId: string): void {
    this.mutate(
      (state) => {
        const from = state.workOrders.find((item) => item.id === fromOrderId);
        const to = state.workOrders.find((item) => item.id === toOrderId);
        if (!from || !to || !from.materialPlan.length || from.id === to.id)
          throw new Error('Selecciona una OT comparable con plan disponible.');
        to.materialPlan = from.materialPlan.map((line) => ({
          ...line,
          originalEstimatedQty: line.estimatedQty,
        }));
        to.materialPlanRevision = (to.materialPlanRevision ?? 1) + 1;
        this.event(
          state,
          'Plan copiado desde OT comparable',
          `${to.number} tomó como referencia el plan de ${from.number}.`,
          'success',
        );
      },
      true,
      'Copia de plan',
      `${fromOrderId} → ${toOrderId}`,
    );
  }

  registerInventoryEntry(
    productId: string,
    quantity: number,
    unitCost: number,
    reference: string,
  ): void {
    this.mutate(
      (state) => {
        const item = state.products.find((product) => product.id === productId);
        if (!item || !isValidQuantity(quantity) || !Number.isFinite(unitCost) || unitCost < 0)
          throw new Error('Entrada de inventario inválida.');
        const previousCost = item.unitCost;
        item.unitCost = roundMoney(unitCost);
        state.movements.unshift({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          type: 'Ingreso',
          productId,
          quantity: roundMoney(quantity),
          stockDelta: roundMoney(quantity),
          allocationDelta: 0,
          unitCost: roundMoney(unitCost),
          reference: reference || `ING-${Date.now().toString().slice(-6)}`,
          user: 'Luis · Bodega',
          note: `Costo vigente anterior: ${previousCost}. Los costos históricos no se modificaron.`,
        });
        this.event(
          state,
          'Entrada de inventario',
          `${quantity} ${item.unit} de ${item.description} ingresaron a bodega.`,
          'success',
        );
      },
      true,
      'Entrada de inventario',
      `${productId} · ${quantity}`,
    );
  }

  returnMaterial(
    workOrderId: string,
    productId: string,
    quantity: number,
    voucherReference: string,
  ): void {
    this.mutate(
      (state) => {
        const order = state.workOrders.find((item) => item.id === workOrderId);
        const item = state.products.find((product) => product.id === productId);
        if (!order || !item || !isValidQuantity(quantity)) throw new Error('Devolución inválida.');
        const lots = allocationLots(workOrderId, productId, state.movements).filter(
          (lot) => !voucherReference || lot.movement.reference === voucherReference,
        );
        const available = roundMoney(lots.reduce((sum, lot) => sum + lot.remainingQuantity, 0));
        if (quantity > available)
          throw new Error(
            `La devolución supera el saldo del vale seleccionado (${available} ${item.unit}).`,
          );
        let remaining = roundMoney(quantity);
        const now = new Date().toISOString();
        const returnReference = `DEV-${Date.now().toString().slice(-6)}`;
        for (const lot of lots) {
          if (remaining <= 0) break;
          const used = Math.min(remaining, lot.remainingQuantity);
          state.movements.unshift({
            id: crypto.randomUUID(),
            createdAt: now,
            type: 'Devolución',
            productId,
            quantity: used,
            stockDelta: used,
            allocationDelta: -used,
            unitCost: lot.movement.unitCost,
            workOrderId,
            reference: returnReference,
            user: 'Luis · Bodega',
            note: `Devolución vinculada a ${lot.movement.reference}.`,
            sourceMovementId: lot.movement.id,
            sourceVoucherId: lot.movement.sourceVoucherId,
          });
          remaining = roundMoney(remaining - used);
        }
        this.refreshAutomaticPending(state, order);
        this.event(
          state,
          'Devolución valorizada históricamente',
          `${quantity} ${item.unit} regresaron desde ${order.number} con el costo de ${voucherReference}.`,
          'success',
        );
      },
      true,
      'Devolución de material',
      `${workOrderId} · ${productId}`,
    );
  }

  transferMaterial(
    fromOrderId: string,
    toOrderId: string,
    productId: string,
    quantity: number,
  ): void {
    this.mutate(
      (state) => {
        const from = state.workOrders.find((item) => item.id === fromOrderId);
        const to = state.workOrders.find((item) => item.id === toOrderId);
        const item = state.products.find((product) => product.id === productId);
        if (!from || !to || !item || from.id === to.id || !isValidQuantity(quantity))
          throw new Error('Transferencia inválida.');
        const lots = allocationLots(fromOrderId, productId, state.movements);
        const available = roundMoney(lots.reduce((sum, lot) => sum + lot.remainingQuantity, 0));
        if (quantity > available)
          throw new Error(
            `La transferencia supera el saldo histórico disponible (${available} ${item.unit}).`,
          );
        const reference = `TR-${Date.now().toString().slice(-6)}`;
        const now = new Date().toISOString();
        let remaining = roundMoney(quantity);
        for (const lot of lots) {
          if (remaining <= 0) break;
          const used = Math.min(remaining, lot.remainingQuantity);
          const outId = crypto.randomUUID();
          const inId = crypto.randomUUID();
          state.movements.unshift(
            {
              id: inId,
              createdAt: now,
              type: 'Transferencia entrada',
              productId,
              quantity: used,
              stockDelta: 0,
              allocationDelta: used,
              unitCost: lot.movement.unitCost,
              workOrderId: to.id,
              relatedWorkOrderId: from.id,
              reference,
              user: 'Luis · Bodega',
              sourceMovementId: outId,
              sourceVoucherId: lot.movement.sourceVoucherId,
            },
            {
              id: outId,
              createdAt: now,
              type: 'Transferencia salida',
              productId,
              quantity: used,
              stockDelta: 0,
              allocationDelta: -used,
              unitCost: lot.movement.unitCost,
              workOrderId: from.id,
              relatedWorkOrderId: to.id,
              reference,
              user: 'Luis · Bodega',
              sourceMovementId: lot.movement.id,
              sourceVoucherId: lot.movement.sourceVoucherId,
            },
          );
          remaining = roundMoney(remaining - used);
        }
        this.refreshAutomaticPending(state, from);
        this.refreshAutomaticPending(state, to);
        this.event(
          state,
          'Transferencia valorizada históricamente',
          `${quantity} ${item.unit}: ${from.number} → ${to.number}. El stock físico no cambió.`,
          'success',
        );
      },
      true,
      'Transferencia entre OT',
      `${fromOrderId} → ${toOrderId}`,
    );
  }

  updateColorProMapping(
    colorProCode: string,
    productId: string,
    gramsPerInventoryUnit: number,
    status: ColorProMapping['status'],
  ): void {
    this.mutate(
      (state) => {
        const mapping = state.colorProMappings.find((item) => item.colorProCode === colorProCode);
        const product = state.products.find((item) => item.id === productId);
        if (!mapping || !product || !isValidQuantity(gramsPerInventoryUnit))
          throw new Error('Selecciona un producto y una conversión válida.');
        mapping.productId = product.id;
        mapping.gramsPerInventoryUnit = gramsPerInventoryUnit;
        mapping.status = status;
        mapping.note =
          status === 'Validada para demo'
            ? 'Relación confirmada para esta validación. La integración productiva sigue pendiente.'
            : 'Relación provisional; requiere validación de código y conversión antes de producción.';
        this.event(
          state,
          'Mapeo ColorPro actualizado',
          `${colorProCode} → ${product.code} · ${status}.`,
          status === 'Validada para demo' ? 'success' : 'warning',
        );
      },
      true,
      'Mapeo ColorPro',
      `${colorProCode} → ${productId}`,
    );
  }

  confirmPaintMix(input: PaintMixInput): string {
    let mixId = '';
    this.mutate(
      (state) => {
        const order = state.workOrders.find((item) => item.id === input.workOrderId);
        if (
          !order ||
          !input.ofReference.trim() ||
          !input.stage.trim() ||
          !input.colorCode.trim() ||
          !input.preparer.trim() ||
          !input.batch.trim() ||
          !input.components.length
        )
          throw new Error('Completa OF, OT, proceso, color, preparador, lote y fórmula.');
        if (
          state.paintMixes.some(
            (mix) =>
              mix.workOrderId === order.id &&
              mix.batch.toLowerCase() === input.batch.trim().toLowerCase(),
          )
        )
          throw new Error('El lote de mezcla ya fue confirmado para esta OT.');

        const prepared = input.components.map((component) => {
          const mapping = state.colorProMappings.find(
            (item) => item.colorProCode === component.colorProCode,
          );
          const product = state.products.find((item) => item.id === mapping?.productId);
          if (!mapping || !product)
            throw new Error(`Falta mapear ${component.colorProCode} con un producto Softland.`);
          if (
            !isValidQuantity(component.recommendedGrams) ||
            !isValidQuantity(component.actualGrams) ||
            component.reusableGrams < 0 ||
            component.wasteGrams < 0
          )
            throw new Error(`Revisa las cantidades de ${component.colorProCode}.`);
          const inventoryQuantity =
            Math.round((component.actualGrams / mapping.gramsPerInventoryUnit) * 10000) / 10000;
          const consumedBefore = state.paintMixes
            .filter((mix) => mix.workOrderId === order.id)
            .flatMap((mix) => mix.components)
            .filter((item) => item.productId === product.id)
            .reduce((sum, item) => sum + item.inventoryQuantity, 0);
          const deliveredAvailable = Math.max(
            0,
            allocatedQuantity(order.id, product.id, state.movements) - consumedBefore,
          );
          const consumedFromDeliveredQuantity = Math.min(inventoryQuantity, deliveredAvailable);
          const directIssueQuantity = Math.max(0, inventoryQuantity - deliveredAvailable);
          return {
            input: component,
            mapping,
            product,
            inventoryQuantity,
            consumedFromDeliveredQuantity,
            directIssueQuantity,
          };
        });

        const directByProduct = new Map<string, number>();
        for (const item of prepared)
          directByProduct.set(
            item.product.id,
            (directByProduct.get(item.product.id) ?? 0) + item.directIssueQuantity,
          );
        for (const [productId, quantity] of directByProduct) {
          const product = state.products.find((item) => item.id === productId)!;
          if (quantity > stockForProduct(product, state.movements))
            throw new Error(`Stock insuficiente para completar la mezcla de ${product.code}.`);
        }

        const now = new Date().toISOString();
        mixId = crypto.randomUUID();
        const components = prepared.map((item) => {
          if (item.directIssueQuantity > 0) {
            state.movements.unshift({
              id: crypto.randomUUID(),
              createdAt: now,
              type: 'Despacho',
              productId: item.product.id,
              quantity: item.directIssueQuantity,
              stockDelta: -item.directIssueQuantity,
              allocationDelta: item.directIssueQuantity,
              unitCost: item.product.unitCost,
              workOrderId: order.id,
              reference: input.batch.trim(),
              user: `${input.preparer.trim()} · Mezcla`,
              note: 'Solo se descontó la fracción no entregada previamente a la estación.',
            });
          }
          return {
            colorProCode: item.input.colorProCode,
            productId: item.product.id,
            recommendedGrams: item.input.recommendedGrams,
            actualGrams: item.input.actualGrams,
            reusableGrams: item.input.reusableGrams,
            wasteGrams: item.input.wasteGrams,
            inventoryQuantity: item.inventoryQuantity,
            unitCost: item.product.unitCost,
            consumedFromDeliveredQuantity: item.consumedFromDeliveredQuantity,
            directIssueQuantity: item.directIssueQuantity,
          };
        });
        const inventoryCost = roundMoney(
          components.reduce((sum, item) => sum + item.inventoryQuantity * item.unitCost, 0),
        );
        const pendingReconciliation = prepared.some(
          (item) => item.mapping.status === 'Pendiente de validación',
        );
        const mix: PaintMix = {
          id: mixId,
          createdAt: now,
          workOrderId: order.id,
          ofReference: input.ofReference.trim(),
          stage: input.stage.trim(),
          colorCode: input.colorCode.trim(),
          preparation: input.preparation,
          targetLiters: 1,
          attachmentPath: input.attachmentPath,
          extractionMode: 'Simulación demostrativa',
          components,
          preparer: input.preparer.trim(),
          batch: input.batch.trim(),
          observations: input.observations.trim(),
          inventoryCost,
          pendingReconciliation,
          status: 'Confirmada',
        };
        state.paintMixes.unshift(mix);
        this.refreshAutomaticPending(state, order);
        this.event(
          state,
          'Mezcla de pintura confirmada',
          `${input.batch.trim()} · ${input.colorCode.trim()} · ${input.preparation}. ${components.reduce((sum, item) => sum + item.actualGrams, 0).toFixed(1)} g registrados sin duplicar entregas previas.`,
          pendingReconciliation ? 'warning' : 'success',
        );
      },
      true,
      'Preparación de pintura',
      `${input.colorCode} · ${input.batch}`,
    );
    return mixId;
  }

  registerLiquidReturnByWeight(input: LiquidReturnInput): string {
    let returnId = '';
    this.mutate(
      (state) => {
        const order = state.workOrders.find((item) => item.id === input.workOrderId);
        const product = state.products.find((item) => item.id === input.productId);
        const gross = Number(input.grossGrams);
        const tare = Number(input.tareGrams);
        const net = Math.round((gross - tare) * 10) / 10;
        if (
          !order ||
          !product ||
          !input.voucherReference ||
          !input.receiver.trim() ||
          !Number.isFinite(net) ||
          net <= 0
        )
          throw new Error('Completa producto, vale, pesos válidos y responsable de recepción.');

        let inventoryQuantity: number | null = null;
        let densityApplied: number | undefined;
        if (input.materialState === 'Reutilizable') {
          if (product.unit === 'KG') inventoryQuantity = net / 1000;
          else if (product.unit === 'LT') {
            if (!product.densityGramsPerMl || product.densityStatus !== 'Validada')
              throw new Error(
                'No se puede convertir gramos a litros sin una densidad validada para el producto.',
              );
            densityApplied = product.densityGramsPerMl;
            inventoryQuantity = net / (product.densityGramsPerMl * 1000);
          } else {
            const mapping = state.colorProMappings.find(
              (item) => item.productId === product.id && item.status === 'Validada para demo',
            );
            if (!mapping)
              throw new Error(
                'La unidad de inventario no tiene una conversión por pesaje validada.',
              );
            inventoryQuantity = net / mapping.gramsPerInventoryUnit;
          }
          inventoryQuantity = Math.round(inventoryQuantity * 10000) / 10000;
          const alreadyConsumed = state.paintMixes
            .filter((mix) => mix.workOrderId === order.id)
            .flatMap((mix) => mix.components)
            .filter((item) => item.productId === product.id)
            .reduce((sum, item) => sum + item.inventoryQuantity, 0);
          const available = Math.max(
            0,
            allocatedQuantity(order.id, product.id, state.movements) - alreadyConsumed,
          );
          if (inventoryQuantity > available)
            throw new Error(
              `La devolución supera el saldo no consumido (${available.toFixed(4)} ${product.unit}).`,
            );
          const lots = allocationLots(order.id, product.id, state.movements).filter(
            (lot) => !input.voucherReference || lot.movement.reference === input.voucherReference,
          );
          if (!lots.length)
            throw new Error('No se encontró saldo del vale original para ese producto.');
          let remaining = inventoryQuantity;
          for (const lot of lots) {
            if (remaining <= 0) break;
            const used = Math.min(remaining, lot.remainingQuantity);
            state.movements.unshift({
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              type: 'Devolución',
              productId: product.id,
              quantity: used,
              stockDelta: used,
              allocationDelta: -used,
              unitCost: lot.movement.unitCost,
              workOrderId: order.id,
              reference: `DEV-PESO-${Date.now().toString().slice(-6)}`,
              user: input.receiver.trim(),
              note: `Peso neto ${net} g vinculado a ${input.voucherReference}.`,
              sourceMovementId: lot.movement.id,
              sourceVoucherId: lot.movement.sourceVoucherId,
            });
            remaining -= used;
          }
          this.refreshAutomaticPending(state, order);
        }

        returnId = crypto.randomUUID();
        state.liquidReturns.unshift({
          id: returnId,
          createdAt: new Date().toISOString(),
          productId: product.id,
          workOrderId: order.id,
          voucherReference: input.voucherReference,
          grossGrams: gross,
          tareGrams: tare,
          netGrams: net,
          inventoryUnit: product.unit,
          inventoryQuantity,
          materialState: input.materialState,
          receiver: input.receiver.trim(),
          densityApplied,
          result:
            input.materialState === 'Reutilizable' ? 'Reincorporado' : 'Separado sin reincorporar',
        });
        this.event(
          state,
          input.materialState === 'Reutilizable'
            ? 'Devolución por peso reincorporada'
            : 'Material separado sin reincorporar',
          `${net} g de ${product.code} · ${input.materialState}.`,
          input.materialState === 'Reutilizable' ? 'success' : 'warning',
        );
      },
      true,
      'Devolución por pesaje',
      `${input.productId} · ${input.materialState}`,
    );
    return returnId;
  }

  recordHours(
    workOrderId: string,
    stageId: string,
    employeeId: string,
    date: string,
    hours: number,
    hourType: TimeEntry['hourType'],
  ): void {
    this.mutate(
      (state) => {
        const order = state.workOrders.find((item) => item.id === workOrderId);
        const stage = order?.stages.find((item) => item.id === stageId);
        const employee = state.employees.find((item) => item.id === employeeId);
        if (!order || !stage || !employee || !date || !isValidQuantity(hours))
          throw new Error('Completa trabajador, etapa, fecha y horas válidas.');
        const duplicate = state.timeEntries.some(
          (entry) =>
            entry.workOrderId === workOrderId &&
            entry.stageId === stageId &&
            entry.employeeId === employeeId &&
            entry.date === date &&
            entry.hours === hours &&
            entry.hourType === hourType,
        );
        if (duplicate) throw new Error('Este registro de horas ya existe.');
        const multiplier = hourType === 'Extra' ? 1.5 : 1;
        state.timeEntries.unshift({
          id: crypto.randomUUID(),
          workOrderId,
          stageId,
          employeeId,
          date,
          hours: roundMoney(hours),
          hourType,
          hourlyCost: roundMoney(employee.hourlyCost * multiplier),
          createdAt: new Date().toISOString(),
        });
        stage.actualHours = stageHours(order.id, stage.id, state.timeEntries);
        this.refreshAutomaticPending(state, order);
        this.event(
          state,
          'Horas registradas',
          `${hours} h de ${employee.name} en ${stage.name} · ${order.number}.`,
          'success',
        );
      },
      true,
      'Registro de horas',
      `${employeeId} · ${workOrderId}`,
    );
  }

  registerDirectCost(
    workOrderId: string,
    type: DirectCostEntry['type'],
    date: string,
    description: string,
    amount: number,
    provider = '',
    reference = '',
  ): void {
    this.mutate(
      (state) => {
        const order = state.workOrders.find((item) => item.id === workOrderId);
        if (!order || !date || !description.trim() || !Number.isFinite(amount) || amount <= 0)
          throw new Error('Completa fecha, descripción y monto válido.');
        if (order.economicStatus === 'Cerrada económicamente')
          throw new Error('La OT ya está cerrada económicamente.');
        state.directCostEntries.unshift({
          id: crypto.randomUUID(),
          workOrderId,
          type,
          date,
          description: description.trim(),
          amount: roundMoney(amount),
          provider: provider.trim() || undefined,
          reference: reference.trim() || undefined,
          createdAt: new Date().toISOString(),
        });
        if (type === 'Servicio externo')
          order.externalServicesActual = roundMoney(order.externalServicesActual + amount);
        else order.otherDirectActual = roundMoney(order.otherDirectActual + amount);
        this.refreshAutomaticPending(state, order);
        order.economicStatus = 'Pendiente de conciliación';
        this.event(
          state,
          'Costo directo registrado',
          `${order.number}: ${type} · ${description.trim()} · ${roundMoney(amount)}.`,
          'info',
        );
      },
      true,
      'Costo directo',
      `${workOrderId} · ${type}`,
    );
  }

  recalculatePendingCosts(workOrderId: string): void {
    this.mutate(
      (state) => {
        const order = state.workOrders.find((item) => item.id === workOrderId);
        if (!order) throw new Error('OT no encontrada.');
        const pending = recommendedPendingCosts(order, state.movements, state.timeEntries);
        order.pendingCosts = pending;
        order.pendingCostEstimate = pendingCostTotal(pending);
        if (order.economicStatus !== 'Cerrada económicamente')
          order.economicStatus = 'Pendiente de conciliación';
        this.event(
          state,
          'Costos pendientes recalculados',
          `${order.number}: presupuesto por categoría menos costos ya acumulados; no se duplicaron gastos registrados.`,
          'success',
        );
      },
      true,
      'Recalcular costos pendientes',
      workOrderId,
    );
  }

  updatePendingCosts(
    workOrderId: string,
    values: Omit<NonNullable<WorkOrder['pendingCosts']>, 'updatedAt' | 'explanation' | 'source'>,
    explanation: string,
  ): void {
    this.mutate(
      (state) => {
        const order = state.workOrders.find((item) => item.id === workOrderId);
        if (
          !order ||
          !explanation.trim() ||
          Object.values(values).some((value) => !Number.isFinite(value) || value < 0)
        )
          throw new Error('Los montos deben ser positivos y el ajuste requiere explicación.');
        order.pendingCosts = {
          ...values,
          updatedAt: new Date().toISOString(),
          explanation: explanation.trim(),
          source: 'Ajuste manual',
        };
        order.pendingCostEstimate = pendingCostTotal(order.pendingCosts);
        order.economicStatus = 'Pendiente de conciliación';
        this.event(
          state,
          'Estimación pendiente ajustada',
          `${order.number}: ${explanation.trim()}`,
          'warning',
        );
      },
      true,
      'Ajuste de costos pendientes',
      workOrderId,
    );
  }

  closeEconomic(workOrderId: string): void {
    this.mutate(
      (state) => {
        const order = state.workOrders.find((item) => item.id === workOrderId);
        if (!order) throw new Error('OT no encontrada.');
        if (!['Administrador', 'Gerente'].includes(state.role))
          throw new Error('Solo Administración o Gerencia pueden cerrar económicamente una OT.');
        if (!['Terminada', 'Entregada'].includes(order.status))
          throw new Error('La OT debe estar terminada o entregada antes del cierre económico.');
        const pending = order.pendingCosts
          ? pendingCostTotal(order.pendingCosts)
          : order.pendingCostEstimate;
        if (pending > 0)
          throw new Error(
            `Quedan ${pending} de costos pendientes. Recalcula o concilia la estimación antes de cerrar.`,
          );
        order.economicStatus = 'Cerrada económicamente';
        order.economicClosedAt = new Date().toISOString();
        order.economicClosedBy = state.role;
        this.event(
          state,
          'Cierre económico confirmado',
          `${order.number} fue conciliada y cerrada por ${state.role}.`,
          'success',
        );
      },
      true,
      'Cierre económico',
      workOrderId,
    );
  }

  updateStageProgress(workOrderId: string, stageId: string, progress: number, reason = ''): void {
    this.mutate(
      (state) => {
        const order = state.workOrders.find((item) => item.id === workOrderId);
        const stage = order?.stages.find((item) => item.id === stageId);
        if (!order || !stage || !Number.isFinite(progress) || progress < 0 || progress > 100)
          throw new Error('Avance inválido.');
        stage.progress = progress;
        stage.status = progress >= 100 ? 'Completada' : progress > 0 ? 'En curso' : 'Pendiente';
        order.progress = Math.round(
          order.stages.reduce((sum, item) => sum + item.progress, 0) /
            Math.max(1, order.stages.length),
        );
        this.event(
          state,
          'Etapa actualizada',
          `${stage.name} quedó en ${progress}% y el avance derivado de ${order.number} es ${order.progress}%. ${reason}`.trim(),
          'info',
        );
      },
      true,
      'Avance de etapa',
      `${workOrderId} · ${stageId}`,
    );
  }

  updateProgress(workOrderId: string, progress: number, reason: string): void {
    this.mutate(
      (state) => {
        const order = state.workOrders.find((item) => item.id === workOrderId);
        if (
          !order ||
          !Number.isFinite(progress) ||
          progress < 0 ||
          progress > 100 ||
          !reason.trim()
        )
          throw new Error('El ajuste manual requiere porcentaje y justificación.');
        order.progress = progress;
        order.manualProgressReason = reason.trim();
        this.event(
          state,
          'Ajuste manual de avance',
          `${order.number}: ${progress}% · ${reason}`,
          'warning',
        );
      },
      true,
      'Ajuste manual de avance',
      reason,
    );
  }

  toggleOffline(): void {
    this.mutate((state) => {
      state.offline = !state.offline;
      this.event(
        state,
        state.offline ? 'Modo sin conexión activado' : 'Conexión recuperada',
        state.offline
          ? 'Las nuevas operaciones quedarán pendientes de sincronización.'
          : 'Ya puedes procesar las operaciones pendientes.',
        state.offline ? 'warning' : 'success',
      );
    }, false);
  }
  simulateSync(): void {
    this.mutate((state) => {
      if (state.offline) throw new Error('Recupera la conexión antes de sincronizar.');
      const processed = state.pendingOperations.filter((item) => item.status === 'Pendiente');
      processed.forEach((item) => (item.status = 'Procesada'));
      state.pendingSync = 0;
      state.lastSync = new Date().toISOString();
      this.event(
        state,
        'Sincronización simulada',
        `${processed.length} operaciones locales procesadas sin duplicar movimientos.`,
        'success',
      );
    }, false);
  }
  restoreDemo(): void {
    if (!this.ready()) throw new Error('Espera a que finalice la carga local.');
    const restored = createDemoState();
    restored.role = this.state().role;
    this.internalState.set(restored);
    this.persist(restored);
  }
}
