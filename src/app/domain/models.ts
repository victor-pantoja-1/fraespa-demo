export type Role =
  'Administrador' | 'Gerente' | 'Jefe de taller' | 'Bodeguero' | 'Trabajador' | 'Compras';
export type WorkOrderStatus =
  | 'Programada'
  | 'Recibida'
  | 'En evaluación'
  | 'Pendiente de inicio'
  | 'En proceso'
  | 'Detenida'
  | 'En control de calidad'
  | 'Terminada'
  | 'Entregada';
export type EconomicStatus =
  | 'Sin cotización'
  | 'Cotizada'
  | 'Aprobada'
  | 'Con adicionales pendientes'
  | 'Pendiente de conciliación'
  | 'Cerrada económicamente';

export interface Product {
  id: string;
  code: string;
  barcode: string;
  description: string;
  category: string;
  unit: string;
  openingStock: number;
  minimumStock: number;
  unitCost: number;
  costBasis: string;
  location: string;
  source: 'Excel verificado' | 'Demostración';
}

export interface MaterialPlanLine {
  productId: string;
  estimatedQty: number;
  originalEstimatedQty: number;
  note?: string;
}

export interface WorkStage {
  id: string;
  name: string;
  owner: string;
  progress: number;
  plannedHours: number;
  actualHours: number;
  plannedStart: string;
  plannedEnd: string;
  blockedReason?: string;
  status: 'Pendiente' | 'En curso' | 'Completada' | 'Bloqueada';
}

export interface PendingCostBreakdown {
  materials: number;
  labor: number;
  externalServices: number;
  otherDirect: number;
  productionOverhead: number;
  administration: number;
  updatedAt: string;
  explanation: string;
  source: 'Recalculado desde presupuesto' | 'Ajuste manual';
}

export interface DirectCostEntry {
  id: string;
  workOrderId: string;
  type: 'Servicio externo' | 'Otro costo directo';
  date: string;
  description: string;
  amount: number;
  provider?: string;
  reference?: string;
  createdAt: string;
}

export interface WorkOrder {
  id: string;
  number: string;
  referenceType: 'OT' | 'OF' | 'Demo';
  sourceLabel: string;
  intakeId?: string;
  agreementId?: string;
  client: string;
  vehicle: string;
  model: string;
  brand: string;
  service: string;
  status: WorkOrderStatus;
  economicStatus: EconomicStatus;
  progress: number;
  intakeDate: string;
  dueDate: string;
  salePrice: number | null;
  approvedExtras: number;
  discounts: number;
  commercialAdjustments: number;
  materialBudget: number;
  laborBudget: number;
  serviceBudget: number;
  otherDirectBudget: number;
  productionOverheadBudget: number;
  adminBudget: number;
  externalServicesActual: number;
  otherDirectActual: number;
  productionOverheadActual: number;
  adminActual: number;
  pendingCostEstimate: number;
  pendingCosts?: PendingCostBreakdown;
  productionOverheadAllocation?: string;
  adminAllocation?: string;
  budgetExplanation?: string;
  economicClosedAt?: string;
  economicClosedBy?: string;
  laborRate: number;
  stages: WorkStage[];
  materialPlan: MaterialPlanLine[];
  materialPlanRevision?: number;
  assignedWorkers: string[];
  financialDataSimulated: boolean;
  manualProgressReason?: string;
}

export type MovementType =
  | 'Despacho'
  | 'Devolución'
  | 'Transferencia salida'
  | 'Transferencia entrada'
  | 'Merma'
  | 'Ingreso'
  | 'Ajuste';

export interface InventoryMovement {
  id: string;
  createdAt: string;
  type: MovementType;
  productId: string;
  quantity: number;
  stockDelta: number;
  allocationDelta: number;
  unitCost: number;
  workOrderId?: string;
  relatedWorkOrderId?: string;
  reference: string;
  user: string;
  note?: string;
  sourceMovementId?: string;
  sourceVoucherId?: string;
}

export interface VoucherLine {
  requestLineId: string;
  productId: string;
  requestedQuantity: number;
  quantity: number;
  unitCost: number;
  sourceMovementId?: string;
}

export interface MaterialVoucher {
  id: string;
  number: string;
  createdAt: string;
  workOrderId: string;
  requester: string;
  receiver: string;
  warehouseKeeper: string;
  stage: string;
  status: 'Emitido' | 'Anulado';
  requestId: string;
  lines: VoucherLine[];
  note: string;
}

export interface MaterialRequestLine {
  id: string;
  productId: string;
  requestedQuantity: number;
  deliveredQuantity: number;
  closedQuantity: number;
  note?: string;
}

export interface MaterialRequest {
  id: string;
  createdAt: string;
  workOrderId: string;
  requester: string;
  stage: string;
  receiver: string;
  lines: MaterialRequestLine[];
  status: 'Pendiente' | 'Parcial' | 'Entregada' | 'Cerrada' | 'Rechazada';
  note: string;
  excessJustification?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  hourlyCost: number;
}

export interface TimeEntry {
  id: string;
  workOrderId: string;
  stageId: string;
  employeeId: string;
  date: string;
  hours: number;
  hourType: 'Normal' | 'Extra' | 'Reproceso';
  hourlyCost: number;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  createdAt: string;
  title: string;
  detail: string;
  kind: 'success' | 'warning' | 'info' | 'danger';
}

export interface CommercialAgreement {
  id: string;
  quoteNumber: string;
  client: string;
  service: string;
  netPrice: number;
  taxRate: number;
  status: 'Borrador' | 'Enviada' | 'Aprobada' | 'Rechazada' | 'Vencida';
  units: number;
  estimatedCost: number;
  date: string;
  priceScope: 'Por unidad' | 'Global';
}

export interface VehicleIntake {
  id: string;
  code: string;
  client: string;
  vehicle: string;
  brand: string;
  model: string;
  agreementId: string;
  date: string;
  status: 'Recibida' | 'OT creada';
  workOrderId?: string;
}

export interface SyncOperation {
  id: string;
  createdAt: string;
  type: string;
  status: 'Pendiente' | 'Procesada';
  summary: string;
}

export interface DemoState {
  schemaVersion: number;
  products: Product[];
  workOrders: WorkOrder[];
  movements: InventoryMovement[];
  vouchers: MaterialVoucher[];
  requests: MaterialRequest[];
  employees: Employee[];
  timeEntries: TimeEntry[];
  directCostEntries: DirectCostEntry[];
  agreements: CommercialAgreement[];
  intakes: VehicleIntake[];
  audit: AuditEvent[];
  offline: boolean;
  pendingSync: number;
  pendingOperations: SyncOperation[];
  lastSync: string;
  role: Role;
}

export interface Profitability {
  income: number | null;
  materials: number;
  materialsDelivered: number;
  materialsRecovered: number;
  labor: number;
  directCost: number;
  productionCost: number;
  managementResult: number | null;
  finalManagementResult: number | null;
  finalMarginPct: number | null;
  contributionMargin: number | null;
  originalBudget: number;
  accumulatedCost: number;
  pendingCost: number;
  additionalCost: number;
  projectedFinalCost: number;
  projectedMargin: number | null;
  projectedMarginPct: number | null;
  risk: 'Saludable' | 'Atención' | 'Crítico' | 'Sin datos';
}
