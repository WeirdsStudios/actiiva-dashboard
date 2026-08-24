# ACTIIVA Dashboard

Aplicación Next.js que contiene dos superficies:

- `/discovery/[accessToken]`: onboarding conversacional para el dueño del negocio.
- `/admin/discovery`: centro interno de operaciones para crear y revisar sesiones.

## Desarrollo local

1. Copia las variables documentadas en `.env.example` a `.env.local`.
2. Define `ADMIN_EMAILS` con los correos autorizados, separados por comas.
3. Crea esas cuentas en **Supabase → Authentication → Users**. No existe registro público.
4. Ejecuta las migraciones de `supabase/migrations`.
5. Inicia la aplicación con `bun run dev`.

Comandos de verificación:

```bash
bun run test
bun run lint
bun run build
```

## Seguridad relevante

- Los enlaces públicos usan un token aleatorio distinto del ID de la sesión.
- Todas las mutaciones validan `sessionId + accessToken` en el servidor.
- RLS permanece cerrado para `anon` y `authenticated`; el backend usa service role.
- El agente serializa los turnos, limita la frecuencia y tiene un máximo de 300 mensajes por sesión.
- Los archivos se validan por pregunta, MIME, tamaño y cantidad antes de llegar a Storage.
- El panel valida en cada lectura y escritura que la identidad de Supabase Auth esté en `ADMIN_EMAILS`.

El detalle del baseline y las decisiones del primer vertical slice está en `docs/ARCHITECTURE.md`.
