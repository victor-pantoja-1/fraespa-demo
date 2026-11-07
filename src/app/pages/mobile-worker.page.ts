import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DemoStore } from '../services/demo-store.service';
import { LucideIconDirective } from '../shared/lucide-icon.directive';

@Component({
  selector: 'app-mobile-worker-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconDirective],
  template: `
    <div class="mx-auto max-w-[430px] overflow-hidden rounded-[28px] bg-[#0b0d0e] shadow-2xl">
      <header class="p-5 text-white">
        <div class="text-[10px] font-black uppercase tracking-[.2em] text-[#8bd56a]">
          FRAESPA móvil
        </div>
        <div class="mt-2 flex items-center justify-between">
          <div>
            <h1 class="text-xl font-black">
              {{ signedIn() ? 'Hola, Jhony' : 'Acceso de trabajador' }}
            </h1>
            <p class="mt-1 text-xs text-slate-400">{{ today | date: 'EEEE d MMMM' }}</p>
          </div>
          @if (signedIn()) {
            <span class="rounded-full bg-white/10 px-3 py-2 text-xs font-black">JH</span>
          }
        </div>
      </header>
      <main class="min-h-[640px] rounded-t-[28px] bg-slate-100 p-4">
        @if (!signedIn()) {
          <form class="rounded-2xl bg-white p-5 shadow-sm" (ngSubmit)="login()">
            <div class="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
              Trabajador seleccionado: Jhony
            </div>
            <label class="mt-5 block"
              ><span class="field-label">PIN de demostración</span
              ><input
                class="field min-h-12 text-center text-xl tracking-[.4em]"
                inputmode="numeric"
                maxlength="4"
                [(ngModel)]="pin"
                name="pin" /></label
            ><button class="mobile-action-primary mt-4" type="submit">
              <span appLucide="LogIn"></span>Ingresar
            </button>
            <p class="mt-3 text-center text-[11px] text-slate-500">
              PIN: 4085 · No es autenticación productiva.
            </p>
          </form>
        } @else if (view() === 'tasks') {
          <div class="mb-3 flex items-center justify-between">
            <div>
              <h2 class="font-black">Mis tareas</h2>
              <p class="text-xs text-slate-500">Solo procesos asignados a Jhony</p>
            </div>
            <button class="icon-button" type="button" (click)="view.set('requests')">
              <span appLucide="Inbox"></span>
            </button>
          </div>
          <div class="space-y-3">
            @for (task of tasks(); track task.order.id + task.stage.id) {
              <button
                class="w-full rounded-2xl bg-white p-4 text-left shadow-sm"
                type="button"
                (click)="selectTask(task.order.id, task.stage.id)"
              >
                <div class="flex justify-between gap-2">
                  <div>
                    <div class="text-xs font-black text-emerald-700">
                      {{ task.order.number }} · {{ task.order.licensePlate || task.order.vehicle }}
                    </div>
                    <h3 class="mt-1 text-base font-black">{{ task.stage.name }}</h3>
                  </div>
                  <span class="badge-info h-fit">{{ task.stage.status }}</span>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                  <span>OF {{ fileFor(task.order.workFileId)?.ofReference || 'OF-491' }}</span
                  ><span>Entrega {{ task.order.dueDate | date: 'dd/MM' }}</span
                  ><span class="col-span-2">{{ task.order.client }}</span>
                </div>
              </button>
            }
          </div>
        } @else if (view() === 'requests') {
          <button
            class="mb-4 flex items-center gap-1 text-xs font-black text-slate-600"
            type="button"
            (click)="view.set('tasks')"
          >
            <span appLucide="ChevronLeft"></span>Mis tareas
          </button>
          <h2 class="font-black">Mis solicitudes</h2>
          <div class="mt-3 space-y-3">
            @for (request of requests(); track request.id) {
              <article class="rounded-2xl bg-white p-4">
                <div class="flex justify-between gap-2">
                  <strong>{{ request.stage }}</strong
                  ><span class="badge-info">{{ friendlyStatus(request) }}</span>
                </div>
                <p class="mt-2 text-xs text-slate-500">
                  {{ request.createdAt | date: 'dd/MM HH:mm' }} ·
                  {{ request.lines.length }} material(es)
                </p>
              </article>
            } @empty {
              <p class="rounded-xl bg-white p-4 text-sm text-slate-500">
                No tienes solicitudes registradas.
              </p>
            }
          </div>
        } @else if (order(); as current) {
          @let process = stage();
          <button
            class="mb-4 flex items-center gap-1 text-xs font-black text-slate-600"
            type="button"
            (click)="view.set('tasks')"
          >
            <span appLucide="ChevronLeft"></span>Mis tareas
          </button>
          <article class="rounded-2xl bg-white p-5 shadow-sm">
            <div class="flex justify-between gap-2">
              <div>
                <div class="text-xs font-black text-emerald-700">
                  {{ current.number }} · {{ current.licensePlate || current.vehicle }}
                </div>
                <h2 class="mt-1 text-xl font-black">{{ process?.name }}</h2>
              </div>
              <span class="badge-warning h-fit">{{ process?.status }}</span>
            </div>
            <p class="mt-3 text-xs text-slate-500">
              {{ current.client }} · {{ current.physicalArea || 'Área por confirmar' }}
            </p>
            @if (view() === 'detail') {
              <div class="mt-5 grid gap-3">
                @if (!['En ejecución', 'Pausado', 'En revisión'].includes(process?.status || '')) {
                  <button class="mobile-action-primary" type="button" (click)="run('start')">
                    <span appLucide="Play"></span>Iniciar proceso
                  </button>
                }
                @if (process?.status === 'En ejecución') {
                  <button class="mobile-action" type="button" (click)="run('pause')">
                    <span appLucide="Pause"></span>Pausar
                  </button>
                }
                @if (process?.status === 'Pausado') {
                  <button class="mobile-action-primary" type="button" (click)="run('resume')">
                    <span appLucide="Play"></span>Reanudar
                  </button>
                }
                <button class="mobile-action" type="button" (click)="openRecipe()">
                  <span appLucide="ListChecks"></span>Ver receta y pedir</button
                ><button class="mobile-action" type="button" (click)="view.set('requests')">
                  <span appLucide="Inbox"></span>Consultar solicitudes</button
                ><button
                  class="mobile-action"
                  type="button"
                  (click)="run('finish')"
                  [disabled]="process?.status !== 'En ejecución'"
                >
                  <span appLucide="Flag"></span>Solicitar finalizar
                </button>
              </div>
            }
            @if (view() === 'recipe') {
              <div class="mt-5 space-y-3">
                @for (line of recipe(); track line.productId) {
                  @let item = store.product(line.productId); @let totals = summary(line.productId);
                  <div class="rounded-xl border border-slate-200 p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <strong class="text-sm">{{ item?.description }}</strong>
                        <p class="mt-1 text-[11px] text-slate-500">
                          Plan {{ line.estimatedQty }} {{ item?.unit }} · entregado
                          {{ totals.delivered }} · solicitado {{ totals.requested }}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        class="h-6 w-6"
                        [(ngModel)]="draft[line.productId].selected"
                      />
                    </div>
                    @if (draft[line.productId].selected) {
                      <div class="mt-3 flex items-center gap-2">
                        <button
                          class="quantity-button"
                          type="button"
                          (click)="adjust(line.productId, -1)"
                        >
                          −</button
                        ><input
                          class="field min-h-12 text-center text-lg font-black"
                          type="number"
                          [(ngModel)]="draft[line.productId].quantity"
                        /><button
                          class="quantity-button"
                          type="button"
                          (click)="adjust(line.productId, 1)"
                        >
                          +
                        </button>
                      </div>
                      @if (draft[line.productId].quantity > line.estimatedQty - totals.delivered) {
                        <p class="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-900">
                          Estás solicitando más de lo planificado.
                        </p>
                      }
                    }
                  </div>
                }
                <textarea
                  class="field"
                  rows="2"
                  [(ngModel)]="reason"
                  placeholder="Motivo si superas la receta"
                ></textarea
                ><button class="mobile-action-primary" type="button" (click)="submitRequest()">
                  <span appLucide="Send"></span>Enviar solicitud
                </button>
              </div>
            }
          </article>
        }
      </main>
      @if (toast()) {
        <div
          class="fixed bottom-6 left-1/2 z-50 w-[min(90vw,390px)] -translate-x-1/2 rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-bold text-white shadow-2xl"
        >
          {{ toast() }}
        </div>
      }
    </div>
  `,
})
export class MobileWorkerPage {
  readonly store = inject(DemoStore);
  readonly view = signal<'tasks' | 'detail' | 'recipe' | 'requests'>('tasks');
  readonly toast = signal('');
  readonly signedIn = computed(() => this.store.state().workerSession?.workerName === 'Jhony');
  readonly tasks = computed(() =>
    this.store
      .state()
      .workOrders.flatMap((order) =>
        order.stages
          .filter((stage) => (stage.assignedWorkers ?? [stage.owner]).includes('Jhony'))
          .map((stage) => ({ order, stage })),
      ),
  );
  readonly order = computed(() =>
    this.store.order(this.store.state().workerSession?.selectedWorkOrderId ?? ''),
  );
  readonly stage = computed(() =>
    this.order()?.stages.find(
      (stage) => stage.id === this.store.state().workerSession?.selectedStageId,
    ),
  );
  readonly recipe = computed(() =>
    this.order() && this.stage() ? this.store.recipeFor(this.order()!.id, this.stage()!.id) : [],
  );
  readonly requests = computed(() =>
    this.store.state().requests.filter((request) => request.requester === 'Jhony'),
  );
  readonly today = new Date();
  pin = '4085';
  reason = 'Superficie adicional detectada durante el lijado.';
  draft: Record<string, { selected: boolean; quantity: number }> = {};
  login() {
    try {
      this.store.identifyWorker('Jhony', this.pin);
      this.show('Bienvenido, Jhony.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  selectTask(orderId: string, stageId: string) {
    try {
      this.store.selectWorkerTask(orderId, stageId);
      this.view.set('detail');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  openRecipe() {
    const order = this.order();
    const stage = this.stage();
    if (!order || !stage) return;
    this.draft = Object.fromEntries(
      this.store
        .recipeFor(order.id, stage.id)
        .map((line) => [
          line.productId,
          {
            selected: line.productId === 'DIS0011',
            quantity: line.productId === 'DIS0011' ? 12 : line.estimatedQty,
          },
        ]),
    );
    this.view.set('recipe');
  }
  adjust(productId: string, delta: number) {
    this.draft[productId].quantity = Math.max(0, Number(this.draft[productId].quantity) + delta);
  }
  summary(productId: string) {
    const order = this.order();
    const stage = this.stage();
    return order && stage
      ? this.store.processMaterialSummary(order.id, stage.name, productId)
      : { requested: 0, authorized: 0, delivered: 0, requesters: [] };
  }
  submitRequest() {
    const order = this.order();
    const stage = this.stage();
    if (!order || !stage) return;
    try {
      const lines = Object.entries(this.draft)
        .filter(([, value]) => value.selected)
        .map(([productId, value]) => ({ productId, quantity: Number(value.quantity) }));
      this.store.createRequest({
        workOrderId: order.id,
        requester: 'Jhony',
        receiver: 'Antonella',
        stage: stage.name,
        lines,
        note: 'Solicitud enviada desde móvil.',
        excessJustification: this.reason,
      });
      this.view.set('requests');
      this.show('Solicitud enviada a bodega.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  run(action: 'start' | 'pause' | 'resume' | 'finish') {
    try {
      if (action === 'start') this.store.startSelectedProcess();
      if (action === 'pause')
        this.store.pauseSelectedProcess('Pausa operativa registrada desde móvil.');
      if (action === 'resume') this.store.resumeSelectedProcess();
      if (action === 'finish')
        this.store.requestFinishSelectedProcess('Proceso listo para validación.');
      this.show(
        action === 'finish'
          ? 'Finalización enviada a supervisión.'
          : 'Estado del proceso actualizado.',
      );
    } catch (error) {
      this.show(this.message(error));
    }
  }
  fileFor(id?: string) {
    return this.store.state().workFiles.find((file) => file.id === id);
  }
  friendlyStatus(request: { status: string; approval: { status: string } }) {
    if (request.status === 'En revisión') return 'En revisión';
    if (request.approval.status === 'Aprobada parcial') return 'Aprobada parcialmente';
    return request.status === 'Parcial' ? 'Entregada parcialmente' : request.status;
  }
  private show(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(''), 3500);
  }
  private message(error: unknown) {
    return error instanceof Error ? error.message : 'No se pudo completar la operación.';
  }
}
