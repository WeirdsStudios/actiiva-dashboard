-- Bloqueo de sesión tras la ventana de ajuste de 20 días + reapertura con
-- autorización previa del dueño del proyecto. Ver
-- src/features/business-discovery-agent/server/session-lock.ts para el
-- cómputo del bloqueo.
--
-- reopen_requested_at: cuándo el dueño del negocio pidió que le reabrieran
-- su sesión ya bloqueada (botón "Solicitar reapertura" en
-- DiscoverySessionLockedScreen.tsx). Se limpia (vuelve a null) en cuanto se
-- autoriza — así una sesión que se vuelve a bloquear más adelante no
-- arrastra una solicitud vieja ya resuelta.
--
-- reopen_authorized_until: puesto por el dueño del proyecto (hoy vía
-- scripts/authorize-reopen.ts, sin panel interno todavía). Mientras esta
-- fecha esté en el futuro, la sesión queda desbloqueada aunque ya haya
-- pasado su ventana original de 20 días desde submitted_at.

alter table discovery_sessions
  add column reopen_requested_at timestamptz,
  add column reopen_authorized_until timestamptz;
