import { Routes } from '@angular/router';
import { CommercialPage } from './pages/commercial.page';
import { DashboardPage } from './pages/dashboard.page';
import { InventoryPage } from './pages/inventory.page';
import { ProfitabilityPage } from './pages/profitability.page';
import { ProductionPage } from './pages/production.page';
import { ReportsPage } from './pages/reports.page';
import { SyncPage } from './pages/sync.page';
import { WarehousePage } from './pages/warehouse.page';
import { WorkOrderDetailPage } from './pages/work-order-detail.page';
import { WorkOrdersPage } from './pages/work-orders.page';

export const routes: Routes = [
  { path: 'dashboard', component: DashboardPage },
  { path: 'ordenes', component: WorkOrdersPage },
  { path: 'ordenes/:id', component: WorkOrderDetailPage },
  { path: 'bodega', component: WarehousePage },
  { path: 'inventario', component: InventoryPage },
  { path: 'produccion', component: ProductionPage },
  { path: 'rentabilidad', component: ProfitabilityPage },
  { path: 'comercial', component: CommercialPage },
  { path: 'informes', component: ReportsPage },
  { path: 'sincronizacion', component: SyncPage },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];
