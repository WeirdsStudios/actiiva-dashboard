# Arquitectura de ACTIIVA Dashboard

Actualizado: 24-ago-2026.

## Límites del sistema

`dashboard` es un repositorio y despliegue independiente. Comparte el proyecto Supabase de ACTIIVA con el onboarding, pero no importa código de `user-core` ni de la landing basada en Healia.

El vertical slice actual cubre **Operaciones de Discovery**. Todavía no define el modelo completo del SaaS (organizaciones, miembros, sedes, agenda, membresías o cobros); ese modelo debe nacer del siguiente slice y enlazarse con `discovery_sessions.tenant_id` mediante una migración explícita.

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

## Estado de los riesgos de baseline

| Riesgo | Estado | Resolución |
| --- | --- | --- |
| Token de 7 días vs. ajustes de 20 días | Resuelto | El primer cierre extiende la vigencia; las reaperturas también. |
| Mutaciones confiaban sólo en `sessionId` | Resuelto | Todas validan el token asociado. |
| Sin concurrencia ni límites de IA | Resuelto para piloto | Lock atómico, pausa mínima y máximo de 300 mensajes por sesión. |
| Validación de archivos sólo en navegador | Resuelto | MIME, tamaño, cantidad y destino se validan en servidor. |
| Flujo determinista antiguo accesible | Resuelto | Sus URLs redirigen al chat vigente. |
| Operación mediante scripts sin panel/auth | Resuelto | Panel protegido con Supabase Auth. Los scripts quedan como recuperación operativa. |
| No existe core multi-tenant | Pendiente deliberado | Es el siguiente vertical slice; no se inventó el modelo antes de definirlo. |
| Documentación histórica desactualizada | Resuelto dentro del repo | Este archivo y el README describen el baseline ejecutable actual. Los documentos históricos externos siguen siendo contexto, no fuente de verdad. |

## Despliegue seguro

El orden es obligatorio:

1. Aplicar la migración `20260824000000_harden_discovery_sessions.sql`.
2. Configurar `ADMIN_EMAILS` en Vercel y crear las cuentas correspondientes en Supabase Auth.
3. Configurar `DISCOVERY_BASE_URL=https://onboarding.actiiva.mx` en Vercel.
4. Desplegar el código.

Desplegar el código antes de la migración impediría que el chat reclame un turno del agente.
