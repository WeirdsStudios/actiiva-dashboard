# Arquitectura de ACTIIVA Dashboard

Actualizado: 24-ago-2026.

## Límites del sistema

`dashboard` es un repositorio y despliegue independiente. Comparte el proyecto Supabase de ACTIIVA con el onboarding, pero no importa código de `user-core` ni de la landing basada en Healia.

El vertical slice actual cubre **Operaciones de Discovery** y la primera frontera multi-tenant. `organizations` representa a cada cliente, `organization_members` define membresías explícitas y `discovery_sessions.tenant_id` vincula el onboarding aprobado con su cuenta. Sedes, agenda, servicios y cobros todavía no forman parte de este repositorio.

## Flujo público

1. Un administrador crea una sesión y copia su enlace.
2. El servidor resuelve `accessToken → sessionId`.
3. Cada Server Action vuelve a comprobar el par; renderizar la página no se considera autorización suficiente.
4. Una función SQL toma un lock lógico antes de llamar al agente y aplica límites por sesión.
5. Claude sólo escribe mediante herramientas que validan el question pack.
6. Al cerrar, el token queda vigente al menos hasta completar los 20 días de ajustes.
7. Después del plazo, el mismo enlace sólo permite solicitar una reapertura.

## Flujo interno

1. Supabase Auth autentica con correo y contraseña.
2. `src/proxy.ts` refresca la sesión SSR.
3. Cada página y Server Action comprueba además que el correo esté en `ADMIN_EMAILS`.
4. El panel permite crear sesiones, renovar enlaces, revisar respuestas/archivos/exportaciones, autorizar reaperturas y aprobar una entrega.
5. Una sesión aprobada puede convertirse una sola vez en cliente mediante una función SQL transaccional.
6. La sección `/admin/clients` muestra la cuenta, sus onboardings y sus futuras membresías.

## Frontera multi-tenant

- Las sesiones existentes conservan `tenant_id = null`; no se migran ni agrupan por coincidencia de nombre.
- Sólo una sesión `approved` puede crear una organización.
- La conversión bloquea la sesión, crea la organización y vincula ambas filas dentro de la misma transacción.
- Un trigger impide quitar o cambiar el tenant después de la vinculación.
- `anon` no puede leer organizaciones o membresías. Un usuario autenticado sólo puede leer su propia membresía y las organizaciones donde esa membresía esté activa.
- Las tablas `discovery_*` continúan cerradas al acceso directo; el panel interno usa `service_role` después de comprobar al administrador.

## Estado de los riesgos de baseline

| Riesgo | Estado | Resolución |
| --- | --- | --- |
| Token de 7 días vs. ajustes de 20 días | Resuelto | El primer cierre extiende la vigencia; las reaperturas también. |
| Mutaciones confiaban sólo en `sessionId` | Resuelto | Todas validan el token asociado. |
| Sin concurrencia ni límites de IA | Resuelto para piloto | Lock atómico, pausa mínima y máximo de 300 mensajes por sesión. |
| Validación de archivos sólo en navegador | Resuelto | MIME, tamaño, cantidad y destino se validan en servidor. |
| Flujo determinista antiguo accesible | Resuelto | Sus URLs redirigen al chat vigente. |
| Operación mediante scripts sin panel/auth | Resuelto | Panel protegido con Supabase Auth. Los scripts quedan como recuperación operativa. |
| No existe core multi-tenant | Resuelto para el núcleo de clientes | Organizaciones, miembros, RLS, vínculo inmutable y conversión atómica desde discovery. El portal del cliente se construirá en un slice posterior. |
| Documentación histórica desactualizada | Resuelto dentro del repo | Este archivo y el README describen el baseline ejecutable actual. Los documentos históricos externos siguen siendo contexto, no fuente de verdad. |

## Despliegue seguro

El orden es obligatorio:

1. Aplicar las migraciones pendientes, incluida `20260824200000_create_organizations.sql`.
2. Configurar `ADMIN_EMAILS` en Vercel y crear las cuentas correspondientes en Supabase Auth.
3. Configurar `DISCOVERY_BASE_URL=https://onboarding.actiiva.mx` en Vercel.
4. Desplegar el código.

Desplegar el código antes de la migración impediría que el chat reclame un turno del agente.
