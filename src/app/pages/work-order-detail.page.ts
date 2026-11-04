import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { formatClp } from '../domain/calculations';
import { DemoStore } from '../services/demo-store.service';
import { LucideIconDirective } from '../shared/lucide-icon.directive';

interface RequestDraftLine {
  productId: string;
  quantity: number;
  note: string;
}

@Component({
  selector: 'app-work-order-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideIconDirective],
  template: `
    @if (order(); as current) {
      <a
        routerLink="/ordenes"
        class="mb-4 inline-flex items-center gap-2 text-xs font-extrabold text-slate-500 hover:text-[var(--fraespa-green-dark)]"
        ><span appLucide="ArrowLeft" [iconSize]="15"></span>Volver a órdenes</a
      >
      <section class="order-hero">
        <div class="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:p-8">
          <div>
            <div class="flex flex-wrap gap-2">
              <span class="hero-chip">{{ current.number }}</span
              ><span class="hero-chip brand-chip">{{ current.status }}</span
              ><span class="hero-chip">Rev. plan {{ current.materialPlanRevision ?? 1 }}</span>
            </div>
            <h1 class="mt-5 text-3xl font-black">{{ current.vehicle }} · {{ current.client }}</h1>
            <p class="mt-2 text-sm text-slate-300">
              {{ current.service }} · {{ current.brand }} {{ current.model }}
            </p>
            <div class="mt-6 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <span class="text-slate-400">Ingreso</span>
                <div class="font-extrabold">{{ current.intakeDate | date: 'dd MMM yyyy' }}</div>
              </div>
              <div>
                <span class="text-slate-400">Entrega prevista</span>
                <div class="font-extrabold">{{ current.dueDate | date: 'dd MMM yyyy' }}</div>
              </div>
              <div>
                <span class="text-slate-400">Responsables</span>
                <div class="font-extrabold">
                  {{ current.assignedWorkers.join(', ') || 'Sin asignar' }}
                </div>
              </div>
            </div>
          </div>
          <div class="hero-progress">
            <div class="text-xs text-slate-300">Avance físico</div>
            <div class="mt-1 text-4xl font-black">{{ current.progress }}%</div>
            <div class="progress-track mt-4 bg-white/10">
              <div class="progress-fill" [style.width.%]="current.progress"></div>
            </div>
            <p class="mt-4 text-xs text-slate-300">Separado del consumo presupuestario.</p>
          </div>
        </div>
      </section>
      <nav class="mt-5 flex gap-1 overflow-x-auto rounded-2xl border bg-white p-1.5">
        @for (item of tabs; track item.id) {
          <button
            class="tab-button"
            [class.tab-button-active]="tab() === item.id"
            (click)="tab.set(item.id)"
          >
            {{ item.label }}
          </button>
        }
      </nav>

      @if (tab() === 'resumen') {
        <section class="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <article class="panel">
            <div class="panel-header">
              <h2 class="panel-title">Etapas de producción</h2>
              <a routerLink="/produccion" class="brand-link">Abrir Gantt →</a>
            </div>
            <div class="p-5">
              @for (stage of current.stages; track stage.id) {
                <div class="mb-5">
                  <div class="mb-2 flex justify-between">
                    <div>
                      <strong>{{ stage.name }}</strong>
                      <div class="text-xs text-slate-500">
                        {{ stage.owner }} · {{ store.stageHours(current.id, stage.id) }}/{{
                          stage.plannedHours
                        }}
                        h
                      </div>
                    </div>
                    <span
                      class="badge"
                      [class.badge-success]="stage.progress === 100"
                      [class.badge-info]="stage.progress < 100"
                      >{{ stage.status }}</span
                    >
                  </div>
                  <div class="progress-track">
                    <div class="progress-fill" [style.width.%]="stage.progress"></div>
                  </div>
                </div>
              }
            </div>
          </article>
          @if (canSeeFinancial()) {
            <article class="panel p-5">
              <h2 class="panel-title">Control económico</h2>
              @if (profit(); as p) {
                @if (p.income === null) {
                  <div class="mt-6 rounded-2xl border border-dashed bg-slate-50 p-5 text-center">
                    <strong>Rentabilidad no disponible</strong>
                    <p class="mt-2 text-xs text-slate-500">
                      Falta precio de venta; no se inventan resultados.
                    </p>
                  </div>
                } @else {
                  <div class="mt-5 space-y-3 text-sm">
                    <div class="flex justify-between">
                      <span>Precio acordado</span><strong>{{ clp(p.income) }}</strong>
                    </div>
                    <div class="flex justify-between">
                      <span>Costo proyectado</span><strong>{{ clp(p.projectedFinalCost) }}</strong>
                    </div>
                    <div class="border-t pt-4">
                      <div class="text-xs text-slate-500">Margen proyectado</div>
                      <div
                        class="text-2xl font-black"
                        [class.text-red-600]="(p.projectedMargin ?? 0) < 0"
                        [class.text-emerald-700]="(p.projectedMargin ?? 0) >= 0"
                      >
                        {{ clp(p.projectedMargin) }}
                      </div>
                    </div>
                    <a routerLink="/rentabilidad" class="btn-primary w-full">Ver detalle</a>
                  </div>
                }
              }
            </article>
          } @else {
            <article class="panel p-5 text-center">
              <span appLucide="LockKeyhole" class="mx-auto text-slate-400"></span>
              <h2 class="mt-3 font-extrabold">Información económica restringida</h2>
              <p class="mt-2 text-xs text-slate-500">
                Los costos y márgenes requieren un rol autorizado.
              </p>
            </article>
          }
        </section>
      }

      @if (tab() === 'materiales') {
        <section class="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <article class="panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">Plan de materiales</h2>
                <p class="mt-1 text-xs text-slate-500">
                  Solicitado, entregado, devuelto, transferido y neto por material.
                </p>
              </div>
              <button class="btn-secondary" (click)="planOpen.set(!planOpen())">
                <span appLucide="Pencil"></span>Administrar plan
              </button>
            </div>
            @if (planOpen()) {
              <div class="border-b bg-slate-50 p-4">
                <div class="grid gap-3 md:grid-cols-[1fr_130px_auto]">
                  <select class="field" [(ngModel)]="planProduct">
                    @for (item of store.state().products; track item.id) {
                      <option [value]="item.id">{{ item.code }} · {{ item.description }}</option>
                    }</select
                  ><input class="field" type="number" min="0.1" [(ngModel)]="planQty" /><button
                    class="btn-primary"
                    (click)="savePlanLine()"
                  >
                    Agregar / actualizar
                  </button>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <select class="field max-w-xs" [(ngModel)]="copyFromOrder">
                    @for (item of copySources(); track item.id) {
                      <option [value]="item.id">{{ item.number }}</option>
                    }</select
                  ><button class="btn-secondary" (click)="copyPlan()">
                    Copiar plan de otra OT
                  </button>
                </div>
              </div>
            }
            <div class="table-shell">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Plan actual / original</th>
                    <th>Solicitado</th>
                    <th>Entregado</th>
                    <th>Devuelto</th>
                    <th>Transferido neto</th>
                    <th>Asignado neto</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of materialRows(); track row.product.id) {
                    <tr>
                      <td>
                        <strong>{{ row.product.code }}</strong>
                        <div class="text-xs text-slate-500">{{ row.product.description }}</div>
                      </td>
                      <td>{{ row.plan }} / {{ row.original }} {{ row.product.unit }}</td>
                      <td>{{ row.requested }}</td>
                      <td>{{ row.delivered }}</td>
                      <td>{{ row.returned }}</td>
                      <td>{{ row.transferred }}</td>
                      <td class="font-black">{{ row.net }}</td>
                      <td>
                        <button
                          class="icon-button"
                          [disabled]="row.net > 0"
                          (click)="removePlanLine(row.product.id)"
                        >
                          <span appLucide="Trash2" [iconSize]="16"></span>
                        </button>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="8" class="py-10 text-center">Sin plan registrado.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </article>
          <article class="panel p-5">
            <h2 class="panel-title">Nueva solicitud multítem</h2>
            <p class="mt-1 text-xs text-slate-500">
              Puedes solicitar materiales no planificados con justificación.
            </p>
            <form class="mt-5 space-y-4" (ngSubmit)="requestMaterial()">
              <label
                ><span class="field-label">Solicita</span
                ><input class="field" [(ngModel)]="requester" name="requester" /></label
              ><label
                ><span class="field-label">Recibe</span
                ><input class="field" [(ngModel)]="receiver" name="receiver" /></label
              ><label
                ><span class="field-label">Etapa</span
                ><select class="field" [(ngModel)]="requestStage" name="stage">
                  @for (stage of current.stages; track stage.id) {
                    <option [value]="stage.name">{{ stage.name }}</option>
                  }
                </select></label
              >
              <div class="space-y-3">
                @for (line of requestLines; track $index) {
                  <div class="rounded-xl border p-3">
                    <select class="field" [(ngModel)]="line.productId" [name]="'product' + $index">
                      @for (item of store.state().products; track item.id) {
                        <option [value]="item.id">{{ item.code }} · {{ item.description }}</option>
                      }
                    </select>
                    <div class="mt-2 flex gap-2">
                      <input
                        class="field"
                        type="number"
                        min="0.1"
                        step="0.1"
                        [(ngModel)]="line.quantity"
                        [name]="'qty' + $index"
                      /><button
                        type="button"
                        class="icon-button"
                        [disabled]="requestLines.length === 1"
                        (click)="removeRequestLine($index)"
                      >
                        <span appLucide="Trash2"></span>
                      </button>
                    </div>
                  </div>
                }
              </div>
              <button type="button" class="btn-secondary w-full" (click)="addRequestLine()">
                <span appLucide="Plus"></span>Agregar material</button
              ><label
                ><span class="field-label">Observaciones</span
                ><textarea
                  class="field"
                  rows="2"
                  [(ngModel)]="requestNote"
                  name="note"
                ></textarea></label
              ><label
                ><span class="field-label">Justificación de exceso / no planificado</span
                ><textarea
                  class="field"
                  rows="2"
                  [(ngModel)]="excessJustification"
                  name="justification"
                ></textarea></label
              ><button class="btn-primary w-full">Enviar a bodega</button>
            </form>
          </article>
        </section>
      }

      @if (tab() === 'vales') {
        <section class="panel mt-6">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Vales y movimientos</h2>
              <p class="mt-1 text-xs text-slate-500">Histórico inmutable y valorizado</p>
            </div>
            <a routerLink="/bodega" class="btn-secondary">Ir a bodega</a>
          </div>
          <div class="table-shell">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Referencia</th>
                  <th>Material</th>
                  <th>Cantidad</th>
                  @if (canSeeFinancial()) {
                    <th>Costo</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (movement of orderMovements(); track movement.id) {
                  <tr>
                    <td>{{ movement.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                    <td>
                      <span class="badge-info">{{ movement.type }}</span>
                    </td>
                    <td class="font-extrabold">{{ movement.reference }}</td>
                    <td>{{ product(movement.productId)?.description }}</td>
                    <td>{{ movement.quantity }}</td>
                    @if (canSeeFinancial()) {
                      <td>{{ clp(movement.allocationDelta * movement.unitCost) }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
      @if (toast()) {
        <div
          class="fixed bottom-24 right-5 z-50 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-bold text-white"
        >
          {{ toast() }}
        </div>
      }
    } @else {
      <div class="panel p-12 text-center">
        <h1 class="text-xl font-black">Orden no encontrada</h1>
        <a routerLink="/ordenes" class="btn-primary mt-4">Volver</a>
      </div>
    }
  `,
})
export class WorkOrderDetailPage {
  readonly store = inject(DemoStore);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  readonly order = computed(() => this.store.order(this.id));
  readonly profit = computed(() => this.store.profitability(this.id));
  readonly canSeeFinancial = computed(() =>
    ['Administrador', 'Gerente', 'Jefe de taller'].includes(this.store.state().role),
  );
  readonly orderMovements = computed(() =>
    this.store.state().movements.filter((movement) => movement.workOrderId === this.id),
  );
  readonly materialRows = computed(() =>
    (this.order()?.materialPlan ?? []).map((line) => {
      const product = this.product(line.productId)!;
      const requests = this.store
        .state()
        .requests.filter((request) => request.workOrderId === this.id)
        .flatMap((request) => request.lines)
        .filter((item) => item.productId === line.productId);
      const movements = this.orderMovements().filter(
        (movement) => movement.productId === line.productId,
      );
      return {
        product,
        plan: line.estimatedQty,
        original: line.originalEstimatedQty,
        requested: requests.reduce((sum, item) => sum + item.requestedQuantity, 0),
        delivered: movements
          .filter((item) => item.type === 'Despacho')
          .reduce((sum, item) => sum + item.quantity, 0),
        returned: movements
          .filter((item) => item.type === 'Devolución')
          .reduce((sum, item) => sum + item.quantity, 0),
        transferred: movements
          .filter((item) => item.type.includes('Transferencia'))
          .reduce((sum, item) => sum + item.allocationDelta, 0),
        net: this.store.allocated(this.id, line.productId),
      };
    }),
  );
  readonly copySources = computed(() =>
    this.store.state().workOrders.filter((item) => item.id !== this.id && item.materialPlan.length),
  );
  readonly tab = signal('resumen');
  readonly planOpen = signal(false);
  readonly toast = signal('');
  readonly tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'materiales', label: 'Plan y solicitudes' },
    { id: 'vales', label: 'Vales y movimientos' },
  ];
  requester = 'Jhony';
  receiver = 'Carlos';
  requestStage = 'Preparación y lijado';
  requestNote = '';
  excessJustification = '';
  requestLines: RequestDraftLine[] = [{ productId: 'DIS0011', quantity: 5, note: '' }];
  planProduct = 'DIS0011';
  planQty = 1;
  copyFromOrder = 'ot-128';
  clp = formatClp;
  product(id: string) {
    return this.store.product(id);
  }
  addRequestLine() {
    this.requestLines.push({ productId: 'CIN0010', quantity: 1, note: '' });
  }
  removeRequestLine(index: number) {
    this.requestLines.splice(index, 1);
  }
  requestMaterial() {
    try {
      this.store.createRequest({
        workOrderId: this.id,
        requester: this.requester,
        receiver: this.receiver,
        stage: this.requestStage,
        lines: this.requestLines.map((line) => ({ ...line, quantity: Number(line.quantity) })),
        note: this.requestNote,
        excessJustification: this.excessJustification,
      });
      this.requestLines = [{ productId: 'DIS0011', quantity: 1, note: '' }];
      this.show('Solicitud multítem enviada a bodega.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  savePlanLine() {
    try {
      this.store.updateMaterialPlan(this.id, this.planProduct, Number(this.planQty));
      this.show('Plan actualizado con nueva revisión.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  removePlanLine(productId: string) {
    try {
      this.store.removeMaterialPlanLine(this.id, productId);
      this.show('Línea retirada del plan.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  copyPlan() {
    try {
      this.store.copyMaterialPlan(this.copyFromOrder, this.id);
      this.show('Plan copiado y versionado.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  private message(error: unknown) {
    return error instanceof Error ? error.message : 'No fue posible guardar.';
  }
  private show(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(''), 3400);
  }
}
