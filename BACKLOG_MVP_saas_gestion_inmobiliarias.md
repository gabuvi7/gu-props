# Backlog MVP — GU-Props

**Producto:** GU-Props  
**Tipo:** Plataforma SaaS multi-tenant para gestión inmobiliaria  
**Fuente principal:** `PRD_saas_gestion_inmobiliarias.md`  
**Estado:** Backlog inicial para estimación y planificación

---

## 1. Objetivo del backlog

Este backlog convierte el PRD de GU-Props en unidades funcionales ejecutables para construir el MVP. El foco es validar el core operativo con Vergani Propiedades como primer tenant, sin perder la capacidad de reutilizar la plataforma con otras inmobiliarias.

El MVP debe priorizar:

- Multi-tenancy seguro.
- Gestión de alquileres.
- Contratos.
- Pagos y caja.
- Ajustes por índices.
- Liquidaciones PDF.
- Auditoría mínima.

---

## 2. Criterios de priorización

| Prioridad | Significado |
| --- | --- |
| P0 | Imprescindible para operar el MVP en producción. |
| P1 | Necesario para una operación comercial sólida, pero puede entrar luego del primer corte funcional. |
| P2 | Mejora, optimización o preparación para escala. No bloquea el MVP piloto. |

---

## Estado de implementación

**Leyenda:**

- ✅ Hecho: implementado con estructura funcional y tests preparados.
- 🟡 Parcial: existe base/skeleton o parte del flujo, pero todavía no cumple todos los criterios.
- ⬜ Pendiente: todavía no implementado.

**Avance actual:**

| Estado | User Stories |
| --- | --- |
| ✅ Hechas | US-001, US-002, US-004, US-010, US-011, US-012, US-014, US-016, US-017, US-018, US-019 |
| 🟡 Parciales | US-003, US-006, US-007, US-008, US-015 |
| ⬜ Pendientes | US-005, US-009, US-013, US-020, US-021, US-022, US-023, US-024, US-025, US-026, US-027, US-028, US-029, US-030, US-031, US-032, US-033, US-034 |

> Nota: se considera “parcial” cuando hay modelo, helper o endpoint inicial, pero falta completar el comportamiento final del criterio de aceptación. No nos hacemos trampa, porque ahí es donde los proyectos se desordenan.

---

## 3. Épicas del MVP

1. Base SaaS y multi-tenancy.
2. Autenticación, usuarios y roles.
3. Configuración de inmobiliaria.
4. Propietarios.
5. Inquilinos.
6. Propiedades.
7. Contratos de alquiler.
8. Índices y ajustes.
9. Pagos y caja.
10. Liquidaciones y PDFs.
11. Reportes básicos.
12. Auditoría y seguridad operativa.
13. Onboarding del tenant piloto.

---

## 4. Backlog por épica

## Épica 1 — Base SaaS y multi-tenancy

### ✅ US-001 — Crear modelo de Tenant

**Prioridad:** P0  
**Como** administrador SaaS,  
**quiero** crear una inmobiliaria como tenant,  
**para** que opere de forma aislada dentro de la plataforma.

**Criterios de aceptación:**

- Existe una entidad Tenant con nombre, slug, estado y datos básicos.
- Cada tenant puede estar activo, suspendido o desactivado.
- El slug puede usarse para resolver subdominios.
- No se permite crear dos tenants con el mismo slug.

---

### ✅ US-002 — Agregar tenant_id a entidades de negocio

**Prioridad:** P0  
**Como** plataforma SaaS,  
**quiero** que todas las entidades de negocio pertenezcan a un tenant,  
**para** evitar mezcla de datos entre inmobiliarias.

**Criterios de aceptación:**

- Propietarios, inquilinos, propiedades, contratos, pagos, movimientos, liquidaciones y documentos tienen `tenant_id`.
- No se puede crear una entidad de negocio sin tenant asociado.
- Las consultas de negocio filtran por `tenant_id`.

---

### 🟡 US-003 — Implementar contexto de request

**Prioridad:** P0  
**Como** backend,  
**quiero** conocer usuario, tenant, rol y requestId en cada request,  
**para** aplicar seguridad, auditoría y trazabilidad.

