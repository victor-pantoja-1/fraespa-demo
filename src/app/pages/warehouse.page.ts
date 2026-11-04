import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { exceedsPlan, formatClp } from '../domain/calculations';
import { MaterialRequest, MaterialVoucher } from '../domain/models';
import { DemoStore } from '../services/demo-store.service';
import { LucideIconDirective } from '../shared/lucide-icon.directive';

@Component({
  selector: 'app-warehouse-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconDirective],
  template: `
    <section class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <div class="eyebrow">Despachos trazables</div>
        <h1 class="section-heading mt-1">Bodega y vales</h1>
        <p class="section-copy">
          Entregas parciales multítem, devoluciones al costo histórico y transferencias sin alterar
          stock físico.
        </p>
      </div>
      <div class="flex gap-2">
        <button class="btn-secondary" (click)="scannerOpen.set(true)">
          <span appLucide="ScanBarcode"></span>Escanear código</button
        ><button class="btn-primary" (click)="viewVoucher(store.state().vouchers[0])">
          <span appLucide="Printer"></span>Último vale
        </button>
      </div>
    </section>
    <section class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article class="stat-card">
        <div class="stat-icon brand-soft"><span appLucide="Inbox"></span></div>
        <div class="stat-value">{{ store.pendingRequests().length }}</div>
        <div class="stat-label">Solicitudes pendientes</div>
      </article>
      <article class="stat-card">
        <div class="stat-icon bg-emerald-50 text-emerald-700">
          <span appLucide="ReceiptText"></span>
        </div>
        <div class="stat-value">{{ store.state().vouchers.length }}</div>
        <div class="stat-label">Vales emitidos</div>
      </article>
      <article class="stat-card">
        <div class="stat-icon bg-amber-50 text-amber-700">
          <span appLucide="TriangleAlert"></span>
        </div>
        <div class="stat-value">{{ requestsWithExcess() }}</div>
        <div class="stat-label">Solicitudes con advertencia</div>
      </article>
      <article class="stat-card">
        <div class="stat-icon bg-slate-100 text-slate-700"><span appLucide="Undo2"></span></div>
        <div class="stat-value">{{ returnsCount() }}</div>
        <div class="stat-label">Devoluciones trazadas</div>
      </article>
    </section>

    <section class="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Solicitudes por atender</h2>
            <p class="mt-1 text-xs text-slate-500">
              Revisa el saldo de cada línea antes de emitir el vale.
            </p>
          </div>
          <span class="badge-warning">{{ store.pendingRequests().length }} abiertas</span>
        </div>
        <div class="divide-y divide-slate-100">
          @for (request of store.pendingRequests(); track request.id) {
            @let order = workOrder(request.workOrderId);
            <div class="p-5">
              <div class="flex flex-col justify-between gap-4 lg:flex-row">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <strong>{{ order?.number }} · {{ order?.vehicle }}</strong
                    ><span
                      class="badge"
                      [class.badge-warning]="request.status === 'Parcial'"
                      [class.badge-info]="request.status === 'Pendiente'"
                      >{{ request.status }}</span
                    >
                  </div>
                  <div class="mt-2 text-xs text-slate-500">
                    Solicita {{ request.requester }} · recibe {{ request.receiver }} ·
                    {{ request.stage }}
                  </div>
                  <div class="mt-3 space-y-2">
                    @for (line of request.lines; track line.id) {
                      @let item = product(line.productId);
                      @let pending =
                        line.requestedQuantity - line.deliveredQuantity - line.closedQuantity;
                      <div class="flex flex-wrap gap-x-3 text-sm">
                        <strong>{{ item?.code }}</strong
                        ><span>{{ item?.description }}</span
                        ><span class="text-slate-500"
                          >Solicitado {{ line.requestedQuantity }} · entregado
                          {{ line.deliveredQuantity }} · pendiente {{ pending }}
                          {{ item?.unit }}</span
                        >
                      </div>
                    }
                  </div>
                </div>
                @if (canOperate()) {
                  <button class="btn-primary self-start" (click)="selectRequest(request)">
                    <span appLucide="PackageCheck" [iconSize]="17"></span>Revisar entrega
                  </button>
                }
              </div>
              @if (request.excessJustification) {
                <div
                  class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
                >
                  <strong>Justificación:</strong> {{ request.excessJustification }}
                </div>
              }
            </div>
          } @empty {
            <div class="p-12 text-center">
              <span
                appLucide="CircleCheckBig"
                [iconSize]="36"
                class="mx-auto text-emerald-600"
              ></span>
              <div class="mt-3 font-extrabold">Bodega al día</div>
            </div>
          }
        </div>
      </article>
      <article class="panel p-5">
        <div class="flex items-center justify-between">
          <h2 class="panel-title">Operaciones rápidas</h2>
          @if (canSeeCosts()) {
            <span class="badge-info">Costo histórico</span>
          }
        </div>
        @if (canOperate()) {
          <div class="mt-5 grid grid-cols-2 gap-2">
            <button
              class="operation-tab"
              [class.operation-tab-active]="operation() === 'return'"
              (click)="operation.set('return')"
            >
              <span appLucide="Undo2"></span>Devolución</button
            ><button
              class="operation-tab"
              [class.operation-tab-active]="operation() === 'transfer'"
              (click)="operation.set('transfer')"
            >
              <span appLucide="ArrowRightLeft"></span>Transferencia
            </button>
          </div>
        } @else {
          <p class="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
            El rol actual puede consultar vales, pero no ejecutar devoluciones ni transferencias.
          </p>
        }
        @if (canOperate() && operation() === 'return') {
          <form class="mt-5 space-y-4" (ngSubmit)="registerReturn()">
            <label
              ><span class="field-label">Vale original</span
              ><select
                class="field"
                [(ngModel)]="returnVoucher"
                name="voucher"
                (ngModelChange)="useVoucher($event)"
              >
                @for (voucher of dispatchVouchers(); track voucher.id) {
                  <option [value]="voucher.number">
                    {{ voucher.number }} · {{ workOrder(voucher.workOrderId)?.number }}
                  </option>
                }
              </select></label
            ><label
              ><span class="field-label">Material entregado</span
              ><select class="field" [(ngModel)]="returnProduct" name="product">
                @for (line of returnVoucherLines(); track line.productId) {
                  <option [value]="line.productId">
                    {{ product(line.productId)?.code }} · {{ product(line.productId)?.description }}
                  </option>
                }
              </select></label
            ><label
              ><span class="field-label">Cantidad utilizable</span
              ><input
                class="field"
                type="number"
                min="0.1"
                step="0.1"
                [(ngModel)]="returnQty"
                name="qty" /></label
            ><button class="btn-primary w-full">Registrar devolución</button>
          </form>
        }
        @if (canOperate() && operation() === 'transfer') {
          <form class="mt-5 space-y-4" (ngSubmit)="registerTransfer()">
            <label
              ><span class="field-label">OT origen</span
              ><select class="field" [(ngModel)]="transferFrom" name="from">
                @for (order of operationalOrders(); track order.id) {
                  <option [value]="order.id">{{ order.number }}</option>
                }
              </select></label
            ><label
              ><span class="field-label">OT destino</span
              ><select class="field" [(ngModel)]="transferTo" name="to">
                @for (order of operationalOrders(); track order.id) {
                  <option [value]="order.id">{{ order.number }}</option>
                }
              </select></label
            ><label
              ><span class="field-label">Material</span
              ><select class="field" [(ngModel)]="transferProduct" name="product">
                @for (item of assignedProducts(transferFrom); track item.id) {
                  <option [value]="item.id">{{ item.code }} · {{ item.description }}</option>
                }
              </select></label
            ><label
              ><span class="field-label">Cantidad</span
              ><input
                class="field"
                type="number"
                min="0.1"
                step="0.1"
                [(ngModel)]="transferQty"
                name="qty" /></label
            ><button class="btn-primary w-full">Transferir sin mover stock físico</button>
          </form>
        }
      </article>
    </section>

    <section class="panel mt-6">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Vales recientes</h2>
          <p class="mt-1 text-xs text-slate-500">
            Documento imprimible con costo unitario histórico por línea
          </p>
        </div>
      </div>
      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>Vale</th>
              <th>Fecha</th>
              <th>OT / unidad</th>
              <th>Solicita / recibe</th>
              <th>Líneas</th>
              @if (canSeeCosts()) {
                <th>Total</th>
              }
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (voucher of store.state().vouchers; track voucher.id) {
              <tr>
                <td class="font-black">{{ voucher.number }}</td>
                <td>{{ voucher.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  {{ workOrder(voucher.workOrderId)?.number }} ·
                  {{ workOrder(voucher.workOrderId)?.vehicle }}
                </td>
                <td>{{ voucher.requester }} / {{ voucher.receiver }}</td>
                <td>{{ voucher.lines.length }}</td>
                @if (canSeeCosts()) {
                  <td class="font-extrabold">{{ clp(voucherTotal(voucher)) }}</td>
                }
                <td>
                  <button class="btn-secondary" (click)="viewVoucher(voucher)">
                    <span appLucide="Printer" [iconSize]="16"></span>Ver
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    @if (selectedRequest(); as request) {
      <div class="modal-backdrop" (click)="selectedRequest.set(null)">
        <form
          class="panel w-full max-w-2xl p-6"
          (click)="$event.stopPropagation()"
          (ngSubmit)="dispatchSelected()"
        >
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-black">Confirmar entrega</h2>
              <p class="mt-1 text-xs text-slate-500">
                Puedes entregar parcialmente una o varias líneas.
              </p>
            </div>
            <button type="button" class="icon-button" (click)="selectedRequest.set(null)">
              <span appLucide="X"></span>
            </button>
          </div>
          <div class="mt-5 space-y-3">
            @for (line of request.lines; track line.id) {
              @let item = product(line.productId);
              @let pending = line.requestedQuantity - line.deliveredQuantity - line.closedQuantity;
              <div class="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_150px]">
                <div>
                  <strong>{{ item?.code }} · {{ item?.description }}</strong>
                  <div class="mt-1 text-xs text-slate-500">
                    Pendiente {{ pending }} {{ item?.unit }} · stock {{ stock(line.productId) }}
                  </div>
                </div>
                <label
                  ><span class="field-label">Entregar ahora</span
                  ><input
                    class="field"
                    type="number"
                    min="0"
                    [max]="pending"
                    step="0.1"
                    [(ngModel)]="deliveryAmounts[line.id]"
                    [name]="line.id"
                /></label>
              </div>
            }
          </div>
          <label class="mt-4 block"
            ><span class="field-label">Recibe</span
            ><input class="field" [(ngModel)]="deliveryReceiver" name="receiver" /></label
          ><label class="mt-4 block"
            ><span class="field-label">Justificación si supera el plan</span
            ><textarea
              class="field"
              rows="2"
              [(ngModel)]="deliveryJustification"
              name="justification"
            ></textarea></label
          ><button class="btn-primary mt-5 w-full">Emitir vale por lo entregado</button>
        </form>
      </div>
    }

    @if (scannerOpen()) {
      <div class="modal-backdrop" (click)="scannerOpen.set(false)">
        <div class="panel w-full max-w-md p-6" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-black">Consulta por código</h2>
            <button class="icon-button" (click)="scannerOpen.set(false)">
              <span appLucide="X"></span>
            </button>
          </div>
          <label class="mt-5 block"
            ><span class="field-label">Código o código de barras</span
            ><input
              class="field"
              autofocus
              [(ngModel)]="scanCode"
              (ngModelChange)="lookupScan()"
              placeholder="Ej. DIS0011"
          /></label>
          @if (scannedProduct(); as item) {
            <div class="mt-4 rounded-xl bg-slate-50 p-4">
              <strong>{{ item.code }}</strong>
              <div class="mt-1 text-sm">{{ item.description }}</div>
              <div class="mt-3 text-2xl font-black text-[var(--fraespa-green-dark)]">
                {{ stock(item.id) }} {{ item.unit }}
              </div>
              <div class="text-xs text-slate-500">
                Ubicación {{ item.location }} · mínimo {{ item.minimumStock }}
              </div>
            </div>
          } @else if (scanCode) {
            <div class="mt-4 text-sm text-red-600">No se encontró el material.</div>
          }
        </div>
      </div>
    }

    @if (selectedVoucher(); as voucher) {
      <div
        class="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 no-print"
        (click)="selectedVoucher.set(null)"
      >
        <article
          class="print-area w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl sm:p-10"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-start justify-between border-b-2 border-black pb-6">
            <div>
              <div class="text-2xl font-black tracking-tight">
                FRAESPA<span class="text-[var(--fraespa-green-dark)]">.</span>
              </div>
              <div class="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">
                Vale de salida de materiales
              </div>
            </div>
            <div class="text-right">
              <div class="text-xl font-black">{{ voucher.number }}</div>
              <div class="mt-1 text-xs text-slate-500">
                {{ voucher.createdAt | date: 'dd/MM/yyyy HH:mm' }}
              </div>
            </div>
          </div>
          <div class="grid gap-4 border-b py-6 text-sm sm:grid-cols-2">
            <div>
              <span class="text-slate-500">Orden / unidad</span>
              <div class="font-extrabold">
                {{ workOrder(voucher.workOrderId)?.number }} ·
                {{ workOrder(voucher.workOrderId)?.vehicle }}
              </div>
            </div>
            <div>
              <span class="text-slate-500">Cliente</span>
              <div class="font-extrabold">{{ workOrder(voucher.workOrderId)?.client }}</div>
            </div>
            <div>
              <span class="text-slate-500">Solicita / recibe</span>
              <div class="font-extrabold">{{ voucher.requester }} / {{ voucher.receiver }}</div>
            </div>
            <div>
              <span class="text-slate-500">Bodeguero / etapa</span>
              <div class="font-extrabold">{{ voucher.warehouseKeeper }} / {{ voucher.stage }}</div>
            </div>
          </div>
          <table class="my-6 w-full text-left text-sm">
            <thead>
              <tr class="border-b bg-slate-50">
                <th class="p-3">Código</th>
                <th class="p-3">Material</th>
                <th class="p-3 text-right">Cantidad</th>
                @if (canSeeCosts()) {
                  <th class="p-3 text-right">Costo</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (line of voucher.lines; track line.sourceMovementId) {
                <tr class="border-b">
                  <td class="p-3 font-bold">{{ product(line.productId)?.code }}</td>
                  <td class="p-3">{{ product(line.productId)?.description }}</td>
                  <td class="p-3 text-right">
                    {{ line.quantity }} {{ product(line.productId)?.unit }}
                  </td>
                  @if (canSeeCosts()) {
                    <td class="p-3 text-right">{{ clp(line.quantity * line.unitCost) }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
          <div class="grid grid-cols-2 gap-10 pt-12 text-center text-xs text-slate-500">
            <div class="border-t border-slate-400 pt-2">Firma de quien recibe</div>
            <div class="border-t border-slate-400 pt-2">Firma de bodega</div>
          </div>
          <div class="mt-8 flex justify-end gap-2 no-print">
            <button class="btn-secondary" (click)="selectedVoucher.set(null)">Cerrar</button
            ><button class="btn-primary" (click)="print()">
              <span appLucide="Printer"></span>Imprimir A4
            </button>
          </div>
        </article>
      </div>
    }
    @if (toast()) {
      <div
        class="fixed bottom-24 right-5 z-[80] max-w-sm rounded-2xl bg-slate-950 px-5 py-4 text-sm font-bold text-white shadow-2xl lg:bottom-6"
      >
        {{ toast() }}
      </div>
    }
  `,
})
export class WarehousePage {
  readonly store = inject(DemoStore);
  readonly selectedVoucher = signal<MaterialVoucher | null>(null);
  readonly selectedRequest = signal<MaterialRequest | null>(null);
  readonly scannerOpen = signal(false);
  readonly scannedProduct = signal<ReturnType<DemoStore['product']>>(undefined);
  readonly operation = signal<'return' | 'transfer'>('return');
  readonly toast = signal('');
  readonly canSeeCosts = computed(() =>
    ['Administrador', 'Gerente', 'Jefe de taller', 'Bodeguero', 'Compras'].includes(
      this.store.state().role,
    ),
  );
  readonly canOperate = computed(() =>
    ['Administrador', 'Jefe de taller', 'Bodeguero'].includes(this.store.state().role),
  );
  readonly operationalOrders = computed(() =>
    this.store.state().workOrders.filter((order) => order.financialDataSimulated),
  );
  readonly dispatchVouchers = computed(() =>
    this.store.state().vouchers.filter((voucher) => voucher.status === 'Emitido'),
  );
  deliveryAmounts: Record<string, number> = {};
  deliveryReceiver = '';
  deliveryJustification = '';
  scanCode = '';
  returnOrder = 'ot-125';
  returnVoucher = 'V-00091';
  returnProduct = 'DIS0011';
  returnQty = 1;
  transferFrom = 'ot-125';
  transferTo = 'ot-128';
  transferProduct = 'DIS0011';
  transferQty = 1;
  clp = formatClp;
  product(id: string) {
    return this.store.product(id);
  }
  workOrder(id: string) {
    return this.store.order(id);
  }
  stock(id: string) {
    return this.store.stock(id);
  }
  returnVoucherLines() {
    return (
      this.store.state().vouchers.find((voucher) => voucher.number === this.returnVoucher)?.lines ??
      []
    );
  }
  useVoucher(number: string) {
    const voucher = this.store.state().vouchers.find((item) => item.number === number);
    if (voucher) {
      this.returnOrder = voucher.workOrderId;
      this.returnProduct = voucher.lines[0]?.productId ?? '';
    }
  }
  requestsWithExcess() {
    return this.store
      .pendingRequests()
      .filter((request) =>
        request.lines.some(
          (line) =>
            exceedsPlan(
              this.store.order(request.workOrderId)!,
              line.productId,
              line.requestedQuantity - line.deliveredQuantity,
              this.store.state().movements,
            ).exceeds,
        ),
      ).length;
  }
  returnsCount() {
    return this.store.state().movements.filter((movement) => movement.type === 'Devolución').length;
  }
  selectRequest(request: MaterialRequest) {
    this.deliveryAmounts = Object.fromEntries(
      request.lines.map((line) => [
        line.id,
        Math.max(0, line.requestedQuantity - line.deliveredQuantity - line.closedQuantity),
      ]),
    );
    this.deliveryReceiver = request.receiver;
    this.deliveryJustification = request.excessJustification ?? '';
    this.selectedRequest.set(request);
  }
  dispatchSelected() {
    const request = this.selectedRequest();
    if (!request) return;
    try {
      if (!this.canOperate()) throw new Error('El rol actual no puede despachar materiales.');
      const deliveries = request.lines
        .map((line) => ({ lineId: line.id, quantity: Number(this.deliveryAmounts[line.id] ?? 0) }))
        .filter((line) => line.quantity > 0);
      const number = this.store.dispatchRequest(
        request.id,
        deliveries,
        this.deliveryReceiver,
        this.deliveryJustification,
      );
      this.selectedRequest.set(null);
      const voucher = this.store.state().vouchers.find((item) => item.number === number);
      if (voucher) this.selectedVoucher.set(voucher);
      this.show(`Vale ${number} emitido; los saldos pendientes permanecen abiertos.`);
    } catch (error) {
      this.show(this.message(error));
    }
  }
  assignedProducts(orderId: string) {
    return this.store.state().products.filter((item) => this.store.allocated(orderId, item.id) > 0);
  }
  voucherTotal(voucher: MaterialVoucher) {
    return voucher.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  }
  viewVoucher(voucher?: MaterialVoucher) {
    if (voucher) this.selectedVoucher.set(voucher);
  }
  print() {
    window.print();
  }
  lookupScan() {
    const query = this.scanCode.trim().toLowerCase();
    this.scannedProduct.set(
      this.store
        .state()
        .products.find(
          (item) => item.code.toLowerCase() === query || item.barcode.toLowerCase() === query,
        ),
    );
  }
  registerReturn() {
    try {
      if (!this.canOperate()) throw new Error('El rol actual no puede registrar devoluciones.');
      this.store.returnMaterial(
        this.returnOrder,
        this.returnProduct,
        Number(this.returnQty),
        this.returnVoucher,
      );
      this.show('Devolución registrada al costo histórico del vale.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  registerTransfer() {
    try {
      if (!this.canOperate()) throw new Error('El rol actual no puede registrar transferencias.');
      this.store.transferMaterial(
        this.transferFrom,
        this.transferTo,
        this.transferProduct,
        Number(this.transferQty),
      );
      this.show('Transferencia completada sin cambiar el stock físico.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  private message(error: unknown) {
    return error instanceof Error ? error.message : 'No fue posible completar la operación.';
  }
  private show(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(''), 3500);
  }
}
