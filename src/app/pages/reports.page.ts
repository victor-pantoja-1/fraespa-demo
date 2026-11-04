import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatClp } from '../domain/calculations';
import { DemoStore } from '../services/demo-store.service';
import { LucideIconDirective } from '../shared/lucide-icon.directive';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconDirective],
  template: `
    <section class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <div class="eyebrow">Aprendizaje histórico</div>
        <h1 class="section-heading mt-1">Histórico e informes</h1>
        <p class="section-copy">
          Compara trabajos similares sin afirmar relaciones que los Excel no confirman.
        </p>
      </div>
      <button class="btn-primary" (click)="exportCsv()">
        <span appLucide="Download"></span>Exportar CSV real
      </button>
    </section>
    <section class="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Trabajos de referencia</h2>
            <p class="mt-1 text-xs text-slate-500">
              OT y OF conservan sus identificadores originales
            </p>
          </div>
          <span class="badge-neutral">{{ store.state().workOrders.length }} registros</span>
        </div>
        <div class="table-shell">
          <table class="data-table">
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Cliente / unidad</th>
                <th>Tipo</th>
                <th>Avance</th>
                <th>Costo / precio</th>
                <th>Fuente</th>
              </tr>
            </thead>
            <tbody>
              @for (order of store.state().workOrders; track order.id) {
                <tr>
                  <td class="font-black text-slate-950">{{ order.number }}</td>
                  <td>
                    <div class="font-bold">{{ order.client }}</div>
                    <div class="mt-1 text-xs text-slate-500">
                      {{ order.vehicle }} · {{ order.brand }}
                    </div>
                  </td>
                  <td>{{ order.service }}</td>
                  <td>{{ order.progress }}%</td>
                  <td>
                    @if (order.salePrice === null) {
                      <span class="badge-neutral"
                        >Rentabilidad no disponible — falta precio de venta</span
                      >
                    } @else {
                      <div class="font-extrabold">{{ clp(order.salePrice) }}</div>
                      <div class="text-xs text-slate-500">
                        Margen {{ clp(profit(order.id)?.projectedMargin ?? 0) }}
                      </div>
                    }
                  </td>
                  <td>
                    <span
                      class="text-xs font-bold"
                      [class.text-[var(--fraespa-green-dark)]]="!order.financialDataSimulated"
                      [class.text-amber-600]="order.financialDataSimulated"
                      >{{ order.sourceLabel }}</span
                    >
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </article>
      <article class="panel p-5">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="panel-title">Nueva estimación</h2>
            <p class="mt-1 text-xs text-slate-500">Basada en un trabajo comparable</p>
          </div>
          <span appLucide="Calculator" class="text-[var(--fraespa-green-dark)]"></span>
        </div>
        <div class="mt-5 space-y-4">
          <label
            ><span class="field-label">Trabajo comparable</span
            ><select class="field" [ngModel]="baseOrder()" (ngModelChange)="baseOrder.set($event)">
              <option value="ot-128">OT-128 · Pintura completa rentable</option>
              <option value="ot-131">OT-131 · Reparación por colisión</option>
            </select></label
          ><label
            ><span class="field-label">Complejidad del nuevo trabajo</span
            ><select
              class="field"
              [ngModel]="complexity()"
              (ngModelChange)="complexity.set($event)"
            >
              <option [ngValue]="0.85">Menor · 85%</option>
              <option [ngValue]="1">Similar · 100%</option>
              <option [ngValue]="1.2">Mayor · 120%</option>
            </select></label
          ><label
            ><span class="field-label">Margen objetivo</span
            ><input
              class="field"
              type="number"
              min="5"
              max="50"
              [ngModel]="targetMargin()"
              (ngModelChange)="targetMargin.set($event)"
          /></label>
        </div>
        @if (estimate(); as result) {
          <div class="mt-6 rounded-2xl bg-[var(--fraespa-black-soft)] p-5 text-white">
            <div class="text-xs font-bold text-slate-300">Precio sugerido editable</div>
            <div class="mt-2 text-3xl font-black">{{ clp(result.price) }}</div>
            <div class="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span class="text-slate-400">Costo comparable</span>
                <div class="mt-1 font-extrabold">{{ clp(result.baseCost) }}</div>
              </div>
              <div>
                <span class="text-slate-400">Costo ajustado</span>
                <div class="mt-1 font-extrabold">{{ clp(result.adjustedCost) }}</div>
              </div>
            </div>
          </div>
          <div
            class="mt-4 rounded-xl border border-[var(--accent-soft-strong)] bg-[var(--accent-soft)] p-4 text-xs leading-5 text-[var(--fraespa-green-deep)]"
          >
            <strong>Regla explicable:</strong> costo final del trabajo comparable × factor de
            complejidad ÷ (1 − margen objetivo). No utiliza IA.
          </div>
        }
      </article>
    </section>
    <section class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      @for (report of reports; track report.title) {
        <article class="panel p-5">
          <div class="stat-icon bg-slate-100 text-slate-700">
            <span [appLucide]="report.icon"></span>
          </div>
          <h3 class="mt-4 font-extrabold">{{ report.title }}</h3>
          <p class="mt-2 text-xs leading-5 text-slate-500">{{ report.detail }}</p>
          <button class="brand-link mt-4" (click)="exportCsv(report.title)">Generar CSV →</button>
        </article>
      }
    </section>
    @if (toast()) {
      <div
        class="fixed bottom-24 right-5 z-[80] rounded-2xl bg-slate-950 px-5 py-4 text-sm font-bold text-white shadow-2xl lg:bottom-6"
      >
        {{ toast() }}
      </div>
    }
  `,
})
export class ReportsPage {
  readonly store = inject(DemoStore);
  readonly toast = signal('');
  readonly baseOrder = signal('ot-128');
  readonly complexity = signal(1);
  readonly targetMargin = signal(25);
  clp = formatClp;
  readonly reports = [
    {
      icon: 'ReceiptText',
      title: 'Costos por OT',
      detail: 'Materiales, horas, servicios e indirectos asignados.',
    },
    {
      icon: 'ArrowLeftRight',
      title: 'Movimientos de bodega',
      detail: 'Entradas, salidas, devoluciones, transferencias y mermas.',
    },
    {
      icon: 'Users',
      title: 'Consumo por trabajador',
      detail: 'Materiales solicitados y recibidos por responsable.',
    },
    {
      icon: 'ChartNoAxesCombined',
      title: 'Rentabilidad mensual',
      detail: 'Resultado por cliente, unidad y periodo.',
    },
  ];
  readonly estimate = computed(() => {
    const p = this.store.profitability(this.baseOrder());
    if (!p) return null;
    const baseCost = p.productionCost + (this.store.order(this.baseOrder())?.adminActual ?? 0);
    const adjustedCost = baseCost * Number(this.complexity());
    const price = adjustedCost / (1 - Number(this.targetMargin()) / 100);
    return { baseCost, adjustedCost, price };
  });
  profit(id: string) {
    return this.store.profitability(id);
  }
  exportCsv(type = 'Costos por OT'): void {
    let rows: Array<Array<string | number>>;
    let file: string;
    if (type === 'Movimientos de bodega') {
      rows = [
        [
          'Fecha',
          'Tipo',
          'Referencia',
          'Producto',
          'Cantidad',
          'Stock',
          'Asignación',
          'Costo unitario',
        ],
        ...this.store
          .state()
          .movements.map((item) => [
            item.createdAt,
            item.type,
            item.reference,
            item.productId,
            item.quantity,
            item.stockDelta,
            item.allocationDelta,
            item.unitCost,
          ]),
      ];
      file = 'movimientos-bodega';
    } else if (type === 'Consumo por trabajador') {
      rows = [
        ['Fecha', 'Trabajador', 'OT', 'Etapa', 'Horas', 'Tipo', 'Costo'],
        ...this.store
          .state()
          .timeEntries.map((item) => [
            item.date,
            this.store.employee(item.employeeId)?.name ?? item.employeeId,
            this.store.order(item.workOrderId)?.number ?? item.workOrderId,
            item.stageId,
            item.hours,
            item.hourType,
            item.hours * item.hourlyCost,
          ]),
      ];
      file = 'consumo-trabajadores';
    } else if (type === 'Rentabilidad mensual') {
      rows = [
        [
          'Orden',
          'Cliente',
          'Ingreso',
          'Costo proyectado',
          'Resultado proyectado',
          'Cierre económico',
        ],
        ...this.store
          .state()
          .workOrders.filter((item) => item.salePrice !== null)
          .map((item) => {
            const p = this.store.profitability(item.id)!;
            return [
              item.number,
              item.client,
              p.income ?? '',
              p.projectedFinalCost,
              p.projectedMargin ?? '',
              item.economicStatus,
            ];
          }),
      ];
      file = 'rentabilidad';
    } else {
      rows = [
        [
          'Orden',
          'Tipo referencia',
          'Cliente',
          'Unidad',
          'Servicio',
          'Estado',
          'Avance',
          'Precio venta',
          'Costo proyectado',
          'Margen proyectado',
        ],
        ...this.store.state().workOrders.map((order) => {
          const p = this.store.profitability(order.id);
          return [
            order.number,
            order.referenceType,
            order.client,
            order.vehicle,
            order.service,
            order.status,
            order.progress,
            order.salePrice ?? '',
            p?.projectedFinalCost ?? '',
            p?.projectedMargin ?? '',
          ];
        }),
      ];
      file = 'costos-ot';
    }
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fraespa-${file}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.show(`${type}: CSV generado con datos actuales.`);
  }
  private show(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