**Criterios de aceptación:**

- Cada request autenticada tiene `userId`, `tenantId`, `role` y `requestId`.
- El contexto está disponible para servicios, guards y repositories.
- Si falta tenant activo, la request falla con error controlado.

---

### ✅ US-004 — Crear repositories tenant-aware

**Prioridad:** P0  
**Como** equipo técnico,  
**quiero** que el acceso a datos aplique tenant automáticamente,  
**para** reducir el riesgo de fugas entre tenants.

**Criterios de aceptación:**

- Las búsquedas por id usan `id + tenant_id`.
- Las listas devuelven solo registros del tenant activo.
- Las actualizaciones y bajas validan pertenencia al tenant.
- Existe al menos una prueba de aislamiento entre tenants.

---

## Épica 2 — Autenticación, usuarios y roles

### ⬜ US-005 — Login de usuario

**Prioridad:** P0  
**Como** usuario de una inmobiliaria,  
**quiero** iniciar sesión,  
**para** acceder al sistema de forma segura.

**Criterios de aceptación:**

- El usuario puede autenticarse con credenciales válidas.
- El sistema rechaza credenciales inválidas.
- El token/session identifica al usuario.
- El sistema no expone datos sensibles en errores.

---

### 🟡 US-006 — Asociación usuario-tenant

**Prioridad:** P0  
**Como** administrador SaaS,  
**quiero** asociar usuarios a inmobiliarias,  
**para** controlar quién puede operar cada tenant.

**Criterios de aceptación:**

- Existe relación entre User y Tenant.
- Un usuario puede pertenecer a uno o más tenants.
- Cada relación incluye rol.
- Un usuario no puede acceder a tenants donde no está asociado.

---

### 🟡 US-007 — Roles y permisos básicos

**Prioridad:** P0  
**Como** dueño de inmobiliaria,  
**quiero** roles diferenciados,  
**para** limitar acciones según responsabilidad.

**Roles iniciales:**

- Owner.
- Admin.
- Operador.
- Readonly.

**Criterios de aceptación:**

- Owner/Admin pueden administrar usuarios y configuración.
- Operador puede gestionar operación diaria sin modificar permisos críticos.
- Readonly solo puede consultar.
- Acciones no permitidas devuelven error de autorización.

---

## Épica 3 — Configuración de inmobiliaria

### 🟡 US-008 — Configurar datos básicos del tenant

**Prioridad:** P0  
**Como** administrador de inmobiliaria,  
**quiero** configurar nombre, logo y parámetros básicos,  
**para** adaptar el sistema a mi operación.

**Criterios de aceptación:**

- Se puede configurar nombre comercial.
- Se puede cargar o referenciar logo.
- Se pueden configurar parámetros operativos básicos.
- La configuración se aplica solo al tenant activo.

---

### ⬜ US-009 — Resolver tenant por subdominio

**Prioridad:** P1  
**Como** usuario de inmobiliaria,  
**quiero** ingresar por un subdominio propio,  
**para** acceder a mi instancia de forma clara.

**Criterios de aceptación:**

- El sistema identifica tenant por slug/subdominio.
- Si el subdominio no existe, muestra error controlado.
- El branding cargado corresponde al tenant resuelto.

---

## Épica 4 — Propietarios

### ✅ US-010 — Crear propietario

**Prioridad:** P0  
**Como** operador,  
**quiero** cargar propietarios,  
**para** asociarlos a propiedades y liquidaciones.

**Criterios de aceptación:**

- Se pueden cargar nombre, contacto y datos opcionales de pago.
- El propietario queda asociado al tenant activo.
- Campos obligatorios se validan.
- No aparece en otros tenants.

---

### ✅ US-011 — Gestionar propietarios

**Prioridad:** P0  
**Como** operador,  
**quiero** buscar, editar y consultar propietarios,  
**para** mantener actualizada la cartera.

**Criterios de aceptación:**

- Se puede listar propietarios del tenant.
- Se puede buscar por nombre o dato de contacto.
- Se puede editar información.
- Se puede realizar baja lógica si no bloquea operaciones vigentes.

---

