import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { formatClp } from '../domain/calculations';
import { DemoStore } from '../services/demo-store.service';
import { LucideIconDirective } from '../shared/lucide-icon.directive';

@Component({
  selector: 'app-work-orders-page', standalone: true, imports: [CommonModule, FormsModule, RouterLink, LucideIconDirective],
  template: `
    <section class="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div class="eyebrow">Operación por unidad</div><h1 class="section-heading mt-1">Órdenes de trabajo</h1><p class="section-copy">OF y OT se mantienen como identificadores independientes.</p></div><button class="btn-primary"><span appLucide="Plus"></span>Nueva orden</button></section>
    <section class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><article class="stat-card"><div class="text-xs font-bold text-slate-500">En proceso</div><div class="stat-value">{{ count('En proceso') }}</div></article><article class="stat-card"><div class="text-xs font-bold text-slate-500">Control de calidad</div><div class="stat-value">{{ count('En control de calidad') }}</div></article><article class="stat-card"><div class="text-xs font-bold text-slate-500">Terminadas / entregadas</div><div class="stat-value">{{ finished() }}</div></article><article class="stat-card"><div class="text-xs font-bold text-slate-500">Sin precio de venta</div><div class="stat-value">{{ withoutPrice() }}</div></article></section>
    <section class="panel mt-6"><div class="panel-header"><div class="flex flex-1 flex-col gap-3 sm:flex-row"><label class="search-box max-w-md flex-1"><span appLucide="Search" [iconSize]="17"></span><input placeholder="Buscar por OT, OF, cliente o patente" [ngModel]="search()" (ngModelChange)="search.set($event)" /></label><select class="field max-w-[220px]" [ngModel]="status()" (ngModelChange)="status.set($event)"><option value="Todas">Todos los estados</option><option>En proceso</option><option>Terminada</option><option>Entregada</option><option>En control de calidad</option></select></div><span class="badge-neutral">{{ filtered().length }} registros</span></div>
      <div class="table-shell"><table class="data-table"><thead><tr><th>Orden</th><th>Cliente / unidad</th><th>Servicio</th><th>Avance</th><th>Estado</th><th>Costo proyectado</th><th></th></tr></thead><tbody>@for (order of filtered(); track order.id) { <tr><td><a [routerLink]="['/ordenes', order.id]" class="text-base font-black text-slate-950 hover:text-blue-600">{{ order.number }}</a><div class="mt-1 text-[11px] font-bold text-slate-400">{{ order.sourceLabel }}</div></td><td><div class="font-bold text-slate-800">{{ order.client }}</div><div class="mt-1 text-xs text-slate-500">{{ order.vehicle }} · {{ order.brand }}</div></td><td class="max-w-[260px]">{{ order.service }}</td><td><div class="flex w-32 items-center gap-2"><div class="progress-track flex-1"><div class="h-full rounded-full bg-blue-500" [style.width.%]="order.progress"></div></div><span class="text-xs font-black">{{ order.progress }}%</span></div></td><td><span class="badge" [class.badge-info]="order.status === 'En proceso'" [class.badge-success]="order.status === 'Terminada' || order.status === 'Entregada'" [class.badge-warning]="order.status === 'En control de calidad'">{{ order.status }}</span></td><td>@if (order.salePrice === null) { <span class="text-xs font-bold text-slate-400">Rentabilidad no disponible</span> } @else { <div class="font-extrabold text-slate-900">{{ clp(profit(order.id)?.projectedFinalCost ?? 0) }}</div><div class="mt-1 text-xs" [class.text-red-600]="(profit(order.id)?.projectedMargin ?? 0) < 0" [class.text-emerald-600]="(profit(order.id)?.projectedMargin ?? 0) >= 0">Margen {{ clp(profit(order.id)?.projectedMargin ?? 0) }}</div> }</td><td><a [routerLink]="['/ordenes', order.id]" class="icon-button"><span appLucide="ChevronRight" [iconSize]="17"></span></a></td></tr> } @empty { <tr><td colspan="7" class="py-12 text-center text-slate-500">No hay órdenes que coincidan con los filtros.</td></tr> }</tbody></table></div>
    </section>
  `,
})
export class WorkOrdersPage {
  readonly store = inject(DemoStore);
  readonly search = signal('');
  readonly status = signal('Todas');
  readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.store.state().workOrders.filter((order) => (this.status() === 'Todas' || order.status === this.status()) && (!query || `${order.number} ${order.client} ${order.vehicle} ${order.service}`.toLowerCase().includes(query)));
  });
  clp = formatClp;
  count(status: string) { return this.store.state().workOrders.filter((order) => order.status === status).length; }
  finished() { return this.store.state().workOrders.filter((order) => ['Terminada', 'Entregada'].includes(order.status)).length; }
  withoutPrice() { return this.store.state().workOrders.filter((order) => order.salePrice === null).length; }
  profit(id: string) { return this.store.profitability(id); }
}
