import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DemoStore } from '../services/demo-store.service';
import { LucideIconDirective } from '../shared/lucide-icon.directive';

@Component({
  selector: 'app-production-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconDirective],
  template: `
    <section class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <div class="eyebrow">Planificación de taller</div>
        <h1 class="section-heading mt-1">Producción y Gantt</h1>
        <p class="section-copy">Fechas reales del plan, avance por etapa y horas por trabajador.</p>
      </div>
      <label class="w-full md:w-96"
        ><span class="field-label">Orden activa</span
        ><select class="field" [ngModel]="selectedId()" (ngModelChange)="selectOrder($event)">
          @for (item of activeOrders(); track item.id) {
            <option [value]="item.id">{{ item.number }} · {{ item.vehicle }}</option>
          }
        </select></label
      >
    </section>
    @if (order(); as current) {
      <section class="mt-6 grid gap-4 md:grid-cols-4">
        <article class="stat-card">
          <div class="stat-label">Avance derivado</div>
          <div class="stat-value">{{ current.progress }}%</div>
          <div class="progress-track mt-3">
            <div class="progress-fill" [style.width.%]="current.progress"></div>
          </div>
        </article>
        <article class="stat-card">
          <div class="stat-label">Horas registradas</div>
          <div class="stat-value">{{ totalHours() }} h</div>
          <div class="stat-label">Partes diarios valorizados</div>
        </article>
        <article class="stat-card">
          <div class="stat-label">Entrega prevista</div>
          <div class="stat-value text-xl">{{ current.dueDate | date: 'dd MMM' }}</div>
          <div class="stat-label">{{ daysToDue() }} días desde el último registro</div>
        </article>
        <article class="stat-card">
          <div class="stat-label">Etapas activas</div>
          <div class="stat-value">{{ activeStages() }}</div>
          <div class="stat-label">{{ current.assignedWorkers.length }} responsables</div>
        </article>
      </section>
      <section class="panel mt-6 overflow-hidden">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Cronograma Gantt</h2>
            <p class="mt-1 text-xs text-slate-500">
              Posición y duración calculadas desde las fechas planificadas.
            </p>
          </div>
          <span class="badge-info"
            >{{ timelineStart() | date: 'dd MMM' }} — {{ timelineEnd() | date: 'dd MMM' }}</span
          >
        </div>
        <div class="overflow-x-auto p-5">
          <div class="min-w-[820px]">
            <div
              class="grid grid-cols-[220px_repeat(14,1fr)] border-b pb-3 text-center text-[10px] font-extrabold uppercase tracking-wide text-slate-400"
            >
              <div class="text-left">Etapa / responsable</div>
              @for (day of timelineDays(); track day) {
                <div>{{ day | date: 'dd' }}</div>
              }
            </div>
            @for (stage of current.stages; track stage.id) {
              <div
                class="grid grid-cols-[220px_repeat(14,1fr)] items-center border-b border-slate-100 py-4"
              >
                <div>
                  <div class="text-sm font-extrabold">{{ stage.name }}</div>
                  <div class="mt-1 text-xs text-slate-500">
                    {{ stage.owner }} · {{ stage.plannedStart | date: 'dd/MM' }}–{{
                      stage.plannedEnd | date: 'dd/MM'
                    }}
                  </div>
                </div>
                <div
                  class="col-span-14 grid h-9 grid-cols-14 items-center rounded-lg bg-slate-50 px-1"
                >
                  <div
                    class="gantt-bar"
                    [style.grid-column]="ganttColumn(stage.plannedStart, stage.plannedEnd)"
                  >
                    <div class="progress-fill h-full" [style.width.%]="stage.progress"></div>
                    <span>{{ stage.progress }}%</span>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      </section>
      <section class="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Control por etapa</h2>
              <p class="mt-1 text-xs text-slate-500">
                El avance total se recalcula desde las etapas.
              </p>
            </div>
          </div>
          <div class="divide-y divide-slate-100">
            @for (stage of current.stages; track stage.id) {
              <div class="grid gap-4 p-5 md:grid-cols-[1fr_220px_auto] md:items-center">
                <div>
                  <div class="font-extrabold">{{ stage.name }}</div>
                  <div class="mt-1 text-xs text-slate-500">
                    {{ stage.owner }} · {{ store.stageHours(current.id, stage.id) }} h /
                    {{ stage.plannedHours }} h plan
                  </div>
                </div>
                @if (canManageProgress()) {
                  <label
                    ><span class="field-label">Avance {{ stage.progress }}%</span
                    ><input
                      class="w-full accent-[var(--fraespa-green)]"
                      type="range"
                      min="0"
                      max="100"
                      [ngModel]="stage.progress"
                      (change)="saveStageProgress(stage.id, $any($event.target).value)"
                  /></label>
                }
                @if (canRecordHours()) {
                  <button class="btn-secondary" (click)="openHours(stage.id)">
                    <span appLucide="Clock3" [iconSize]="16"></span>Registrar horas
                  </button>
                }
              </div>
            }
          </div>
        </article>
        @if (canManageProgress()) {
          <article class="panel p-5">
            <h2 class="panel-title">Ajuste manual excepcional</h2>
            <p class="mt-1 text-xs leading-5 text-slate-500">
              Requiere una justificación auditable y no altera horas ni materiales.
            </p>
            <div class="mt-5 text-center text-5xl font-black text-[var(--fraespa-green-dark)]">
              {{ newProgress }}%
            </div>
            <input
              class="mt-5 w-full accent-[var(--fraespa-green)]"
              type="range"
              min="0"
              max="100"
              [(ngModel)]="newProgress"
            /><label class="mt-4 block"
              ><span class="field-label">Justificación obligatoria</span
              ><textarea class="field" rows="3" [(ngModel)]="progressReason"></textarea></label
            ><button class="btn-primary mt-4 w-full" (click)="saveProgress()">
              <span appLucide="Save"></span>Guardar ajuste
            </button>
          </article>
        }
      </section>
      @if (selectedStage) {
        <div
          class="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4"
          (click)="selectedStage = ''"
        >
          <form
            class="panel w-full max-w-lg p-6"
            (click)="$event.stopPropagation()"
            (ngSubmit)="saveHours()"
          >
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-black">Parte diario de horas</h2>
              <button type="button" class="icon-button" (click)="selectedStage = ''">
                <span appLucide="X"></span>
              </button>
            </div>
            <div class="mt-5 grid gap-4 sm:grid-cols-2">
              <label
                ><span class="field-label">Trabajador</span
                ><select class="field" [(ngModel)]="employeeId" name="employee">
                  @for (employee of store.state().employees; track employee.id) {
                    <option [value]="employee.id">{{ employee.name }} · {{ employee.role }}</option>
                  }
                </select></label
              ><label
                ><span class="field-label">Fecha</span
                ><input class="field" type="date" [(ngModel)]="entryDate" name="date" /></label
              ><label
                ><span class="field-label">Tipo</span
                ><select class="field" [(ngModel)]="hourType" name="type">
                  <option>Normal</option>
                  <option>Extra</option>
                  <option>Reproceso</option>
                </select></label
              ><label
                ><span class="field-label">Horas</span
                ><input
                  class="field"
                  type="number"
                  min="0.5"
                  step="0.5"
                  [(ngModel)]="hours"
                  name="hours"
              /></label>
            </div>
            <button class="btn-primary mt-5 w-full">Guardar registro</button>
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
    }
  `,
})
export class ProductionPage {
  readonly store = inject(DemoStore);
  readonly selectedId = signal('ot-125');
  readonly toast = signal('');
  readonly canManageProgress = computed(() =>
    ['Administrador', 'Jefe de taller'].includes(this.store.state().role),
  );
  readonly canRecordHours = computed(() =>
    ['Administrador', 'Jefe de taller', 'Trabajador'].includes(this.store.state().role),
  );
  readonly activeOrders = computed(() =>
    this.store
      .state()
      .workOrders.filter(
        (order) =>
          order.financialDataSimulated && !['Terminada', 'Entregada'].includes(order.status),
      ),
  );
  readonly order = computed(() => this.store.order(this.selectedId()));
  readonly totalHours = computed(
    () =>
      this.order()?.stages.reduce(
        (sum, stage) => sum + this.store.stageHours(this.selectedId(), stage.id),
        0,
      ) ?? 0,
  );
  readonly activeStages = computed(
    () => this.order()?.stages.filter((stage) => stage.status === 'En curso').length ?? 0,
  );
  readonly timelineStart = computed(
    () =>
      this.order()
        ?.stages.map((stage) => stage.plannedStart)
        .sort()[0] ??
      this.order()?.intakeDate ??
      new Date().toISOString().slice(0, 10),
  );
  readonly timelineEnd = computed(
    () =>
      this.order()
        ?.stages.map((stage) => stage.plannedEnd)
        .sort()
        .at(-1) ??
      this.order()?.dueDate ??
      new Date().toISOString().slice(0, 10),
  );
  readonly timelineDays = computed(() =>
    Array.from({ length: 14 }, (_, index) =>
      new Date(new Date(this.timelineStart() + 'T00:00:00').getTime() + index * 86400000)
        .toISOString()
        .slice(0, 10),
    ),
  );
  newProgress = 58;
  progressReason = '';
  selectedStage = '';
  employeeId = 'emp-jhony';
  entryDate = new Date().toISOString().slice(0, 10);
  hours = 2;
  hourType: 'Normal' | 'Extra' | 'Reproceso' = 'Normal';
  selectOrder(id: string) {
    this.selectedId.set(id);
    this.newProgress = this.order()?.progress ?? 0;
  }
  daysToDue() {
    const due = this.order()?.dueDate;
    const dates = [
      ...this.store.state().movements.map((item) => item.createdAt),
      ...this.store.state().timeEntries.map((item) => item.date),
    ];
    const reference = new Date(Math.max(...dates.map((item) => new Date(item).getTime())));
    return due ? Math.ceil((new Date(due).getTime() - reference.getTime()) / 86400000) : 0;
  }
  ganttColumn(start: string, end: string) {
    const base = new Date(this.timelineStart() + 'T00:00:00').getTime();
    const first = Math.max(1, Math.floor((new Date(start).getTime() - base) / 86400000) + 1);
    const span = Math.max(
      1,
      Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1,
    );
    return `${Math.min(14, first)} / span ${Math.min(span, 15 - Math.min(14, first))}`;
  }
  openHours(stageId: string) {
    if (!this.canRecordHours()) return;
    this.selectedStage = stageId;
    this.hours = 2;
  }
  saveStageProgress(stageId: string, value: number) {
    try {
      if (!this.canManageProgress()) throw new Error('El rol actual no puede cambiar avances.');
      this.store.updateStageProgress(this.selectedId(), stageId, Number(value));
    } catch (error) {
      this.show(this.message(error));
    }
  }
  saveProgress() {
    try {
      if (!this.canManageProgress()) throw new Error('El rol actual no puede ajustar avances.');
      this.store.updateProgress(this.selectedId(), Number(this.newProgress), this.progressReason);
      this.progressReason = '';
      this.show('Ajuste manual guardado con trazabilidad.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  saveHours() {
    try {
      if (!this.canRecordHours()) throw new Error('El rol actual no puede registrar horas.');
      this.store.recordHours(
        this.selectedId(),
        this.selectedStage,
        this.employeeId,
        this.entryDate,
        Number(this.hours),
        this.hourType,
      );
      this.selectedStage = '';
      this.show('Parte diario guardado y costo laboral recalculado.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  private message(error: unknown) {
    return error instanceof Error ? error.message : 'No se pudo completar la operación.';
  }
  private show(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(''), 3200);
  }
}
