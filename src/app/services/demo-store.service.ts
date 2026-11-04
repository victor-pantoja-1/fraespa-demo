import { Injectable, computed, signal } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { createDemoState } from '../data/demo-data';
import { allocatedQuantity, exceedsPlan, profitability, stockForProduct } from '../domain/calculations';
import { AuditEvent, CommercialAgreement, DemoState, InventoryMovement, MaterialRequest, MaterialVoucher, Role, VehicleIntake, VoucherLine } from '../domain/models';

interface StoredState {
  id: string;
  payload: DemoState;
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
  readonly activeOrders = computed(() => this.state().workOrders.filter((order) => ['En proceso', 'En evaluación', 'Recibida', 'En control de calidad'].includes(order.status)));
  readonly pendingRequests = computed(() => this.state().requests.filter((request) => request.status === 'Pendiente'));
  readonly financialOrders = computed(() => this.state().workOrders.filter((order) => order.salePrice !== null));

  constructor() {
    void this.hydrate();
  }

  private async hydrate(): Promise<void> {
    try {
      const stored = await this.database.states.get('main');
      if (stored?.payload) this.internalState.set(stored.payload);
    } catch {
      const fallback = localStorage.getItem('fraespa-demo-state');
      if (fallback) this.internalState.set(JSON.parse(fallback) as DemoState);
    } finally {
      this.ready.set(true);
    }
  }

  private persist(state: DemoState): void {
    void this.database.states.put({ id: 'main', payload: state }).catch(() => {
      localStorage.setItem('fraespa-demo-state', JSON.stringify(state));
    });
  }

  private mutate(change: (state: DemoState) => void, operational = true): void {
    const next = structuredClone(this.internalState());
    change(next);
    if (operational && next.offline) next.pendingSync += 1;
    this.internalState.set(next);
    this.persist(next);
  }

