# PRD — GU-Props: Plataforma SaaS de Gestión Inmobiliaria

**Producto:** GU-Props  
**Empresa:** GU Solutions  
**Cliente piloto / primer tenant:** Vergani Propiedades  
**Versión:** 1.0  
**Fecha:** Abril 2026  
**Estado:** Borrador de PRD para validación

---

## 1. Resumen ejecutivo

GU-Props es una plataforma SaaS multi-tenant para inmobiliarias pequeñas y medianas que necesitan centralizar la gestión de alquileres, propiedades, propietarios, inquilinos, contratos, pagos, ajustes por índices y liquidaciones.

El producto debe nacer como SaaS desde el día uno: una única plataforma reutilizable para múltiples inmobiliarias, donde cada cliente opera como un tenant independiente con sus propios usuarios, configuración, branding, documentos, caja y reportes.

El MVP busca validar el uso real con una inmobiliaria piloto, inicialmente Vergani Propiedades, sin construir una aplicación exclusiva para ese cliente. El objetivo comercial es convertir una necesidad puntual en un producto repetible con ingresos recurrentes.

---

## 2. Contexto y problema

Muchas inmobiliarias administran alquileres, pagos, contratos y liquidaciones usando planillas, documentos sueltos, sistemas antiguos o procesos manuales. Esto genera:

- Falta de trazabilidad sobre pagos, deudas, saldos y movimientos de caja.
- Riesgo de errores en cálculos de aumentos por IPC, ICL, UVA u otros índices.
- Dificultad para generar liquidaciones claras para propietarios.
- Información dispersa entre contratos, comprobantes, documentos y reportes.
- Poco control sobre usuarios, permisos y acciones sensibles.
- Procesos difíciles de escalar cuando crece la cantidad de propiedades o contratos.

GU-Props busca resolver el core operativo de administración de alquileres con una solución web centralizada, segura, auditable y preparada para múltiples inmobiliarias.

---

## 3. Objetivos del producto

### 3.1 Objetivos de negocio

- Validar el modelo SaaS con al menos una inmobiliaria usando datos reales en producción.
- Mantener la propiedad intelectual del software en GU Solutions.
- Generar ingresos recurrentes mediante suscripción mensual, setup inicial, add-ons y servicios complementarios.
- Permitir sumar nuevas inmobiliarias sin reescribir la arquitectura.
- Construir una base comercial escalable con planes Starter, Professional, Business y Enterprise.

### 3.2 Objetivos de producto

- Centralizar la gestión de propietarios, inquilinos, propiedades y contratos.
- Registrar pagos, saldos, deudas, movimientos de caja y pagos parciales.
- Automatizar o asistir el cálculo de aumentos por índices.
- Generar liquidaciones y comprobantes PDF.
- Separar datos por inmobiliaria mediante arquitectura multi-tenant.
- Permitir configuración básica por tenant: nombre, logo, colores, usuarios, roles, parámetros operativos y templates.

---

## 4. No objetivos / fuera de alcance del MVP

El MVP no incluye:

- Portal propio para propietarios.
- Portal propio para inquilinos.
- Módulo completo de ventas de propiedades.
- Aplicaciones móviles nativas.
- Integración automática con WhatsApp.
- Facturación electrónica.
- Integraciones contables avanzadas.
- Business intelligence avanzado.
- Base de datos dedicada por cliente, salvo plan Enterprise o acuerdo especial.
- Customizaciones exclusivas que no aporten al producto base, salvo presupuesto separado.

---

## 5. Personas / usuarios objetivo

### 5.1 Dueño/a de inmobiliaria

Necesita visibilidad general del negocio, control de caja, vencimientos, contratos activos, deudas y liquidaciones. Le importa operar mejor sin perder control sobre la información.

### 5.2 Administrador/a

Gestiona el día a día: carga propiedades, contratos, pagos, aumentos, movimientos de caja y genera liquidaciones. Necesita velocidad, claridad y bajo margen de error.

### 5.3 Operador/a

