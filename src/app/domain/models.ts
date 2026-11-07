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
  densityGramsPerMl?: number;
  densityStatus?: 'Validada' | 'Pendiente de validación';
}

export type PaintPreparation = 'Concentrada' | 'Diluida';
export type MappingStatus = 'Validada para demo' | 'Pendiente de validación';

export interface ColorProMapping {
  colorProCode: string;
  productId: string;
  gramsPerInventoryUnit: number;
  status: MappingStatus;
  note: string;
}

export interface PaintMixComponent {
  colorProCode: string;
  productId: string;
  recommendedGrams: number;
  actualGrams: number;
  reusableGrams: number;
  wasteGrams: number;
  incorporatedGrams: number;
  consumedGrams: number;
  inventoryQuantity: number;
  unitCost: number;
  registeredCost: number;
  deliveredAvailableQuantity: number;
  consumedFromDeliveredQuantity: number;
  directIssueQuantity: number;
}

export interface PaintMix {
  id: string;
  createdAt: string;
  workOrderId: string;
  ofReference: string;
  stage: string;
  colorCode: string;
  preparation: PaintPreparation;
  targetLiters: number;
  attachmentPath: string;
  extractionMode: 'Simulación demostrativa';
  components: PaintMixComponent[];
  preparer: string;
  batch: string;
  observations: string;
  inventoryCost: number;
  pendingReconciliation: boolean;
  status: 'Confirmada';
}

export interface LiquidReturnRecord {
  id: string;
  createdAt: string;
  productId: string;
  workOrderId: string;
  voucherReference: string;
  grossGrams: number;
  tareGrams: number;
  netGrams: number;
  inventoryUnit: string;
  inventoryQuantity: number | null;
  materialState: 'Reutilizable' | 'Mezcla identificada' | 'Contaminado' | 'Desperdicio';
  receiver: string;
  densityApplied?: number;
  result: 'Reincorporado' | 'Separado sin reincorporar';
}

export interface MaterialPlanLine {
  productId: string;
  estimatedQty: number;
  originalEstimatedQty: number;
  stageId?: string;
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
  assignedWorkers?: string[];
  requestedFinishAt?: string;
  requestedFinishBy?: string;
  pauseReason?: string;
  startedAt?: string;
  pausedAt?: string;
  validatedAt?: string;
  validatedBy?: string;
  weight?: number;
  dependsOn?: string[];
  status:
    | 'Pendiente'
    | 'Disponible'
    | 'En curso'
    | 'En ejecución'
    | 'En revisión'
    | 'Completada'
    | 'Finalizado'
    | 'Pausado'
    | 'Reabierto'
    | 'Bloqueada';
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
  workFileId?: string;
  workFileUnitId?: string;
  licensePlate?: string;
  physicalArea?: string;
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
  authorizedQuantity: number;
  deliveredQuantity: number;
  closedQuantity: number;
  note?: string;
}

export interface RequestApproval {
  required: boolean;
  status: 'No requerida' | 'Pendiente' | 'Aprobada' | 'Aprobada parcial' | 'Rechazada';
  requestedAt?: string;
  decidedAt?: string;
  supervisor?: string;
  reason?: string;
}

export interface MaterialRequest {
  id: string;
  createdAt: string;
  workOrderId: string;
  requester: string;
  stage: string;
  receiver: string;
  lines: MaterialRequestLine[];
  status: 'En revisión' | 'Pendiente' | 'Parcial' | 'Entregada' | 'Cerrada' | 'Rechazada';
  note: string;
  excessJustification?: string;
  approval: RequestApproval;
}

export interface WorkerSession {
  workerName: string;
  authenticatedAt: string;
  selectedWorkOrderId?: string;
  selectedStageId?: string;
}

export interface ProcessEvent {
  id: string;
  createdAt: string;
  workOrderId: string;
  stageId: string;
  worker: string;
  action: 'Inició' | 'Pausó' | 'Reanudó' | 'Solicitó finalizar';
  note?: string;
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

export interface WorkFileUnit {
  id: string;
  licensePlate: string;
  vehicle: string;
  brand: string;
  model: string;
  service: string;
  workOrderId?: string;
}

export interface WorkFile {
  id: string;
  code: string;
  client: string;
  ofReference: string;
  quoteReference: string;
  service: string;
  createdAt: string;
  dueDate: string;
  manager: string;
  observations: string;
  status: 'Borrador' | 'Activo' | 'En ejecución' | 'Cerrado';
  units: WorkFileUnit[];
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
  workFiles: WorkFile[];
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
  colorProMappings: ColorProMapping[];
  paintMixes: PaintMix[];
  liquidReturns: LiquidReturnRecord[];
  workerSession: WorkerSession | null;
  processEvents: ProcessEvent[];
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
