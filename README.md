# FRAESPA

Demo comercial del **Sistema Integral de Gestión de Taller y Bodega**.

> Controlamos cada proceso. Conocemos cada costo.

La aplicación muestra cómo FRAESPA puede conectar acuerdos comerciales, ingresos de unidades, órdenes de trabajo, producción, materiales, vales, inventario y rentabilidad. Funciona sin backend y conserva las operaciones en IndexedDB.

## Tecnologías

- Angular 22 con componentes standalone y TypeScript estricto.
- Angular Signals para el estado reactivo de la interfaz.
- Tailwind CSS 4 y estilos de interfaz propios.
- Lucide para iconografía.
- Chart.js para gráficos gerenciales.
- Dexie sobre IndexedDB para persistencia local.
- Vitest mediante el runner de pruebas de Angular.

## Instalación y ejecución

Requisitos: Node.js 20.19 o superior y npm.

```bash
npm install
npm start
```

Abrir `http://localhost:4200`.

Para compilar y ejecutar pruebas:

```bash
npm run build
npm test -- --watch=false
```

## Funcionalidades implementadas

- Dashboard gerencial con indicadores derivados del estado, gráficos, alertas y actividad reciente.
- Cotizaciones antes del ingreso físico, aprobación de acuerdos y registro de recepción de unidades.
- Listado y ficha integral de OT, con OF y OT tratados como identificadores independientes.
- Etapas, responsables, horas reales y avance físico separados del consumo presupuestario.
- Plan de materiales con cantidades previstas, asignación neta, desviación y costo provisional.
- Solicitudes de bodega, alertas por exceso no bloqueantes y despacho con validación del stock total agrupado por producto, incluso cuando una solicitud repite el material en varias líneas.
- Vale correlativo con costo histórico, responsables, firmas y vista de impresión del navegador.
- Devoluciones utilizables que recuperan stock y reducen el costo provisional.
- Transferencias entre OT que cambian asignaciones sin duplicar ni mover stock físico.
- Inventario calculado desde saldos iniciales y movimientos, entradas y Kardex demostrativo.
- Rentabilidad con presupuesto original, costo acumulado, pendiente por categoría, adicionales y resultado final solo después de la conciliación económica.
- Registro de servicios externos y otros costos directos, recálculo explicable del saldo pendiente y cierre económico validado.
- Casos de OT rentable, con pérdida y en riesgo de sobrecosto.
- Historial y estimación explicable basada en trabajos comparables, sin afirmar uso de IA.
- Exportación CSV real de costos por OT, movimientos, materiales recibidos por trabajador, horas y mano de obra, y rentabilidad agrupada por mes.
- Selector demostrativo de roles y ocultación de datos financieros para roles no autorizados.
- Centro de sincronización demostrativo, modo offline, cola local y restauración del seed.
- Recorrido guiado de 12 escenas con línea base verificable, reconocimiento de operaciones nuevas y reinicio completo.
- Diseño responsive con navegación móvil y operaciones rápidas.
- Ruta `demo-flujo` para validar en una misma sesión la vista móvil de Jhony, la bandeja de Antonella y el registro de mezclas de pintura.
- Dos fórmulas preconfiguradas de ColorPro para `Red - 408A5` (concentrada y diluida), tratadas como alternativas excluyentes para un objetivo de 1 litro.
- Mapeo configurable entre códigos ColorPro y productos Softland, con peso recomendado, peso real, sobrantes, pérdidas y costo calculado desde inventario.
- Devolución de líquidos por peso bruto, tara y peso neto, con bloqueo de conversiones de gramos a litros cuando no existe una densidad validada.

## Datos de referencia

Los productos de demostración reutilizan códigos, descripciones, saldos y costos verificados en los Excel entregados. Los casos históricos preservan sus identificadores como referencias; no se infieren relaciones entre OF y OT.

Los precios de venta, costos laborales, indirectos y resultados comerciales están marcados como simulados. Cuando un registro histórico no tiene precio de venta, la interfaz muestra **“Rentabilidad no disponible — falta precio de venta”**.