Realiza tareas específicas como registrar pagos, consultar saldos, cargar datos o emitir comprobantes. Necesita permisos limitados y flujos simples.

### 5.4 Usuario de solo lectura

Consulta información, reportes o estados sin modificar datos sensibles.

### 5.5 GU Solutions / administrador SaaS

Administra tenants, planes, límites, features, soporte, onboarding, configuración comercial y operación general de la plataforma.

---

## 6. Alcance MVP

El MVP debe cubrir el flujo principal de administración de alquileres:

1. Alta y configuración de inmobiliaria como tenant.
2. Gestión de usuarios y roles dentro del tenant.
3. ABM de propietarios.
4. ABM de inquilinos.
5. ABM de propiedades.
6. Alta y gestión de contratos de alquiler.
7. Configuración de índices de ajuste.
8. Registro de pagos, pagos parciales, deuda y saldo a favor.
9. Movimientos de caja y trazabilidad financiera.
10. Liquidaciones automáticas para propietarios.
11. Generación y almacenamiento de PDFs.
12. Reportes básicos operativos.
13. Auditoría de acciones sensibles.

---

## 7. Funcionalidades principales

### 7.1 Gestión de tenant / inmobiliaria

- Crear una inmobiliaria cliente como tenant.
- Configurar nombre comercial, logo, colores y parámetros básicos.
- Definir subdominio o dominio personalizado según plan.
- Configurar límites y features habilitadas por plan.

### 7.2 Usuarios y permisos

- Login de usuarios.
- Roles por inmobiliaria: owner, admin, operador y readonly.
- Asociación de usuarios a uno o más tenants.
- Selección de tenant activo cuando aplique.
- Invitación de usuarios, inicialmente manual o por email según alcance técnico.

### 7.3 Propietarios

- Alta, edición, baja lógica y consulta.
- Datos de contacto.
- CBU o datos de pago opcionales.
- Historial de propiedades, contratos y liquidaciones asociadas.

### 7.4 Inquilinos

- Alta, edición, baja lógica y consulta.
- Datos de contacto.
- Información de garantía.
- Legajo digital.
- Historial de contratos, pagos y saldos.

### 7.5 Propiedades

- Alta, edición, baja lógica y consulta.
- Asociación con propietario.
- Tipo de propiedad.
- Estado operativo.
- Comisión aplicable.
- Documentos asociados.

### 7.6 Contratos

- Alta de contrato asociado a propiedad, propietario e inquilino.
- Fecha de inicio y fin.
- Monto, moneda, periodicidad y vencimiento.
- Índice de ajuste: IPC, ICL, UVA, fijo o personalizado.
- Estado del contrato.
- Generación o almacenamiento de documento PDF.

### 7.7 Índices de ajuste

- Soporte para IPC, ICL, UVA y ajustes personalizados.
- Posibilidad de integración con fuente externa.
- Fallback de carga manual cuando no haya fuente disponible o confiable.
- Trazabilidad del índice aplicado en cada cálculo.

### 7.8 Caja y pagos

- Registro de pagos totales y parciales.
- Cálculo de deuda, saldo pendiente y saldo a favor.
- Movimientos de caja por tenant.
- Split de comisión inmobiliaria y neto al propietario.
- Transacciones atómicas para evitar inconsistencias.

### 7.9 Liquidaciones

- Cálculo de comisión.
- Cálculo de neto a propietario.
- Generación de liquidación mensual.
- Emisión de comprobante PDF.
- Almacenamiento seguro de documentos por tenant.

### 7.10 Reportes básicos

- Contratos activos.
- Vencimientos próximos.
- Aumentos próximos.
- Caja mensual.
- Saldos pendientes.
- Reportes por propiedad.
- Liquidaciones generadas.

### 7.11 Auditoría

- Registro de acciones sensibles por usuario, fecha, tenant, entidad y acción.
- Acciones auditables mínimas: pagos, liquidaciones, cambios de contrato, cambios de roles y cambios de configuración.

---

## 8. Flujos clave