## Épica 5 — Inquilinos

### ✅ US-012 — Crear inquilino

**Prioridad:** P0  
**Como** operador,  
**quiero** cargar inquilinos,  
**para** asociarlos a contratos y pagos.

**Criterios de aceptación:**

- Se pueden cargar datos personales y contacto.
- Se puede registrar información de garantía.
- El inquilino queda asociado al tenant activo.
- Se validan campos mínimos obligatorios.

---

### ⬜ US-013 — Consultar historial de inquilino

**Prioridad:** P1  
**Como** administrador,  
**quiero** ver contratos, pagos y saldos de un inquilino,  
**para** entender su situación operativa.

**Criterios de aceptación:**

- Se muestran contratos asociados.
- Se muestran pagos registrados.
- Se muestra deuda o saldo a favor.
- La información pertenece solo al tenant activo.

---

## Épica 6 — Propiedades

### ✅ US-014 — Crear propiedad

**Prioridad:** P0  
**Como** operador,  
**quiero** cargar propiedades,  
**para** asociarlas a propietarios y contratos.

**Criterios de aceptación:**

- Se puede cargar dirección, tipo, estado y propietario.
- La propiedad queda asociada al tenant activo.
- No se puede asociar a propietarios de otro tenant.
- Se puede definir comisión aplicable si corresponde.

---

### 🟡 US-015 — Gestionar estado de propiedad

**Prioridad:** P1  
**Como** administrador,  
**quiero** cambiar el estado de una propiedad,  
**para** reflejar si está disponible, alquilada o inactiva.

**Criterios de aceptación:**

- Estados mínimos: disponible, alquilada, inactiva.
- Una propiedad con contrato activo figura como alquilada.
- El cambio de estado queda auditado si afecta operación.

---

## Épica 7 — Contratos de alquiler

### ✅ US-016 — Crear contrato

**Prioridad:** P0  
**Como** operador,  
**quiero** crear contratos de alquiler,  
**para** administrar vigencia, monto, vencimientos y ajustes.

**Criterios de aceptación:**

- El contrato se asocia a propiedad, propietario e inquilino del mismo tenant.
- Se cargan fecha de inicio, fecha de fin, monto, moneda y vencimiento.
- Se define índice y periodicidad de ajuste.
- El contrato queda en estado activo o borrador según configuración.

---

### ✅ US-017 — Consultar contratos activos

**Prioridad:** P0  
**Como** administrador,  
**quiero** ver contratos activos,  
**para** controlar la operación mensual.

**Criterios de aceptación:**

- Se listan solo contratos del tenant activo.
- Se puede filtrar por propiedad, inquilino, propietario y estado.
- Se muestra monto vigente y próximo vencimiento.

---

### ✅ US-018 — Gestionar estados de contrato

**Prioridad:** P1  
**Como** administrador,  
**quiero** cambiar estados de contrato,  
**para** reflejar renovaciones, finalizaciones o cancelaciones.

**Criterios de aceptación:**

- Estados mínimos: borrador, activo, finalizado, cancelado.
- Cambios de estado sensibles quedan auditados.
- No se pueden registrar pagos sobre contratos cancelados salvo regla explícita.

---

## Épica 8 — Índices y ajustes

### ✅ US-019 — Configurar índice del contrato

**Prioridad:** P0  
**Como** operador,  
**quiero** definir el índice de ajuste de un contrato,  
**para** calcular aumentos según la condición pactada.

**Criterios de aceptación:**

- Índices soportados: IPC, ICL, UVA, fijo y personalizado.
- Se define periodicidad de ajuste.
- El índice queda registrado en el contrato.

---

### ⬜ US-020 — Cargar índice manual como fallback

**Prioridad:** P0  
**Como** administrador,  
**quiero** cargar valores de índice manualmente,  
**para** operar aunque falle una fuente externa.

**Criterios de aceptación:**

- Se puede cargar valor de índice por fecha/período.
- El valor manual queda identificado como manual.
- Se registra usuario y fecha de carga.
- El cálculo conserva trazabilidad del valor usado.

---

### ⬜ US-021 — Calcular aumento próximo

