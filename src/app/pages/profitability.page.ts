import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatClp } from '../domain/calculations';
import { DemoStore } from '../services/demo-store.service';
import { LucideIconDirective } from '../shared/lucide-icon.directive';

@Component({
  selector: 'app-profitability-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconDirective],
  template: `
    @if (!authorized()) {
      <section class="panel mx-auto max-w-2xl p-10 text-center">
        <span appLucide="LockKeyhole" [iconSize]="38" class="mx-auto text-slate-400"></span>
        <h1 class="mt-4 text-xl font-black">Información restringida</h1>
        <p class="mt-2 text-sm text-slate-500">
          El rol {{ store.state().role }} no puede ver costos salariales ni resultados gerenciales.
          El selector local es demostrativo; la seguridad real requiere autorización en backend.
        </p>
      </section>
    } @else {
      <section class="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div class="eyebrow">Prioridad comercial</div>
          <h1 class="section-heading mt-1">Rentabilidad real por unidad</h1>
          <p class="section-copy">
            Presupuesto, proyección y resultado final económicamente conciliado.
          </p>
        </div>
        <label class="w-full xl:w-[420px]"
          ><span class="field-label">Orden analizada</span
          ><select class="field" [ngModel]="selectedId()" (ngModelChange)="selectedId.set($event)">
            @for (item of financialOrders(); track item.id) {
              <option [value]="item.id">
                {{ item.number }} · {{ item.vehicle }} · {{ item.client }}
              </option>
            }
          </select></label
        >
      </section>
      @if (order(); as current) {
        @if (profit(); as p) {
          <section
            class="mt-6 overflow-hidden rounded-3xl bg-[var(--fraespa-black-soft)] p-6 text-white lg:p-8"
          >
            <div class="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <div class="flex gap-2">
                  <span class="hero-chip">{{ current.number }}</span
                  ><span class="hero-chip">{{ current.economicStatus }}</span>
                </div>
                <h2 class="mt-4 text-3xl font-black">
                  {{ current.vehicle }} · {{ current.client }}
                </h2>
                <p class="mt-2 text-sm text-slate-300">{{ current.service }}</p>
              </div>
              <div class="min-w-[280px] rounded-2xl bg-white/8 p-5">
                <div class="text-xs text-slate-300">Margen proyectado</div>
                <div
                  class="mt-2 text-4xl font-black"
                  [class.text-red-300]="(p.projectedMargin ?? 0) < 0"
                  [class.text-emerald-300]="(p.projectedMargin ?? 0) >= 0"
                >
                  {{ clp(p.projectedMargin) }}
                </div>
                <div class="mt-2 text-sm font-bold">
                  {{ pct(p.projectedMarginPct) }} sobre ingreso neto
                </div>
              </div>
            </div>
          </section>
          <section class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <article class="stat-card">
              <div class="stat-label">Precio acordado</div>
              <div class="stat-value text-xl">{{ clp(p.income) }}</div>
            </article>
            <article class="stat-card">
              <div class="stat-label">Presupuesto total</div>
              <div class="stat-value text-xl">{{ clp(budgetTotal()) }}</div>
            </article>
            <article class="stat-card">
              <div class="stat-label">Costo acumulado</div>
              <div class="stat-value text-xl">
                {{ clp(p.productionCost + current.adminActual) }}
              </div>
            </article>
            <article class="stat-card">
              <div class="stat-label">Pendiente estimado</div>
              <div class="stat-value text-xl">{{ clp(current.pendingCostEstimate) }}</div>
            </article>
            <article class="stat-card">
              <div class="stat-label">Costo final proyectado</div>
              <div class="stat-value text-xl">{{ clp(p.projectedFinalCost) }}</div>
            </article>
          </section>
          @if ((p.projectedMargin ?? 0) < 0) {
            <section
              class="mt-4 flex gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-950"
            >
              <span appLucide="TrendingDown"></span>
              <div>
                <div class="font-black">
                  Pérdida proyectada de {{ clp(-(p.projectedMargin ?? 0)) }}
                </div>
                <p class="mt-1 text-sm">
                  La alerta conserva costos pendientes y no los presenta como resultado final.
                </p>
              </div>
            </section>
          }
          <section class="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
            <article class="panel">
              <div class="panel-header">
                <div>
                  <h2 class="panel-title">Tres escenarios</h2>
                  <p class="mt-1 text-xs text-slate-500">
                    El cierre operativo no reemplaza el cierre económico.
                  </p>
                </div>
              </div>
              <div class="table-shell">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Escenario</th>
                      <th>Ingresos</th>
                      <th>Costo total</th>
                      <th>Resultado</th>
                      <th>Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Presupuestado</strong></td>
                      <td>{{ clp(p.income) }}</td>
                      <td>{{ clp(budgetTotal()) }}</td>
                      <td>{{ clp((p.income ?? 0) - budgetTotal()) }}</td>
                      <td>{{ pct(((p.income ?? 0) - budgetTotal()) / (p.income ?? 1)) }}</td>
                    </tr>
                    <tr class="bg-[var(--accent-soft)]">
                      <td><strong>Proyectado</strong></td>
                      <td>{{ clp(p.income) }}</td>
                      <td>{{ clp(p.projectedFinalCost) }}</td>
                      <td [class.text-red-600]="(p.projectedMargin ?? 0) < 0" class="font-black">
                        {{ clp(p.projectedMargin) }}
                      </td>
                      <td>{{ pct(p.projectedMarginPct) }}</td>
                    </tr>
                    <tr>
                      <td><strong>Final</strong></td>
                      @if (current.economicStatus === 'Cerrada económicamente') {
                        <td>{{ clp(p.income) }}</td>
                        <td>{{ clp(p.productionCost + current.adminActual) }}</td>
                        <td class="font-black">{{ clp(p.finalManagementResult) }}</td>
                        <td>{{ pct(p.finalMarginPct) }}</td>
                      } @else {
                        <td colspan="4">
                          <span class="badge-neutral"
                            >Resultado final pendiente de conciliación</span
                          >
                        </td>
                      }
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
            <article class="panel p-5">
              <h2 class="panel-title">Presupuesto vs. acumulado</h2>
              <div class="mt-6 space-y-5">
                @for (bar of costBars(); track bar.label) {
                  <div>
                    <div class="mb-2 flex justify-between text-xs">
                      <strong>{{ bar.label }}</strong
                      ><span>{{ clp(bar.actual) }}</span>
                    </div>
                    <div class="relative h-4 overflow-hidden rounded-full bg-slate-100">
                      <div
                        class="absolute inset-y-0 left-0 rounded-full bg-slate-300"
                        [style.width.%]="bar.budgetPct"
                      ></div>
                      <div
                        class="absolute inset-y-0 left-0 rounded-full"
                        [class.bg-[var(--fraespa-green)]]="bar.actual <= bar.budget"
                        [class.bg-red-500]="bar.actual > bar.budget"
                        [style.width.%]="bar.actualPct"
                      ></div>
                    </div>
                    <div class="mt-1 text-right text-[10px] text-slate-400">
                      Plan {{ clp(bar.budget) }}
                    </div>
                  </div>
                }
              </div>
            </article>
          </section>
          <section class="mt-6 grid gap-4 lg:grid-cols-4">
            <article class="panel p-5">
              <div class="stat-label">Material entregado</div>
              <div class="mt-2 text-xl font-black">{{ clp(p.materialsDelivered) }}</div>
            </article>
            <article class="panel p-5">
              <div class="stat-label">Material recuperado</div>
              <div class="mt-2 text-xl font-black">−{{ clp(p.materialsRecovered) }}</div>
            </article>
            <article class="panel p-5">
              <div class="stat-label">Consumo neto</div>
              <div class="mt-2 text-xl font-black">{{ clp(p.materials) }}</div>
            </article>
            <article class="panel p-5">
              <div class="stat-label">Resultado gerencial acumulado</div>
              <div class="mt-2 text-xl font-black">{{ clp(p.managementResult) }}</div>
            </article>
          </section>
        }
      }
    }
  `,
})
export class ProfitabilityPage {
  readonly store = inject(DemoStore);
  readonly selectedId = signal('ot-125');
  readonly authorized = computed(() =>
    ['Administrador', 'Gerente', 'Jefe de taller'].includes(this.store.state().role),
  );
  readonly financialOrders = computed(() =>
    this.store.state().workOrders.filter((order) => order.salePrice !== null),
  );
  readonly order = computed(() => this.store.order(this.selectedId()));
  readonly profit = computed(() => this.store.profitability(this.selectedId()));
  readonly budgetTotal = computed(() => {
    const order = this.order();
    return order
      ? order.materialBudget +
          order.laborBudget +
          order.serviceBudget +
          order.otherDirectBudget +
          order.productionOverheadBudget +
          order.adminBudget
      : 0;
  });
  readonly costBars = computed(() => {
    const order = this.order();
    const p = this.profit();
    if (!order || !p) return [];
    const rows = [
      { label: 'Materiales', budget: order.materialBudget, actual: p.materials },
      { label: 'Mano de obra', budget: order.laborBudget, actual: p.labor },
      {
        label: 'Servicios y otros',
        budget: order.serviceBudget + order.otherDirectBudget,
        actual: order.externalServicesActual + order.otherDirectActual,
      },
      {
        label: 'Indirectos y administración',
        budget: order.productionOverheadBudget + order.adminBudget,
        actual: order.productionOverheadActual + order.adminActual,
      },
    ];
    const max = Math.max(...rows.flatMap((row) => [row.budget, row.actual]), 1);
    return rows.map((row) => ({
      ...row,
      budgetPct: (row.budget / max) * 100,
      actualPct: (row.actual / max) * 100,
    }));
  });
  clp = formatClp;
  pct(value: number | null) {
    return value === null
      ? 'N/D'
      : new Intl.NumberFormat('es-CL', {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(value);
  }
}
