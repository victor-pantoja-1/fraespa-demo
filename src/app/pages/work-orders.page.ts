import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { formatClp } from '../domain/calculations';
import { DemoStore } from '../services/demo-store.service';
import { LucideIconDirective } from '../shared/lucide-icon.directive';

@Component({
  selector: 'app-work-orders-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideIconDirective],
  template: `
    <section class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <div class="eyebrow">Operación por unidad</div>
        <h1 class="section-heading mt-1">Órdenes de trabajo</h1>
        <p class="section-copy">OF, ingresos y OT conservan identificadores independientes.</p>
      </div>
      <button class="btn-primary" (click)="newOrderOpen.set(true)">
        <span appLucide="Plus"></span>Nueva orden
      </button>
    </section>
    <section class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article class="stat-card">
        <div class="text-xs font-bold text-slate-500">En proceso</div>
        <div class="stat-value">{{ count('En proceso') }}</div>
      </article>
      <article class="stat-card">
        <div class="text-xs font-bold text-slate-500">Control de calidad</div>
        <div class="stat-value">{{ count('En control de calidad') }}</div>
      </article>
      <article class="stat-card">
        <div class="text-xs font-bold text-slate-500">Terminadas / entregadas</div>
        <div class="stat-value">{{ finished() }}</div>
      </article>
      <article class="stat-card">
        <div class="text-xs font-bold text-slate-500">Sin precio de venta</div>
        <div class="stat-value">{{ withoutPrice() }}</div>
      </article>
    </section>
    <section class="panel mt-6">
      <div class="panel-header">
        <div class="flex flex-1 flex-col gap-3 sm:flex-row">
          <label class="search-box max-w-md flex-1"
            ><span appLucide="Search" [iconSize]="17"></span
            ><input
              placeholder="Buscar por OT, OF, cliente o patente"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)" /></label
          ><select
            class="field max-w-[220px]"
            [ngModel]="status()"
            (ngModelChange)="status.set($event)"
          >
            <option value="Todas">Todos los estados</option>
            <option>En proceso</option>
            <option>Terminada</option>
            <option>Entregada</option>
            <option>En control de calidad</option>
          </select>
        </div>
        <span class="badge-neutral">{{ filtered().length }} registros</span>
      </div>
      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Cliente / unidad</th>
              <th>Servicio</th>
              <th>Avance</th>
              <th>Estado</th>
              <th>Costo proyectado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (order of filtered(); track order.id) {
              <tr>
                <td>
                  <a
                    [routerLink]="['/ordenes', order.id]"
                    class="text-base font-black text-slate-950 hover:text-[var(--fraespa-green-dark)]"
                    >{{ order.number }}</a
                  >
                  <div class="mt-1 text-[11px] font-bold text-slate-400">
                    {{ order.sourceLabel }}
                  </div>
                </td>
                <td>
                  <div class="font-bold text-slate-800">{{ order.client }}</div>
                  <div class="mt-1 text-xs text-slate-500">
                    {{ order.vehicle }} · {{ order.brand }}
                  </div>
                </td>
                <td class="max-w-[260px]">{{ order.service }}</td>
                <td>
                  <div class="flex w-32 items-center gap-2">
                    <div class="progress-track flex-1">
                      <div
                        class="h-full rounded-full bg-[var(--fraespa-green)]"
                        [style.width.%]="order.progress"
                      ></div>
                    </div>
                    <span class="text-xs font-black">{{ order.progress }}%</span>
                  </div>
                </td>
                <td>
                  <span
                    class="badge"
                    [class.badge-info]="order.status === 'En proceso'"
                    [class.badge-success]="
                      order.status === 'Terminada' || order.status === 'Entregada'
                    "
                    [class.badge-warning]="order.status === 'En control de calidad'"
                    >{{ order.status }}</span
                  >
                </td>
                <td>
                  @if (!canSeeFinancial()) {
                    <span class="text-xs font-bold text-slate-400">Información restringida</span>
                  } @else if (order.salePrice === null) {
                    <span class="text-xs font-bold text-slate-400">Rentabilidad no disponible</span>
                  } @else {
                    <div class="font-extrabold text-slate-900">
                      {{ clp(profit(order.id)?.projectedFinalCost ?? 0) }}
                    </div>
                    <div
                      class="mt-1 text-xs"
                      [class.text-red-600]="(profit(order.id)?.projectedMargin ?? 0) < 0"
                      [class.text-emerald-600]="(profit(order.id)?.projectedMargin ?? 0) >= 0"
                    >
                      Margen {{ clp(profit(order.id)?.projectedMargin ?? 0) }}
                    </div>
                  }
                </td>
                <td>
                  <a [routerLink]="['/ordenes', order.id]" class="icon-button"
                    ><span appLucide="ChevronRight" [iconSize]="17"></span
                  ></a>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="py-12 text-center text-slate-500">
                  No hay órdenes que coincidan con los filtros.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
    @if (newOrderOpen()) {
      <div class="modal-backdrop" (click)="newOrderOpen.set(false)">
        <form
          class="panel w-full max-w-2xl p-6"
          (click)="$event.stopPropagation()"
          (ngSubmit)="createOrder()"
        >
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-black">Crear OT desde un ingreso</h2>
              <p class="mt-1 text-xs text-slate-500">
                El ingreso queda vinculado y no puede reutilizarse.
              </p>
            </div>
            <button type="button" class="icon-button" (click)="newOrderOpen.set(false)">
              <span appLucide="X"></span>
            </button>
          </div>
          @if (availableIntakes().length) {
            <div class="mt-6 grid gap-4 sm:grid-cols-2">
              <label class="sm:col-span-2"
                ><span class="field-label">Ingreso disponible</span
                ><select class="field" [(ngModel)]="intakeId" name="intake">
                  @for (intake of availableIntakes(); track intake.id) {
                    <option [value]="intake.id">
                      {{ intake.code }} · {{ intake.vehicle }} · {{ intake.client }}
                    </option>
                  }
                </select></label
              ><label
                ><span class="field-label">Servicio</span
                ><input class="field" [(ngModel)]="service" name="service" required /></label
              ><label
                ><span class="field-label">Entrega prevista</span
                ><input
                  class="field"
                  type="date"
                  [(ngModel)]="dueDate"
                  name="dueDate"
                  required /></label
              ><label
                ><span class="field-label">Plantilla de materiales</span
                ><select class="field" [(ngModel)]="template" name="template">
                  <option>Pintura</option>
                  <option>Reparación</option>
                  <option>Preparación</option>
                </select></label
              ><label
                ><span class="field-label">Trabajadores (Ctrl + clic)</span
                ><select class="field min-h-28" multiple [(ngModel)]="workers" name="workers">
                  @for (employee of store.state().employees; track employee.id) {
                    <option [value]="employee.name">
                      {{ employee.name }} · {{ employee.role }}
                    </option>
                  }
                </select></label
              >
            </div>
            <button class="btn-primary mt-5 w-full">Crear orden vinculada</button>
          } @else {
            <div class="mt-6 rounded-xl border border-dashed p-8 text-center">
              <strong>No hay ingresos disponibles</strong>
              <p class="mt-2 text-sm text-slate-500">
                Registra primero un ingreso desde Clientes y acuerdos.
              </p>
              <a routerLink="/comercial" class="btn-primary mt-4">Ir a recepción</a>
            </div>
          }
        </form>
      </div>
    }
    @if (toast()) {
      <div
        class="fixed bottom-24 right-5 z-[80] rounded-2xl bg-slate-950 px-5 py-4 text-sm font-bold text-white"
      >
        {{ toast() }}
      </div>
    }
  `,
})
export class WorkOrdersPage {
  readonly store = inject(DemoStore);
  readonly search = signal('');
  readonly status = signal('Todas');
  readonly newOrderOpen = signal(false);
  readonly canSeeFinancial = computed(() =>
    ['Administrador', 'Gerente', 'Jefe de taller'].includes(this.store.state().role),
  );
  readonly toast = signal('');
  readonly availableIntakes = computed(() =>
    this.store
      .state()
      .intakes.filter((intake) => intake.status === 'Recibida' && !intake.workOrderId),
  );
  readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.store
      .state()
      .workOrders.filter(
        (order) =>
          (this.status() === 'Todas' || order.status === this.status()) &&
          (!query ||
            `${order.number} ${order.client} ${order.vehicle} ${order.service}`
              .toLowerCase()
              .includes(query)),
      );
  });
  clp = formatClp;
  intakeId = this.availableIntakes()[0]?.id ?? '';
  service = 'Reparación y pintura';
  dueDate = '2026-11-20';
  template: 'Pintura' | 'Reparación' | 'Preparación' = 'Pintura';
  workers: string[] = ['Jhony'];
  count(status: string) {
    return this.store.state().workOrders.filter((order) => order.status === status).length;
  }
  finished() {
    return this.store
      .state()
      .workOrders.filter((order) => ['Terminada', 'Entregada'].includes(order.status)).length;
  }
  withoutPrice() {
    return this.store.state().workOrders.filter((order) => order.salePrice === null).length;
  }
  profit(id: string) {
    return this.store.profitability(id);
  }
  createOrder() {
    try {
      const available = this.availableIntakes();
      const intake = available.find((item) => item.id === this.intakeId) ?? available[0];
      if (!intake) throw new Error('No hay un ingreso disponible.');
      const id = this.store.createWorkOrderFromIntake({
        intakeId: intake.id,
        service: this.service,
        dueDate: this.dueDate,
        assignedWorkers: this.workers,
        template: this.template,
      });
      this.newOrderOpen.set(false);
      this.show(`${this.store.order(id)?.number ?? 'OT'} creada y vinculada al ingreso.`);
    } catch (error) {
      this.show(error instanceof Error ? error.message : 'No se pudo crear la orden.');
    }
  }
  private show(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(''), 3400);
  }
}
