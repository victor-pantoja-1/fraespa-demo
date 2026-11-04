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
- Solicitudes de bodega, alertas por exceso no bloqueantes y despacho con validación de stock.
- Vale correlativo con costo histórico, responsables, firmas y vista de impresión del navegador.
- Devoluciones utilizables que recuperan stock y reducen el costo provisional.
- Transferencias entre OT que cambian asignaciones sin duplicar ni mover stock físico.
- Inventario calculado desde saldos iniciales y movimientos, entradas y Kardex demostrativo.
- Rentabilidad presupuestada, proyectada y final; margen de contribución y resultado gerencial.
- Casos de OT rentable, con pérdida y en riesgo de sobrecosto.
- Historial y estimación explicable basada en trabajos comparables, sin afirmar uso de IA.
- Exportación CSV real de órdenes y resultados.
- Selector demostrativo de roles y ocultación de datos financieros para roles no autorizados.
- Centro de sincronización demostrativo, modo offline, cola local y restauración del seed.
- Recorrido guiado de 12 escenas para el caso Transportes ABC.
- Diseño responsive con navegación móvil y operaciones rápidas.

## Datos de referencia

Los productos de demostración reutilizan códigos, descripciones, saldos y costos verificados en los Excel entregados. Los casos históricos preservan sus identificadores como referencias; no se infieren relaciones entre OF y OT.

Los precios de venta, costos laborales, indirectos y resultados comerciales están marcados como simulados. Cuando un registro histórico no tiene precio de venta, la interfaz muestra **“Rentabilidad no disponible — falta precio de venta”**.

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
- Valorización histórica de vales.
- Devoluciones y ajuste de asignación.
- Transferencias sin duplicación de stock.
- Alertas por exceso del plan.
- Costos de mano de obra.
- Rentabilidad y separación de costo acumulado/proyectado.
- Serialización completa del estado para persistencia local.