### 8.1 Onboarding de una inmobiliaria

1. GU Solutions crea el tenant.
2. Se configura branding básico, usuarios iniciales y parámetros operativos.
3. Se define plan, límites y features disponibles.
4. Se carga información inicial o se importa desde planillas si corresponde.
5. La inmobiliaria comienza a operar con datos reales.

### 8.2 Alta de contrato

1. El usuario selecciona propiedad, propietario e inquilino.
2. Ingresa fechas, monto, moneda, vencimiento, índice y periodicidad.
3. El sistema valida datos obligatorios y pertenencia al tenant.
4. Se crea el contrato activo.
5. Se genera o adjunta documentación PDF.

### 8.3 Registro de pago

1. El usuario busca contrato o inquilino.
2. El sistema muestra deuda, vencimientos y saldos.
3. El usuario registra pago total o parcial.
4. El sistema genera movimiento de caja.
5. Se actualiza saldo del contrato/inquilino.
6. Se registra auditoría de la operación.

### 8.4 Liquidación a propietario

1. El usuario selecciona período y propietario.
2. El sistema calcula pagos recibidos, comisión y neto a liquidar.
3. El usuario revisa la liquidación.
4. El sistema genera comprobante PDF.
5. Se almacena el documento y queda disponible para consulta.

### 8.5 Ajuste por índice

1. El sistema identifica contratos con ajuste próximo.
2. Consulta índice disponible o permite carga manual.
3. Calcula nuevo monto según configuración del contrato.
4. Guarda trazabilidad del cálculo.
5. Refleja el nuevo importe en vencimientos futuros.

---

## 9. Requerimientos funcionales

### RF-001 — Multi-tenancy

El sistema debe permitir que múltiples inmobiliarias operen en la misma plataforma con datos separados por tenant.

### RF-002 — Filtro obligatorio por tenant

Toda consulta de entidades de negocio debe filtrar por tenant activo. Nunca se debe consultar una entidad de negocio solo por id.

### RF-003 — Roles por tenant

Un usuario debe poder tener un rol específico dentro de cada inmobiliaria.

### RF-004 — Gestión de entidades core

El sistema debe permitir ABM de propietarios, inquilinos, propiedades y contratos.

### RF-005 — Gestión de contratos

El sistema debe registrar vigencia, monto, moneda, índice, periodicidad, vencimiento y estado de cada contrato.

### RF-006 — Registro de pagos

El sistema debe permitir registrar pagos totales, pagos parciales, deuda y saldo a favor.

### RF-007 — Movimientos de caja

Cada pago debe generar trazabilidad financiera mediante movimientos de caja.

### RF-008 — Liquidaciones

El sistema debe calcular comisión inmobiliaria, neto al propietario y generar liquidaciones.

### RF-009 — PDFs

El sistema debe generar o almacenar contratos, comprobantes y liquidaciones en PDF.

### RF-010 — Índices

El sistema debe soportar índices IPC, ICL, UVA, fijo y personalizado, con fallback manual.

### RF-011 — Auditoría

El sistema debe registrar acciones sensibles con usuario, tenant, entidad, fecha y acción.

### RF-012 — Reportes básicos

El sistema debe ofrecer reportes de vencimientos, aumentos próximos, caja mensual, saldos pendientes y actividad por propiedad.

---

## 10. Requerimientos no funcionales

### 10.1 Seguridad

- Autenticación mediante JWT o mecanismo equivalente.
- El token debe incluir userId, tenantId activo y rol dentro del tenant.
- Autorización mediante guards por rol.
- URLs firmadas para documentos privados.
- Secrets siempre fuera del repositorio.

### 10.2 Aislamiento de datos

- Todas las tablas de negocio deben incluir tenant_id.
- Los archivos deben almacenarse bajo prefijos por tenant.
- Los repositories del backend deben ser tenant-aware.

### 10.3 Auditoría y trazabilidad

- Logs con tenantId, userId, requestId, endpoint y acción.
- AuditLog para operaciones críticas.

### 10.4 Disponibilidad y operación