**Prioridad:** P1  
**Como** administrador,  
**quiero** ver contratos con ajuste próximo,  
**para** anticipar aumentos y comunicar importes.

**Criterios de aceptación:**

- Se listan contratos con ajuste dentro de un rango configurable.
- Se muestra monto actual y monto estimado/calculado.
- El cálculo indica índice aplicado y período.

---

## Épica 9 — Pagos y caja

### ⬜ US-022 — Registrar pago

**Prioridad:** P0  
**Como** operador,  
**quiero** registrar pagos de inquilinos,  
**para** actualizar deuda, caja y estado del contrato.

**Criterios de aceptación:**

- Se registra pago asociado a contrato e inquilino.
- Se permite pago total o parcial.
- Se calcula deuda restante o saldo a favor.
- Se genera movimiento de caja.
- La operación queda auditada.

---

### ⬜ US-023 — Ver saldo de contrato/inquilino

**Prioridad:** P0  
**Como** operador,  
**quiero** consultar saldo y deuda,  
**para** informar correctamente al inquilino.

**Criterios de aceptación:**

- Se muestra deuda pendiente.
- Se muestra saldo a favor si existe.
- Se muestra historial de pagos.
- Los importes coinciden con movimientos registrados.

---

### ⬜ US-024 — Registrar movimiento de caja

**Prioridad:** P0  
**Como** sistema,  
**quiero** crear movimientos de caja por cada operación financiera,  
**para** mantener trazabilidad contable-operativa.

**Criterios de aceptación:**

- Cada pago genera movimiento asociado.
- El movimiento incluye tipo, monto, fecha, usuario y tenant.
- No se crean movimientos sin operación fuente o motivo explícito.

---

## Épica 10 — Liquidaciones y PDFs

### ⬜ US-025 — Generar liquidación a propietario

**Prioridad:** P0  
**Como** administrador,  
**quiero** generar liquidaciones,  
**para** informar al propietario cuánto corresponde cobrar.

**Criterios de aceptación:**

- Se selecciona propietario y período.
- El sistema calcula pagos cobrados.
- El sistema calcula comisión inmobiliaria.
- El sistema calcula neto al propietario.
- La liquidación queda guardada.

---

### ⬜ US-026 — Generar PDF de liquidación

**Prioridad:** P0  
**Como** administrador,  
**quiero** emitir una liquidación en PDF,  
**para** compartir comprobantes claros con propietarios.

**Criterios de aceptación:**

- El PDF incluye datos del propietario, período, propiedades, importes, comisión y neto.
- El archivo se almacena asociado al tenant.
- El acceso al documento es seguro.

---

### ⬜ US-027 — Adjuntar o almacenar contrato PDF

**Prioridad:** P1  
**Como** operador,  
**quiero** adjuntar documentos de contrato,  
**para** centralizar la documentación del alquiler.

**Criterios de aceptación:**

- Se puede asociar un documento PDF a un contrato.
- El archivo se guarda bajo prefijo del tenant.
- Solo usuarios autorizados pueden acceder.

---

## Épica 11 — Reportes básicos

### ⬜ US-028 — Reporte de vencimientos

**Prioridad:** P0  
**Como** administrador,  
**quiero** ver vencimientos próximos,  
**para** anticipar cobros y renovaciones.

**Criterios de aceptación:**

- Se listan vencimientos dentro de un rango de fechas.
- Se puede filtrar por contrato, propiedad o inquilino.
- Se muestran solo datos del tenant activo.

---

### ⬜ US-029 — Reporte de caja mensual

**Prioridad:** P0  
**Como** dueño de inmobiliaria,  
**quiero** ver caja mensual,  
**para** controlar ingresos, egresos y movimientos.

**Criterios de aceptación:**

- Se muestran movimientos del mes seleccionado.
- Se puede ver total cobrado.
- Se puede ver comisiones generadas.
- Los datos coinciden con pagos y movimientos.

---

### ⬜ US-030 — Reporte de saldos pendientes

**Prioridad:** P0  
**Como** operador,  
**quiero** ver saldos pendientes,  
**para** gestionar deudas de inquilinos.

**Criterios de aceptación:**

