export type Role = 'Administrador' | 'Gerente' | 'Jefe de taller' | 'Bodeguero' | 'Trabajador' | 'Compras';
export type WorkOrderStatus = 'Programada' | 'Recibida' | 'En evaluación' | 'Pendiente de inicio' | 'En proceso' | 'Detenida' | 'En control de calidad' | 'Terminada' | 'Entregada';
export type EconomicStatus = 'Sin cotización' | 'Cotizada' | 'Aprobada' | 'Con adicionales pendientes' | 'Pendiente de conciliación' | 'Cerrada económicamente';

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
  location: string;
  source: 'Excel verificado' | 'Demostración';
}

export interface MaterialPlanLine {
  productId: string;
  estimatedQty: number;
}

export interface WorkStage {
  id: string;
  name: string;
  owner: string;
  progress: number;
  plannedHours: number;
  actualHours: number;
  status: 'Pendiente' | 'En curso' | 'Completada' | 'Bloqueada';
}

export interface WorkOrder {
  id: string;
  number: string;
  referenceType: 'OT' | 'OF' | 'Demo';
  sourceLabel: string;
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
  laborRate: number;
  stages: WorkStage[];
  materialPlan: MaterialPlanLine[];
  assignedWorkers: string[];
  financialDataSimulated: boolean;
}

export type MovementType = 'Despacho' | 'Devolución' | 'Transferencia salida' | 'Transferencia entrada' | 'Merma' | 'Ingreso' | 'Ajuste';

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
}

export interface VoucherLine {
  productId: string;
  quantity: number;
  unitCost: number;
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
  lines: VoucherLine[];
  note: string;
}

export interface MaterialRequest {
  id: string;
  createdAt: string;
  workOrderId: string;
  requester: string;
  stage: string;
  productId: string;
  quantity: number;
  status: 'Pendiente' | 'Entregada' | 'Rechazada';
  note: string;
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
}

export interface DemoState {
  products: Product[];
  workOrders: WorkOrder[];
  movements: InventoryMovement[];
  vouchers: MaterialVoucher[];
  requests: MaterialRequest[];
  agreements: CommercialAgreement[];
  intakes: VehicleIntake[];
  audit: AuditEvent[];
  offline: boolean;
  pendingSync: number;
  lastSync: string;
  role: Role;
}

export interface Profitability {
  income: number | null;
  materials: number;
  labor: number;
  directCost: number;
  productionCost: number;
  managementResult: number | null;
  contributionMargin: number | null;
  projectedFinalCost: number;
  projectedMargin: number | null;
  projectedMarginPct: number | null;
  risk: 'Saludable' | 'Atención' | 'Crítico' | 'Sin datos';
}