- Ambientes separados: local, staging y producción.
- No compartir base de datos entre staging y producción.
- Backups automáticos en producción.
- Procedimiento documentado de restore.

### 10.5 Escalabilidad inicial

- Arquitectura cloud-first.
- Base compartida con separación lógica para reducir costos iniciales.
- Posibilidad futura de infraestructura dedicada para Enterprise.

### 10.6 Observabilidad

- Monitoreo de errores con Sentry o equivalente.
- Logs centralizados para diagnóstico por tenant.
- Alertas ante fallos críticos.

---

## 11. Arquitectura propuesta

La arquitectura recomendada para el MVP es:

| Capa | Tecnología sugerida | Responsabilidad |
| --- | --- | --- |
| Frontend | Next.js + React + TypeScript en Vercel | App web, panel de gestión, formularios, reportes y experiencia multi-tenant. |
| Backend | NestJS + TypeScript en Railway | API, lógica de negocio, permisos, caja, contratos, índices, liquidaciones y jobs. |
| Base de datos | PostgreSQL administrado en Supabase | Persistencia relacional con separación por tenant_id. |
| ORM | Prisma | Modelado tipado, migraciones y acceso a datos. |
| Cache / jobs livianos | Upstash Redis | Cache, rate limit, locks y settings. |
| Archivos | Cloudflare R2 | PDFs y documentos con URLs firmadas. |
| CI/CD | GitHub Actions | Validaciones, tests, migraciones y deploy. |
| Observabilidad | Sentry + logs centralizados | Errores, trazabilidad y monitoreo por tenant. |

---

## 12. Métricas de éxito

### 12.1 Métricas de adopción

- Cantidad de inmobiliarias activas.
- Cantidad de usuarios activos por inmobiliaria.
- Cantidad de contratos activos cargados.
- Cantidad de propiedades administradas.

### 12.2 Métricas operativas

- Cantidad de pagos registrados por mes.
- Cantidad de liquidaciones generadas.
- Tiempo promedio para registrar un pago.
- Cantidad de reportes consultados.
- Errores o ajustes manuales por cálculo de índice.

### 12.3 Métricas comerciales

- MRR.
- Churn mensual.
- Conversión de piloto a cliente pago.
- Tickets de soporte por cliente.
- Ingresos por add-ons y customizaciones.

---

## 13. Modelo comercial resumido

El producto se comercializa como SaaS bajo licencia de uso. GU Solutions conserva la propiedad intelectual del software base. Cada inmobiliaria conserva la propiedad de sus datos.

### 13.1 Conceptos de cobro

- Setup inicial.
- Suscripción mensual.
- Add-ons.
- Customizaciones.
- Migración o carga inicial de datos.
- Soporte premium.

### 13.2 Planes sugeridos

| Plan | Cliente objetivo | Incluye resumido |
| --- | --- | --- |
| Starter | Inmobiliarias chicas | Usuarios y propiedades limitadas, PDFs básicos, reportes básicos, soporte por email. |
| Professional | Inmobiliarias medianas | Más usuarios, más propiedades, branding, liquidaciones PDF, reportes completos y soporte prioritario. |
| Business | Inmobiliarias con mayor volumen | Dominio custom, auditoría avanzada, templates personalizados y onboarding incluido. |
| Enterprise | Clientes grandes | Límites a medida, SLA, integraciones, DB dedicada opcional y contrato personalizado. |

---

## 14. Supuestos

- El primer tenant será Vergani Propiedades.
- El producto se construirá como SaaS multi-tenant desde el inicio.
- La base de datos inicial será compartida con separación lógica por tenant_id.
- Las inmobiliarias objetivo iniciales son pequeñas y medianas.
- El core de valor está en alquileres, contratos, caja, pagos, índices y liquidaciones.
- Las funciones de portal, WhatsApp, ventas e integraciones avanzadas quedan para etapas posteriores.
- GU Solutions no entregará código fuente como parte de la suscripción SaaS.

---