- Se listan contratos/inquilinos con deuda.
- Se muestra monto pendiente y vencimiento.
- Se puede filtrar por período.

---

## Épica 12 — Auditoría y seguridad operativa

### ⬜ US-031 — Registrar auditoría de acciones sensibles

**Prioridad:** P0  
**Como** plataforma,  
**quiero** auditar acciones críticas,  
**para** poder investigar errores o cambios indebidos.

**Criterios de aceptación:**

- Se auditan pagos, liquidaciones, cambios de contrato, cambios de roles y settings.
- Cada registro incluye usuario, tenant, entidad, acción, fecha y metadata relevante.
- La auditoría no puede ser editada por usuarios comunes.

---

### ⬜ US-032 — Logs con contexto operativo

**Prioridad:** P1  
**Como** equipo técnico,  
**quiero** logs con tenantId, userId y requestId,  
**para** diagnosticar incidentes sin exponer datos sensibles.

**Criterios de aceptación:**

- Los logs incluyen contexto mínimo.
- No se loguean secretos ni información sensible innecesaria.
- Los errores críticos se reportan a herramienta de monitoreo.

---

## Épica 13 — Onboarding del tenant piloto

### ⬜ US-033 — Crear tenant Vergani Propiedades

**Prioridad:** P0  
**Como** GU Solutions,  
**quiero** configurar Vergani Propiedades como primer tenant,  
**para** validar el producto con operación real.

**Criterios de aceptación:**

- Existe tenant Vergani Propiedades.
- Tiene usuarios iniciales configurados.
- Tiene branding básico.
- Tiene parámetros operativos mínimos.

---

### ⬜ US-034 — Cargar datos iniciales del piloto

**Prioridad:** P0  
**Como** equipo de implementación,  
**quiero** cargar datos iniciales,  
**para** que el piloto pueda operar desde el primer día.

**Criterios de aceptación:**

- Se define formato de datos de origen.
- Se cargan propietarios, propiedades, inquilinos y contratos mínimos.
- Se validan datos cargados con la inmobiliaria.
- Se documentan inconsistencias o faltantes.

---

## 5. Corte sugerido para primera demo funcional

Para evitar una locura cósmica de alcance, la primera demo debería incluir solo:

1. Login.
2. Tenant Vergani configurado.
3. ABM simple de propietarios.
4. ABM simple de inquilinos.
5. ABM simple de propiedades.
6. Alta de contrato.
7. Registro de pago.
8. Consulta de saldo.
9. Movimiento de caja generado.

Liquidaciones PDF, índices y reportes pueden entrar en el segundo corte si el tiempo aprieta.

---

## 6. Dependencias críticas

- Sin multi-tenancy seguro no debe avanzar el core de negocio.
- Sin contratos no tiene sentido implementar pagos finales.
- Sin pagos no tiene sentido implementar liquidaciones.
- Sin reglas de comisión claras no se pueden cerrar liquidaciones.
- Sin definición de fuente de índices, debe existir fallback manual.

---

## 7. Preguntas pendientes para estimación

- ¿Cuántos usuarios iniciales tendrá Vergani Propiedades?
- ¿Cuántas propiedades, contratos e inquilinos se cargarán para el piloto?
- ¿La carga inicial será manual, por Excel o migración desde otro sistema?
- ¿Qué reglas exactas de comisión se aplican por propiedad/contrato?
- ¿Qué comprobante PDF es obligatorio para la primera salida productiva?
- ¿Qué método de autenticación se usará en MVP: credenciales propias, magic link o proveedor externo?
- ¿Se necesita soporte multi-moneda desde el día uno?
- ¿Qué reportes son realmente imprescindibles para Vergani?

---

## 8. Orden recomendado de implementación

1. Base SaaS: Tenant, User, TenantUser, roles y request context.
2. Repositories tenant-aware y pruebas de aislamiento.
3. Configuración básica de tenant.
4. ABM propietarios, inquilinos y propiedades.
5. Contratos.
6. Pagos, saldos y movimientos de caja.
7. Auditoría.
8. Liquidaciones.
9. PDFs.
10. Índices.
11. Reportes básicos.
12. Onboarding formal del tenant piloto.
