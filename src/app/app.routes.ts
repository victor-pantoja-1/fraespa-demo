import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommercialPage } from './pages/commercial.page';
import { DashboardPage } from './pages/dashboard.page';
import { InventoryPage } from './pages/inventory.page';
import { PaintDemoPage } from './pages/paint-demo.page';
import { PresentationDemoPage } from './pages/presentation-demo.page';
import { MobileWorkerPage } from './pages/mobile-worker.page';
import { ProfitabilityPage } from './pages/profitability.page';
import { ProductionPage } from './pages/production.page';
import { ReportsPage } from './pages/reports.page';
import { SyncPage } from './pages/sync.page';
import { WarehousePage } from './pages/warehouse.page';
import { WorkOrderDetailPage } from './pages/work-order-detail.page';
import { WorkOrdersPage } from './pages/work-orders.page';
import { WorkFilesPage } from './pages/work-files.page';
import { DemoStore } from './services/demo-store.service';

const managementGuard = () =>
  ['Administrador', 'Gerente', 'Jefe de taller'].includes(inject(DemoStore).state().role) ||
  inject(Router).createUrlTree(['/dashboard']);
const commercialGuard = () =>
  ['Administrador', 'Gerente'].includes(inject(DemoStore).state().role) ||
  inject(Router).createUrlTree(['/dashboard']);

export const routes: Routes = [
  { path: 'dashboard', component: DashboardPage },
  { path: 'expedientes', component: WorkFilesPage },
  { path: 'ordenes', component: WorkOrdersPage },
  { path: 'ordenes/:id', component: WorkOrderDetailPage },
  { path: 'bodega', component: WarehousePage },
  { path: 'inventario', component: InventoryPage },
  { path: 'produccion', component: ProductionPage },
  { path: 'movil', component: MobileWorkerPage },
  { path: 'movil/tareas', component: MobileWorkerPage },
  { path: 'movil/tareas/:id', component: MobileWorkerPage },
  { path: 'movil/solicitudes', component: MobileWorkerPage },
  { path: 'demo-flujo', component: PresentationDemoPage },
  { path: 'demo-pinturas', component: PaintDemoPage },
  { path: 'rentabilidad', component: ProfitabilityPage, canActivate: [managementGuard] },
  { path: 'comercial', component: CommercialPage, canActivate: [commercialGuard] },
  { path: 'informes', component: ReportsPage, canActivate: [managementGuard] },
  { path: 'sincronizacion', component: SyncPage },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];
