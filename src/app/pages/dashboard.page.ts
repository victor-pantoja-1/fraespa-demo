import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';
import { formatClp, profitability } from '../domain/calculations';
import { DemoStore } from '../services/demo-store.service';
import { LucideIconDirective } from '../shared/lucide-icon.directive';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideIconDirective],
  template: `
    <section class="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <div><div class="eyebrow">Visión gerencial · 03 noviembre 2026</div><h1 class="section-heading mt-1">El taller, de un vistazo</h1><p class="section-copy">Costos, avance y riesgos conectados por unidad y orden de trabajo.</p></div>
      <div class="flex flex-wrap gap-2"><a routerLink="/comercial" class="btn-secondary"><span appLucide="FilePlus2"></span>Nueva cotización</a><a routerLink="/bodega" class="btn-primary"><span appLucide="ScanLine"></span>Atender bodega</a></div>
    </section>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article class="stat-card"><div class="flex items-start justify-between"><div class="stat-icon bg-blue-50 text-blue-600"><span appLucide="BusFront"></span></div><span class="badge-info">+1 esta semana</span></div><div class="stat-value">{{ activeCount() }}</div><div class="stat-label">Unidades actualmente en taller</div></article>
      <article class="stat-card"><div class="flex items-start justify-between"><div class="stat-icon bg-amber-50 text-amber-600"><span appLucide="TriangleAlert"></span></div><span class="badge-warning">Requieren acción</span></div><div class="stat-value">{{ riskCount() }}</div><div class="stat-label">Órdenes con riesgo económico</div></article>
      <article class="stat-card"><div class="flex items-start justify-between"><div class="stat-icon bg-red-50 text-red-600"><span appLucide="PackageX"></span></div><span class="badge-danger">Stock crítico</span></div><div class="stat-value">{{ criticalStock() }}</div><div class="stat-label">Materiales bajo stock mínimo</div></article>
      <article class="stat-card"><div class="flex items-start justify-between"><div class="stat-icon bg-violet-50 text-violet-600"><span appLucide="Inbox"></span></div><span class="badge-neutral">Bodega</span></div><div class="stat-value">{{ store.pendingRequests().length }}</div><div class="stat-label">Solicitudes pendientes de entrega</div></article>
    </section>

    @if (canSeeFinancial()) {
      <section class="mt-4 grid gap-4 md:grid-cols-3">
        <article class="panel bg-[#183153] p-5 text-white"><div class="text-xs font-bold text-blue-200">Ingresos netos seleccionados</div><div class="mt-2 text-2xl font-black">{{ clp(totalIncome()) }}</div><div class="mt-3 text-xs text-slate-300">Solo OT con precio comercial simulado</div></article>
        <article class="panel p-5"><div class="text-xs font-bold text-slate-500">Costo final proyectado</div><div class="mt-2 text-2xl font-black text-slate-950">{{ clp(projectedCost()) }}</div><div class="mt-3 flex items-center gap-2 text-xs font-bold text-amber-700"><span appLucide="TrendingUp" [iconSize]="15"></span>Incluye estimaciones pendientes</div></article>
        <article class="panel p-5"><div class="text-xs font-bold text-slate-500">Margen proyectado consolidado</div><div class="mt-2 text-2xl font-black" [class.text-emerald-600]="projectedMargin() >= 0" [class.text-red-600]="projectedMargin() < 0">{{ clp(projectedMargin()) }}</div><div class="mt-3 text-xs text-slate-500">Rentabilidad y caja se muestran por separado</div></article>
      </section>
    }

    <section class="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr]">
      <article class="panel"><div class="panel-header"><div><h2 class="panel-title">Órdenes que requieren atención</h2><p class="mt-1 text-xs text-slate-500">Avance, fecha y proyección económica en una sola vista</p></div><a routerLink="/ordenes" class="text-xs font-extrabold text-blue-600">Ver todas →</a></div><div class="table-shell"><table class="data-table"><thead><tr><th>Orden / unidad</th><th>Cliente</th><th>Avance</th><th>Entrega</th><th>Estado económico</th></tr></thead><tbody>@for (order of visibleOrders(); track order.id) { <tr><td><a [routerLink]="['/ordenes', order.id]" class="font-extrabold text-slate-900 hover:text-blue-600">{{ order.number }}</a><div class="mt-1 text-xs text-slate-500">{{ order.vehicle }} · {{ order.service }}</div></td><td>{{ order.client }}</td><td><div class="flex items-center gap-3"><div class="progress-track w-24"><div class="h-full rounded-full" [class.bg-emerald-500]="order.progress >= 90" [class.bg-blue-500]="order.progress < 90" [style.width.%]="order.progress"></div></div><span class="text-xs font-extrabold">{{ order.progress }}%</span></div></td><td class="whitespace-nowrap">{{ order.dueDate | date:'dd MMM' }}</td><td>@if (order.salePrice === null) { <span class="badge-neutral">Sin precio de venta</span> } @else { @let p = profit(order.id); <span class="badge" [class.badge-success]="p?.risk === 'Saludable'" [class.badge-warning]="p?.risk === 'Atención'" [class.badge-danger]="p?.risk === 'Crítico'">{{ p?.risk }} · {{ clp(p?.projectedMargin ?? 0) }}</span> }</td></tr> }</tbody></table></div></article>
      <article class="panel p-5"><div class="flex items-center justify-between"><div><h2 class="panel-title">Distribución de costos</h2><p class="mt-1 text-xs text-slate-500">OT activas con datos simulados</p></div><span class="stat-icon h-9 w-9 bg-blue-50 text-blue-600"><span appLucide="ChartPie" [iconSize]="18"></span></span></div><div class="mx-auto mt-5 max-w-[300px]"><canvas #costChart></canvas></div><div class="mt-4 grid grid-cols-2 gap-3 text-xs"><div class="rounded-xl bg-slate-50 p-3"><div class="font-bold text-slate-500">Mayor componente</div><div class="mt-1 font-extrabold text-slate-900">Mano de obra</div></div><div class="rounded-xl bg-slate-50 p-3"><div class="font-bold text-slate-500">Desviación crítica</div><div class="mt-1 font-extrabold text-red-600">OT-134</div></div></div></article>
    </section>

    <section class="mt-6 grid gap-6 lg:grid-cols-3">
      <article class="panel p-5 lg:col-span-2"><div class="flex items-center justify-between"><div><h2 class="panel-title">Evolución del costo de materiales</h2><p class="mt-1 text-xs text-slate-500">Montos demostrativos por mes (CLP)</p></div><span class="badge-info">Últimos 6 meses</span></div><div class="mt-5 h-64"><canvas #trendChart></canvas></div></article>
      <article class="panel"><div class="panel-header"><div><h2 class="panel-title">Actividad reciente</h2><p class="mt-1 text-xs text-slate-500">Eventos auditables de la demo</p></div></div><div class="p-5">@for (event of store.state().audit.slice(0, 5); track event.id) { <div class="relative flex gap-3 pb-5 last:pb-0"><div class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4" [class.bg-red-500]="event.kind === 'danger'" [class.ring-red-50]="event.kind === 'danger'" [class.bg-amber-500]="event.kind === 'warning'" [class.ring-amber-50]="event.kind === 'warning'" [class.bg-blue-500]="event.kind === 'info'" [class.ring-blue-50]="event.kind === 'info'" [class.bg-emerald-500]="event.kind === 'success'" [class.ring-emerald-50]="event.kind === 'success'"></div><div><div class="text-sm font-extrabold text-slate-800">{{ event.title }}</div><div class="mt-1 text-xs leading-5 text-slate-500">{{ event.detail }}</div></div></div> }</div></article>
    </section>
  `,
})
export class DashboardPage implements AfterViewInit, OnDestroy {
  readonly store = inject(DemoStore);
  @ViewChild('costChart') costChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendChart') trendChart?: ElementRef<HTMLCanvasElement>;
  private charts: Chart[] = [];
  readonly canSeeFinancial = computed(() => ['Administrador', 'Gerente', 'Jefe de taller'].includes(this.store.state().role));
  readonly activeCount = computed(() => this.store.activeOrders().length);
  readonly criticalStock = computed(() => this.store.state().products.filter((product) => this.store.stock(product.id) <= product.minimumStock).length);
  readonly riskCount = computed(() => this.store.financialOrders().filter((order) => profitability(order, this.store.state().movements).risk !== 'Saludable').length);
  readonly visibleOrders = computed(() => [...this.store.state().workOrders].sort((a, b) => Number(b.salePrice !== null) - Number(a.salePrice !== null)).slice(0, 6));
  readonly totalIncome = computed(() => this.store.financialOrders().reduce((sum, order) => sum + (profitability(order, this.store.state().movements).income ?? 0), 0));
  readonly projectedCost = computed(() => this.store.financialOrders().reduce((sum, order) => sum + profitability(order, this.store.state().movements).projectedFinalCost, 0));
  readonly projectedMargin = computed(() => this.totalIncome() - this.projectedCost());
  clp = formatClp;
  profit(id: string) { return this.store.profitability(id); }

  ngAfterViewInit(): void {
    if (this.costChart) this.charts.push(new Chart(this.costChart.nativeElement, { type: 'doughnut', data: { labels: ['Materiales', 'Mano de obra', 'Servicios', 'Indirectos'], datasets: [{ data: [31, 39, 17, 13], backgroundColor: ['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6'], borderWidth: 0, hoverOffset: 5 }] }, options: { cutout: '68%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, padding: 18, font: { size: 10, weight: 700 } } } } } }));
    if (this.trendChart) this.charts.push(new Chart(this.trendChart.nativeElement, { type: 'line', data: { labels: ['Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov'], datasets: [{ label: 'Materiales', data: [1680000, 1940000, 1810000, 2380000, 2940000, 2170000], borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.10)', fill: true, tension: .35, pointRadius: 3, pointBackgroundColor: '#2563eb' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: '#eef2f7' }, ticks: { callback: (value) => `$${Number(value) / 1000000}M`, font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } }, plugins: { legend: { display: false } } } }));
  }
  ngOnDestroy(): void { this.charts.forEach((chart) => chart.destroy()); }
}
