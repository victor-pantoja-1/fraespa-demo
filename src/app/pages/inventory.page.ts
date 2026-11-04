import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatClp } from '../domain/calculations';
import { DemoStore } from '../services/demo-store.service';
import { LucideIconDirective } from '../shared/lucide-icon.directive';

@Component({
  selector: 'app-inventory-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconDirective],
  template: `
    <section class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <div class="eyebrow">Catálogo basado en Excel</div>
        <h1 class="section-heading mt-1">Inventario y productos</h1>
        <p class="section-copy">Stock calculado desde saldo inicial y movimientos; sin BUSCARV.</p>
      </div>
      <button class="btn-primary" (click)="entryOpen.set(true)">
        <span appLucide="PackagePlus"></span>Registrar entrada
      </button>
    </section>
    <section class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article class="stat-card">
        <div class="text-xs font-bold text-slate-500">Productos activos</div>
        <div class="stat-value">{{ store.state().products.length }}</div>
        <div class="stat-label">Catálogo demostrativo curado</div>
      </article>
      <article class="stat-card">
        <div class="text-xs font-bold text-slate-500">Valor de inventario</div>
        <div class="stat-value text-xl">{{ clp(inventoryValue()) }}</div>
        <div class="stat-label">Costo vigente × stock físico</div>
      </article>
      <article class="stat-card">
        <div class="text-xs font-bold text-slate-500">Stock crítico</div>
        <div class="stat-value text-red-600">{{ criticalCount() }}</div>
        <div class="stat-label">Igual o bajo el mínimo</div>
      </article>
      <article class="stat-card">
        <div class="text-xs font-bold text-slate-500">Movimientos trazables</div>
        <div class="stat-value">{{ store.state().movements.length }}</div>
        <div class="stat-label">Incluye despachos y transferencias</div>
      </article>
    </section>
    <section class="panel mt-6">
      <div class="panel-header">
        <div class="flex flex-1 flex-col gap-3 md:flex-row">
          <label class="search-box max-w-lg flex-1"
            ><span appLucide="Search" [iconSize]="17"></span
            ><input
              placeholder="Código, descripción o código de barras"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)" /></label
          ><select
            class="field max-w-[220px]"
            [ngModel]="category()"
            (ngModelChange)="category.set($event)"
          >
            <option value="Todas">Todas las categorías</option>
            @for (item of categories(); track item) {
              <option [value]="item">{{ item }}</option>
            }
          </select>
        </div>
        <span class="badge-info">{{ rows().length }} productos</span>
      </div>
      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Ubicación</th>
              <th>Stock físico</th>
              <th>Mínimo</th>
              <th>Costo vigente</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.product.id) {
              <tr>
                <td>
                  <div class="font-black text-slate-950">{{ row.product.code }}</div>
                  <div class="mt-1 max-w-md text-xs text-slate-500">
                    {{ row.product.description }}
                  </div>
                  <div
                    class="mt-1 text-[10px] font-bold uppercase tracking-wide"
                    [class.text-[var(--fraespa-green-dark)]]="
                      row.product.source === 'Excel verificado'
                    "
                    [class.text-amber-600]="row.product.source === 'Demostración'"
                  >
                    {{ row.product.source }}
                  </div>
                </td>
                <td>
                  <span class="badge-neutral">{{ row.product.category }}</span>
                </td>
                <td class="font-mono text-xs">{{ row.product.location }}</td>
                <td class="text-base font-black" [class.text-red-600]="row.critical">
                  {{ row.stock | number: '1.0-2' }} {{ row.product.unit }}
                </td>
                <td>{{ row.product.minimumStock }} {{ row.product.unit }}</td>
                <td>{{ clp(row.product.unitCost) }}</td>
                <td>
                  <span
                    class="badge"
                    [class.badge-danger]="row.critical"
                    [class.badge-success]="!row.critical"
                    >{{ row.critical ? 'Crítico' : 'Disponible' }}</span
                  >
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel mt-6">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Libro de movimientos</h2>
          <p class="mt-1 text-xs text-slate-500">
            El costo aplicado en cada movimiento queda congelado
          </p>
        </div>
      </div>
      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Referencia</th>
              <th>Producto</th>
              <th>Delta stock</th>
              <th>OT</th>
              <th>Costo histórico</th>
            </tr>
          </thead>
          <tbody>
            @for (movement of store.state().movements.slice(0, 12); track movement.id) {
              <tr>
                <td>{{ movement.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  <span class="badge-neutral">{{ movement.type }}</span>
                </td>
                <td class="font-bold">{{ movement.reference }}</td>
                <td>{{ movement.productId }}</td>
                <td
                  class="font-extrabold"
                  [class.text-red-600]="movement.stockDelta < 0"
                  [class.text-emerald-600]="movement.stockDelta > 0"
                >
                  {{ movement.stockDelta > 0 ? '+' : '' }}{{ movement.stockDelta }}
                </td>
                <td>{{ orderNumber(movement.workOrderId) }}</td>
                <td>{{ clp(movement.unitCost) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
    @if (entryOpen()) {
      <div
        class="fixed inset-0 z-[70] grid place-items-center bg-slate-950/50 p-4"
        (click)="entryOpen.set(false)"
      >
        <form
          class="panel w-full max-w-lg p-6"
          (click)="$event.stopPropagation()"
          (ngSubmit)="saveEntry()"
        >
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-black">Entrada de material</h2>
              <p class="mt-1 text-xs text-slate-500">
                El nuevo costo no altera despachos históricos.
              </p>
            </div>
            <button type="button" class="icon-button" (click)="entryOpen.set(false)">
              <span appLucide="X"></span>
            </button>
          </div>
          <div class="mt-6 space-y-4">
            <label
              ><span class="field-label">Producto</span
              ><select class="field" [(ngModel)]="entryProduct" name="entryProduct">
                @for (item of store.state().products; track item.id) {
                  <option [value]="item.id">{{ item.code }} · {{ item.description }}</option>
                }
              </select></label
            >
            <div class="grid grid-cols-2 gap-3">
              <label
                ><span class="field-label">Cantidad</span
                ><input
                  class="field"
                  type="number"
                  min="0.1"
                  step="0.1"
                  [(ngModel)]="entryQty"
                  name="entryQty" /></label
              ><label
                ><span class="field-label">Costo unitario</span
                ><input
                  class="field"
                  type="number"
                  min="0"
                  [(ngModel)]="entryCost"
                  name="entryCost"
              /></label>
            </div>
            <label
              ><span class="field-label">Documento / referencia</span
              ><input
                class="field"
                [(ngModel)]="entryReference"
                name="entryReference"
                placeholder="FAC-2381" /></label
            ><button class="btn-primary w-full">Guardar entrada</button>
          </div>
        </form>
      </div>
    }
    @if (toast()) {
      <div
        class="fixed bottom-24 right-5 z-[80] rounded-2xl bg-slate-950 px-5 py-4 text-sm font-bold text-white shadow-2xl lg:bottom-6"
      >
        {{ toast() }}
      </div>
    }
  `,
})
export class InventoryPage {
  readonly store = inject(DemoStore);
  readonly search = signal('');
  readonly category = signal('Todas');
  readonly entryOpen = signal(false);
  readonly toast = signal('');
  readonly categories = computed(() =>
    [...new Set(this.store.state().products.map((item) => item.category))].sort(),
  );
  readonly rows = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.store
      .state()
      .products.filter(
        (item) =>
          (this.category() === 'Todas' || item.category === this.category()) &&
          (!query ||
            `${item.code} ${item.description} ${item.barcode}`.toLowerCase().includes(query)),
      )
      .map((item) => {
        const stock = this.store.stock(item.id);
        return { product: item, stock, critical: stock <= item.minimumStock };
      });
  });
  readonly inventoryValue = computed(() =>
    this.store
      .state()
      .products.reduce((sum, item) => sum + this.store.stock(item.id) * item.unitCost, 0),
  );
  readonly criticalCount = computed(
    () =>
      this.store.state().products.filter((item) => this.store.stock(item.id) <= item.minimumStock)
        .length,
  );
  entryProduct = 'DIS0011';
  entryQty = 50;
  entryCost = 780;
  entryReference = 'FAC-DEMO-001';
  clp = formatClp;
  orderNumber(id?: string) {
    return id ? (this.store.order(id)?.number ?? '—') : '—';
  }
  saveEntry(): void {
    try {
      this.store.registerInventoryEntry(
        this.entryProduct,
        Number(this.entryQty),
        Number(this.entryCost),
        this.entryReference,
      );
      this.entryOpen.set(false);
      this.show('Entrada guardada. Stock actualizado.');
    } catch (error) {
      this.show(error instanceof Error ? error.message : 'No se pudo guardar.');
    }
  }
  private show(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(''), 3200);
  }
}
