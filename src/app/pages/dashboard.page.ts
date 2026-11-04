import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';
import { formatClp } from '../domain/calculations';
import { DemoStore } from '../services/demo-store.service';
import { LucideIconDirective } from '../shared/lucide-icon.directive';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideIconDirective],
  template: `
    <section class="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <div>
        <div class="eyebrow">Visión operativa · {{ referenceDate() | date: 'dd MMMM yyyy' }}</div>
        <h1 class="section-heading mt-1">El taller, de un vistazo</h1>
        <p class="section-copy">
          Indicadores derivados de las órdenes, movimientos y horas registradas.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <select
          class="field w-auto"
          [ngModel]="statusFilter()"
          (ngModelChange)="statusFilter.set($event)"
        >
          <option>Todas</option>
          <option>Activas</option>
          <option>Terminadas</option></select
        ><a routerLink="/bodega" class="btn-primary"
          ><span appLucide="ScanLine"></span>Atender bodega</a
        >
      </div>
    </section>
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article class="stat-card">
        <div class="stat-icon brand-soft"><span appLucide="BusFront"></span></div>
        <div class="stat-value">{{ activeCount() }}</div>
        <div class="stat-label">Unidades activas</div>
      </article>
      <article class="stat-card">
        <div class="stat-icon bg-amber-50 text-amber-700"><span appLucide="ClockAlert"></span></div>
        <div class="stat-value">{{ dueSoon() }}</div>
        <div class="stat-label">Trabajos próximos a vencer</div>
      </article>
      <article class="stat-card">
        <div class="stat-icon bg-red-50 text-red-700"><span appLucide="PackageX"></span></div>
        <div class="stat-value">{{ criticalStock() }}</div>
        <div class="stat-label">Materiales bajo mínimo</div>
      </article>
      <article class="stat-card">
        <div class="stat-icon bg-slate-100 text-slate-700"><span appLucide="Inbox"></span></div>
        <div class="stat-value">{{ store.pendingRequests().length }}</div>
        <div class="stat-label">Solicitudes pendientes</div>
      </article>
    </section>
    @if (canSeeFinancial()) {
      <section class="mt-4 grid gap-4 md:grid-cols-3">
        <article class="panel bg-[var(--fraespa-black-soft)] p-5 text-white">
          <div class="text-xs text-slate-300">Ingresos netos del filtro</div>
          <div class="mt-2 text-2xl font-black">{{ clp(totalIncome()) }}</div>
        </article>
        <article class="panel p-5">
          <div class="stat-label">Costo final proyectado</div>
          <div class="mt-2 text-2xl font-black">{{ clp(projectedCost()) }}</div>
        </article>
        <article class="panel p-5">
          <div class="stat-label">Resultado proyectado</div>
          <div
            class="mt-2 text-2xl font-black"
            [class.text-red-600]="projectedMargin() < 0"
            [class.text-emerald-700]="projectedMargin() >= 0"
          >
            {{ clp(projectedMargin()) }}
          </div>
        </article>
      </section>
    }
    <section class="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr]">
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Órdenes que requieren atención</h2>
            <p class="mt-1 text-xs text-slate-500">Avance, vencimiento y riesgo calculados</p>
          </div>
          <a routerLink="/ordenes" class="brand-link">Ver todas →</a>
        </div>
        <div class="table-shell">
          <table class="data-table">
            <thead>
              <tr>
                <th>Orden / unidad</th>
                <th>Cliente</th>
                <th>Avance</th>
                <th>Entrega</th>
                @if (canSeeFinancial()) {
                  <th>Riesgo económico</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (order of visibleOrders(); track order.id) {
                <tr>
                  @if (canSeeFinancial()) {
                    <td>
                      <a [routerLink]="['/ordenes', order.id]" class="font-extrabold">{{
                        order.number
                      }}</a>
                      <div class="text-xs text-slate-500">
                        {{ order.vehicle }} · {{ order.service }}
                      </div>
                    </td>
                  }
                  <td>{{ order.client }}</td>
                  <td>
                    <div class="flex items-center gap-2">
                      <div class="progress-track w-24">
                        <div class="progress-fill" [style.width.%]="order.progress"></div>
                      </div>
                      <strong class="text-xs">{{ order.progress }}%</strong>
                    </div>
                  </td>
                  <td>{{ order.dueDate | date: 'dd MMM' }}</td>
                  <td>
                    @if (order.salePrice === null) {
                      <span class="badge-neutral">Sin precio</span>
                    } @else {
                      @let p = profit(order.id);
                      <span
                        class="badge"
                        [class.badge-success]="p?.risk === 'Saludable'"
                        [class.badge-warning]="p?.risk === 'Atención'"
                        [class.badge-danger]="p?.risk === 'Crítico'"
                        >{{ p?.risk }} · {{ clp(p?.projectedMargin ?? null) }}</span
                      >
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </article>
      @if (canSeeFinancial()) {
        <article class="panel p-5">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="panel-title">Distribución de costos</h2>
              <p class="mt-1 text-xs text-slate-500">Órdenes del filtro actual</p>
            </div>
            <span class="stat-icon brand-soft"><span appLucide="ChartPie"></span></span>
          </div>
          <div class="mx-auto mt-5 max-w-[300px]"><canvas #costChart></canvas></div>
          <div class="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div class="rounded-xl bg-slate-50 p-3">
              <div class="text-slate-500">Mayor componente</div>
              <strong>{{ largestComponent() }}</strong>
            </div>
            <div class="rounded-xl bg-slate-50 p-3">
              <div class="text-slate-500">Desviación crítica</div>
              <strong class="text-red-600">{{ criticalOrder() }}</strong>
            </div>
          </div>
        </article>
      }
    </section>
    <section class="mt-6 grid gap-6 lg:grid-cols-3">
      @if (canSeeFinancial()) {
        <article class="panel p-5 lg:col-span-2">
          <div>
            <h2 class="panel-title">Costo de materiales por mes</h2>
            <p class="mt-1 text-xs text-slate-500">Derivado de los movimientos valorizados</p>
          </div>
          <div class="mt-5 h-64"><canvas #trendChart></canvas></div>
        </article>
      }
      <article class="panel">
        <div class="panel-header"><h2 class="panel-title">Alertas recientes</h2></div>
        <div class="p-5">
          @for (event of store.state().audit.slice(0, 6); track event.id) {
            <div class="mb-4 flex gap-3">
              <i
                class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                [class.bg-red-500]="event.kind === 'danger'"
                [class.bg-amber-500]="event.kind === 'warning'"
                [class.bg-[var(--fraespa-green)]]="
                  event.kind === 'info' || event.kind === 'success'
                "
              ></i>
              <div>
                <strong class="text-sm">{{ event.title }}</strong>
                <p class="mt-1 text-xs text-slate-500">{{ event.detail }}</p>
              </div>
            </div>
          }
        </div>
      </article>
    </section>
  `,
})
export class DashboardPage implements AfterViewInit, OnDestroy {
  readonly store = inject(DemoStore);
  @ViewChild('costChart') costChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendChart') trendChart?: ElementRef<HTMLCanvasElement>;
  private charts: Chart[] = [];
  private viewReady = false;
  readonly statusFilter = signal<'Todas' | 'Activas' | 'Terminadas'>('Todas');
  readonly canSeeFinancial = computed(() =>
    ['Administrador', 'Gerente', 'Jefe de taller'].includes(this.store.state().role),
  );
  readonly filteredOrders = computed(() =>
    this.store
      .state()
      .workOrders.filter(
        (order) =>
          this.statusFilter() === 'Todas' ||
          (this.statusFilter() === 'Activas'
            ? !['Terminada', 'Entregada'].includes(order.status)
            : ['Terminada', 'Entregada'].includes(order.status)),
      ),
  );
  readonly financialOrders = computed(() =>
    this.filteredOrders().filter((order) => order.salePrice !== null),
  );
  readonly activeCount = computed(() => this.store.activeOrders().length);
  readonly referenceDate = computed(() => {
    const dates = [
      ...this.store.state().workOrders.map((item) => item.intakeDate),
      ...this.store.state().movements.map((item) => item.createdAt),
      ...this.store.state().timeEntries.map((item) => item.date),
    ].filter(Boolean);
    return new Date(Math.max(...dates.map((item) => new Date(item).getTime())));
  });
  readonly dueSoon = computed(
    () =>
      this.store.activeOrders().filter((order) => {
        const difference = new Date(order.dueDate).getTime() - this.referenceDate().getTime();
        return difference >= 0 && difference <= 7 * 86400000;
      }).length,
  );
  readonly criticalStock = computed(
    () =>
      this.store.state().products.filter((item) => this.store.stock(item.id) <= item.minimumStock)
        .length,
  );
  readonly visibleOrders = computed(() =>
    [...this.filteredOrders()]
      .sort((a, b) =>
        this.canSeeFinancial()
          ? (this.profit(a.id)?.projectedMargin ?? Infinity) -
            (this.profit(b.id)?.projectedMargin ?? Infinity)
          : a.dueDate.localeCompare(b.dueDate),
      )
      .slice(0, 6),
  );
  readonly totalIncome = computed(() =>
    this.financialOrders().reduce((sum, order) => sum + (this.profit(order.id)?.income ?? 0), 0),
  );
  readonly projectedCost = computed(() =>
    this.financialOrders().reduce(
      (sum, order) => sum + (this.profit(order.id)?.projectedFinalCost ?? 0),
      0,
    ),
  );
  readonly projectedMargin = computed(() => this.totalIncome() - this.projectedCost());
  readonly costTotals = computed(() =>
    this.financialOrders().reduce(
      (totals, order) => {
        const p = this.profit(order.id)!;
        totals[0] += p.materials;
        totals[1] += p.labor;
        totals[2] += order.externalServicesActual + order.otherDirectActual;
        totals[3] += order.productionOverheadActual + order.adminActual;
        return totals;
      },
      [0, 0, 0, 0],
    ),
  );
  readonly largestComponent = computed(
    () =>
      ['Materiales', 'Mano de obra', 'Servicios y otros', 'Indirectos'][
        this.costTotals().indexOf(Math.max(...this.costTotals()))
      ],
  );
  readonly criticalOrder = computed(
    () =>
      [...this.financialOrders()].sort(
        (a, b) =>
          (this.profit(a.id)?.projectedMargin ?? 0) - (this.profit(b.id)?.projectedMargin ?? 0),
      )[0]?.number ?? 'Sin datos',
  );
  constructor() {
    effect(() => {
      this.store.state();
      this.statusFilter();
      if (this.viewReady) queueMicrotask(() => this.renderCharts());
    });
  }
  profit(id: string) {
    return this.store.profitability(id);
  }
  clp = formatClp;
  ngAfterViewInit() {
    this.viewReady = true;
    this.renderCharts();
  }
  private renderCharts() {
    this.charts.forEach((chart) => chart.destroy());
    this.charts = [];
    if (this.costChart)
      this.charts.push(
        new Chart(this.costChart.nativeElement, {
          type: 'doughnut',
          data: {
            labels: ['Materiales', 'Mano de obra', 'Servicios', 'Indirectos'],
            datasets: [
              {
                data: this.costTotals(),
                backgroundColor: ['#5bbb30', '#2f6b14', '#a8adb3', '#d39a19'],
                borderWidth: 0,
              },
            ],
          },
          options: {
            cutout: '67%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 } },
              },
            },
          },
        }),
      );
    const formatter = new Intl.DateTimeFormat('es-CL', { month: 'short', year: '2-digit' });
    const periods = Array.from({ length: 6 }, (_, offset) => {
      const date = new Date(this.referenceDate());
      date.setDate(1);
      date.setMonth(date.getMonth() - (5 - offset));
      return date;
    });
    const months = periods.map((date) => formatter.format(date));
    const values = periods.map((period) =>
      this.store
        .state()
        .movements.filter(
          (movement) =>
            new Date(movement.createdAt).getMonth() === period.getMonth() &&
            new Date(movement.createdAt).getFullYear() === period.getFullYear() &&
            movement.allocationDelta > 0,
        )
        .reduce((sum, movement) => sum + movement.allocationDelta * movement.unitCost, 0),
    );
    if (this.trendChart)
      this.charts.push(
        new Chart(this.trendChart.nativeElement, {
          type: 'line',
          data: {
            labels: months,
            datasets: [
              {
                label: 'Materiales',
                data: values,
                borderColor: '#5bbb30',
                backgroundColor: 'rgba(91,187,48,.12)',
                fill: true,
                tension: 0.35,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
          },
        }),
      );
  }
  ngOnDestroy() {
    this.charts.forEach((chart) => chart.destroy());
  }
}