  private event(state: DemoState, title: string, detail: string, kind: AuditEvent['kind'] = 'info'): void {
    state.audit.unshift({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), title, detail, kind });
  }

  product(productId: string) {
    return this.state().products.find((item) => item.id === productId);
  }

  order(orderId: string) {
    return this.state().workOrders.find((item) => item.id === orderId);
  }

  stock(productId: string): number {
    const item = this.product(productId);
    return item ? stockForProduct(item, this.state().movements) : 0;
  }

  allocated(orderId: string, productId: string): number {
    return allocatedQuantity(orderId, productId, this.state().movements);
  }

  profitability(orderId: string) {
    const order = this.order(orderId);
    return order ? profitability(order, this.state().movements) : null;
  }

  setRole(role: Role): void {
    this.mutate((state) => { state.role = role; }, false);
  }

  createRequest(input: Omit<MaterialRequest, 'id' | 'createdAt' | 'status'>): void {
    this.mutate((state) => {
      const order = state.workOrders.find((item) => item.id === input.workOrderId);
      const item = state.products.find((product) => product.id === input.productId);
      if (!order || !item || input.quantity <= 0) throw new Error('Solicitud inválida.');
      state.requests.unshift({ ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'Pendiente' });
      const alert = exceedsPlan(order, input.productId, input.quantity, state.movements);
      this.event(state, alert.exceeds ? 'Solicitud sobre el plan' : 'Solicitud registrada', `${input.requester} solicitó ${input.quantity} ${item.unit} de ${item.description} para ${order.number}.`, alert.exceeds ? 'warning' : 'info');
    });
  }

  createQuotation(input: Omit<CommercialAgreement, 'id' | 'quoteNumber' | 'date' | 'status'>): string {
    let quoteNumber = '';
    this.mutate((state) => {
      quoteNumber = `COT-2026-${String(45 + state.agreements.length).padStart(3, '0')}`;
      state.agreements.unshift({ ...input, id: crypto.randomUUID(), quoteNumber, date: new Date().toISOString().slice(0, 10), status: 'Borrador' });
      this.event(state, 'Cotización creada', `${quoteNumber} para ${input.client} por ${input.units} unidad(es).`, 'success');
    });
    return quoteNumber;
  }

  approveQuotation(agreementId: string): void {
    this.mutate((state) => {
      const agreement = state.agreements.find((item) => item.id === agreementId);
      if (!agreement) throw new Error('Cotización no encontrada.');
      agreement.status = 'Aprobada';
      this.event(state, 'Cotización aprobada', `${agreement.quoteNumber} quedó disponible para programar ingresos.`, 'success');
    });
  }

  registerIntake(input: Omit<VehicleIntake, 'id' | 'code' | 'date' | 'status'>): string {
    let code = '';
    this.mutate((state) => {
      const agreement = state.agreements.find((item) => item.id === input.agreementId);
      if (!agreement || agreement.status !== 'Aprobada') throw new Error('Selecciona un acuerdo aprobado.');
      code = `ING-2026-${String(89 + state.intakes.length).padStart(4, '0')}`;
      state.intakes.unshift({ ...input, id: crypto.randomUUID(), code, date: new Date().toISOString(), status: 'Recibida' });
      this.event(state, 'Unidad recibida', `${input.vehicle} ingresó con código ${code} y quedó vinculada a ${agreement.quoteNumber}.`, 'success');
    });
    return code;
  }

  dispatchRequest(requestId: string, deliveredQuantity?: number): string {
    let voucherNumber = '';
    this.mutate((state) => {
      const request = state.requests.find((item) => item.id === requestId);
      if (!request || request.status !== 'Pendiente') throw new Error('La solicitud ya no está pendiente.');
      const product = state.products.find((item) => item.id === request.productId);
      const order = state.workOrders.find((item) => item.id === request.workOrderId);
      if (!product || !order) throw new Error('No se encontró el producto o la OT.');
      const quantity = deliveredQuantity ?? request.quantity;
      const available = stockForProduct(product, state.movements);
      if (quantity <= 0 || quantity > available) throw new Error(`Stock insuficiente. Disponible: ${available} ${product.unit}.`);
      const sequence = 100 + state.vouchers.length + 1;
      voucherNumber = `V-${String(sequence).padStart(5, '0')}`;
      const now = new Date().toISOString();
      const line: VoucherLine = { productId: product.id, quantity, unitCost: product.unitCost };
      const voucher: MaterialVoucher = { id: crypto.randomUUID(), number: voucherNumber, createdAt: now, workOrderId: order.id, requester: request.requester, receiver: request.requester, warehouseKeeper: 'Luis', stage: request.stage, status: 'Emitido', lines: [line], note: request.note };
      state.vouchers.unshift(voucher);
      state.movements.unshift({ id: crypto.randomUUID(), createdAt: now, type: 'Despacho', productId: product.id, quantity, stockDelta: -quantity, allocationDelta: quantity, unitCost: product.unitCost, workOrderId: order.id, reference: voucherNumber, user: 'Luis · Bodega', note: request.note });
      request.status = 'Entregada';
      const alert = exceedsPlan(order, product.id, 0, state.movements);
      this.event(state, alert.exceeds ? 'Despacho con exceso autorizado' : 'Vale de salida emitido', `${voucherNumber}: ${quantity} ${product.unit} de ${product.description} para ${order.number}.`, alert.exceeds ? 'warning' : 'success');
    });
    return voucherNumber;
  }

  registerInventoryEntry(productId: string, quantity: number, unitCost: number, reference: string): void {
    this.mutate((state) => {
      const item = state.products.find((product) => product.id === productId);
      if (!item || quantity <= 0 || unitCost < 0) throw new Error('Entrada de inventario inválida.');
      const previousCost = item.unitCost;
      item.unitCost = unitCost;
      state.movements.unshift({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), type: 'Ingreso', productId, quantity, stockDelta: quantity, allocationDelta: 0, unitCost, reference: reference || `ING-${Date.now().toString().slice(-6)}`, user: 'Luis · Bodega', note: `Costo vigente anterior: ${previousCost}. Los costos históricos no se modificaron.` });
      this.event(state, 'Entrada de inventario', `${quantity} ${item.unit} de ${item.description} ingresaron a bodega.`, 'success');
    });
  }

  returnMaterial(workOrderId: string, productId: string, quantity: number, voucherReference: string): void {
    this.mutate((state) => {
      const order = state.workOrders.find((item) => item.id === workOrderId);
      const item = state.products.find((product) => product.id === productId);
      const allocated = allocatedQuantity(workOrderId, productId, state.movements);
      if (!order || !item || quantity <= 0 || quantity > allocated) throw new Error(`La devolución supera lo asignado (${allocated} ${item?.unit ?? ''}).`);
      state.movements.unshift({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), type: 'Devolución', productId, quantity, stockDelta: quantity, allocationDelta: -quantity, unitCost: item.unitCost, workOrderId, reference: voucherReference, user: 'Luis · Bodega', note: 'Material utilizable reintegrado a bodega.' });
      this.event(state, 'Devolución registrada', `${quantity} ${item.unit} de ${item.description} regresaron a stock desde ${order.number}.`, 'success');
    });
  }

  transferMaterial(fromOrderId: string, toOrderId: string, productId: string, quantity: number): void {
    this.mutate((state) => {
      const from = state.workOrders.find((item) => item.id === fromOrderId);
      const to = state.workOrders.find((item) => item.id === toOrderId);
      const item = state.products.find((product) => product.id === productId);
      const allocated = allocatedQuantity(fromOrderId, productId, state.movements);
      if (!from || !to || !item || from.id === to.id || quantity <= 0 || quantity > allocated) throw new Error('Transferencia inválida o cantidad superior a la asignada.');
      const reference = `TR-${Date.now().toString().slice(-6)}`;
      const now = new Date().toISOString();
      state.movements.unshift(
        { id: crypto.randomUUID(), createdAt: now, type: 'Transferencia entrada', productId, quantity, stockDelta: 0, allocationDelta: quantity, unitCost: item.unitCost, workOrderId: to.id, relatedWorkOrderId: from.id, reference, user: 'Luis · Bodega' },
        { id: crypto.randomUUID(), createdAt: now, type: 'Transferencia salida', productId, quantity, stockDelta: 0, allocationDelta: -quantity, unitCost: item.unitCost, workOrderId: from.id, relatedWorkOrderId: to.id, reference, user: 'Luis · Bodega' },
      );
      this.event(state, 'Transferencia completada', `${quantity} ${item.unit} de ${item.description}: ${from.number} → ${to.number}. El stock físico no cambió.`, 'success');
    });
  }

  recordHours(workOrderId: string, stageId: string, hours: number): void {
    this.mutate((state) => {
      const order = state.workOrders.find((item) => item.id === workOrderId);
      const stage = order?.stages.find((item) => item.id === stageId);
      if (!order || !stage || hours <= 0) throw new Error('Registro de horas inválido.');
      stage.actualHours += hours;
      this.event(state, 'Horas registradas', `${hours} h agregadas a ${stage.name} en ${order.number}.`, 'success');
    });
  }

  updateProgress(workOrderId: string, progress: number): void {
    this.mutate((state) => {
      const order = state.workOrders.find((item) => item.id === workOrderId);
      if (!order) throw new Error('Orden no encontrada.');
      order.progress = Math.max(0, Math.min(100, progress));
      if (order.progress === 100 && order.status !== 'Entregada') order.status = 'En control de calidad';
      this.event(state, 'Avance actualizado', `${order.number} ahora registra ${order.progress}% de avance físico.`, 'info');
    });
  }

  toggleOffline(): void {
    this.mutate((state) => {
      state.offline = !state.offline;
      this.event(state, state.offline ? 'Modo sin conexión activado' : 'Conexión recuperada', state.offline ? 'Las nuevas operaciones quedarán pendientes de sincronización.' : 'Ya puedes procesar las operaciones pendientes.', state.offline ? 'warning' : 'success');
    }, false);
  }

  simulateSync(): void {
    this.mutate((state) => {
      if (state.offline) throw new Error('Recupera la conexión antes de sincronizar.');
      const processed = state.pendingSync;
      state.pendingSync = 0;
      state.lastSync = new Date().toISOString();
      this.event(state, 'Sincronización simulada', `${processed} operaciones locales procesadas sin duplicar movimientos.`, 'success');
    }, false);
  }

  restoreDemo(): void {
    const restored = createDemoState();
    restored.role = this.state().role;
    this.internalState.set(restored);
    this.persist(restored);
  }
}