## 15. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Fuga de datos entre tenants | Crítico | Repositories tenant-aware, filtros obligatorios por tenant, tests de aislamiento y auditoría. |
| Errores en caja, pagos o liquidaciones | Crítico | Transacciones atómicas, AuditLog, pruebas de integración y revisión de cálculos. |
| Cambios o fallas en fuentes de índices | Alto | Patrón adapter, cache y fallback de carga manual. |
| Cliente pide cesión de código | Alto comercial | Contrato SaaS claro: licencia de uso, no venta de propiedad intelectual. |
| Customizaciones excesivas | Alto | Roadmap claro, add-ons definidos y cotización separada. |
| Costos cloud crecen sin control | Medio | Límites por plan, monitoreo y add-ons por exceso de uso. |
| Soporte consume demasiado tiempo | Medio | Onboarding claro, base de conocimiento y soporte diferenciado por plan. |
| MVP intenta cubrir demasiadas features | Alto | Mantener foco en alquileres, caja, contratos, pagos y liquidaciones. |

---

## 16. Roadmap sugerido

### Fase 1 — MVP piloto

Objetivo: validar el core con Vergani Propiedades como primer tenant.

Entregables:

- Base SaaS multi-tenant.
- Auth y roles.
- ABM de propietarios, inquilinos y propiedades.
- Contratos.
- Caja y pagos.
- Liquidaciones PDF.
- Reportes básicos.
- Auditoría mínima.

### Fase 2 — Primeros clientes pagos

Objetivo: formalizar planes, onboarding, soporte y límites de uso.

Entregables:

- Setup repetible.
- Plantillas PDF mejoradas.
- Mejoras de reportes.
- Documentación de soporte.
- Proceso comercial validado.

### Fase 3 — Producto empaquetado

Objetivo: reducir fricción de venta e implementación.

Entregables:

- Onboarding más automatizado.
- Features por plan.
- Add-ons iniciales.
- Reportes avanzados.

### Fase 4 — Escala

Objetivo: aumentar ticket mensual y diferenciación.

Entregables:

- Portal de propietarios.
- Portal de inquilinos.
- WhatsApp/notificaciones.
- Integraciones.
- Planes Enterprise.

---

## 17. Preguntas abiertas

- ¿Cuál será el nombre comercial definitivo: GU-Props, GU-Prop u otro?
- ¿Qué fuente oficial o proveedor se usará para IPC, ICL, UVA y otros índices?
- ¿Qué nivel de carga histórica necesita Vergani Propiedades para el piloto?
- ¿Qué formato tienen actualmente los datos: Excel, sistema anterior, carpetas físicas, PDFs?
- ¿Qué comprobantes PDF son obligatorios para operar desde el día uno?
- ¿Habrá integración con email para invitaciones y notificaciones en el MVP?
- ¿Qué reglas exactas de comisión usa Vergani Propiedades?
- ¿Se requiere soporte multi-moneda desde el inicio o solo moneda local?
- ¿Qué políticas de backup y retención de datos se ofrecerán contractualmente?
- ¿Qué términos legales específicos debe incluir el contrato SaaS?
- ¿Cuál será el dominio principal del producto?
- ¿Qué límites concretos tendrá cada plan en la primera versión comercial?

---

## 18. Criterio de salida del MVP

El MVP se considerará validado cuando:

- Vergani Propiedades opere como tenant real en producción.
- Se puedan cargar propietarios, inquilinos, propiedades y contratos.
- Se registren pagos reales y movimientos de caja.
- Se generen liquidaciones PDF utilizables.
- Se calculen o registren ajustes por índice con trazabilidad.
- No existan fugas de datos entre tenants en pruebas de aislamiento.
- GU Solutions pueda crear un segundo tenant sin cambios estructurales mayores.
- Exista una propuesta comercial clara con setup, suscripción y propiedad intelectual protegida.

---

## 19. Fuentes utilizadas

- `propuesta_comercial_saas_inmobiliario.docx`
- `documento_arranque_mvp_saas_inmobiliario.docx`