En el caso ficticio OT-125, el presupuesto por categorías suma **$2.200.000** y coincide con el costo estimado de la cotización COT-2026-041. Las horas ficticias se distribuyen en días hábiles y jornadas de hasta ocho horas. Los criterios demostrativos de asignación de gastos indirectos y administrativos se muestran junto al cálculo económico.

## Estructura

```text
src/app/
├── data/          Seed reproducible y referencias verificadas
├── domain/        Entidades, cálculos y pruebas de reglas de negocio
├── pages/         Pantallas funcionales por módulo
├── services/      Estado, operaciones e IndexedDB
└── shared/        Directivas y piezas reutilizables
```

## Restaurar datos de demostración

1. Abrir **Centro de sincronización**.
2. Pulsar **Restaurar datos de demostración**.
3. Confirmar la operación.

Esto reemplaza únicamente el estado local de la demo. Los Excel originales no se modifican.

## Limitaciones de la demo

- No hay autenticación productiva; el selector de rol demuestra visibilidad, no seguridad de backend.
- La sincronización multi-dispositivo es simulada. IndexedDB sí guarda datos reales en el navegador.
- No se conecta a facturación tributaria ni servicios fiscales.
- Fotografías, documentos y firma digital productiva requieren almacenamiento y backend.
- Las funciones complementarias de compras, herramientas, pinturas y calidad se muestran a nivel demostrativo, sin integración contable.
- No se incluye importación automática de Excel; los datos usados fueron curados para evitar relaciones históricas no verificadas.
- La lectura de las capturas de ColorPro es una simulación con fórmulas preconfiguradas. No existe OCR ni conexión directa con ColorPro.
- El valor de venta mostrado en ColorPro no se usa como costo. Los costos de mezcla provienen de los productos de inventario mapeados.
- El mapeo `THINNER W` es provisional y queda marcado para validación; la demo no afirma que el código de ColorPro coincida con un producto Softland.
- El archivo `STOCK DE BODEGA AL 06-11-2026.xlsx` contiene un encabezado interno con fecha 30/11/2026. La demo muestra esta discrepancia y no presenta el stock como conciliado físicamente.

## Evolución hacia producción

1. Empaquetar la UI con Tauri y usar SQLite como base local transaccional.
2. Implementar un backend NestJS con PostgreSQL, autenticación y autorización por permisos.
3. Crear un registro de operaciones idempotentes para sincronización offline-first y resolución de conflictos.
4. Definir una autoridad de bodega por almacén para evitar despachos duplicados mientras no hay conexión.
5. Importar los Excel a un área de staging, validar códigos y relaciones, deduplicar y aprobar antes de publicar.
6. Incorporar respaldos, auditoría inmutable, telemetría, cifrado y políticas de retención.
7. Añadir almacenamiento de documentos e imágenes, facturación integrada y notificaciones reales.

## Reglas verificadas por pruebas

- Existencias por movimientos.
- Rechazo atómico de dos líneas del mismo producto cuya suma supera el stock disponible.
- Valorización histórica de vales.
- Devoluciones y ajuste de asignación.
- Transferencias sin duplicación de stock.
- Alertas por exceso del plan.
- Costos de mano de obra.
- Rentabilidad dentro del presupuesto y sobrecosto real, sin duplicar el costo pendiente al registrar materiales u horas.
- Separación de presupuesto original, acumulado, pendiente y adicional.
- Distribución de horas ficticias en jornadas razonables.
- Serialización completa del estado para persistencia local.

## Resultado de la auditoría final

Ejecución del 6 de noviembre de 2026:

- `npm test -- --watch=false`: **26 pruebas aprobadas**.
- `npm run build`: **compilación de producción aprobada**.
- No se añadió una suite E2E porque el repositorio no incluye un runner de navegador. El flujo central, la antiduplicación de la mezcla y las devoluciones por peso están cubiertos por pruebas integradas del estado y las reglas de negocio.
- La revisión interactiva de escritorio, móvil y el diálogo real de impresión no pudo completarse en el entorno automatizado porque el controlador no pudo vincular con seguridad la URL del navegador local. La compilación responsive y la hoja `@media print` A4 sí forman parte del build; antes de la presentación debe realizarse una comprobación manual final en el navegador y la impresora/PDF objetivo.
