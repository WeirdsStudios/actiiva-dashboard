# ACTGym — plataforma demo

Actualizado: 24-ago-2026.

ACTGym es el primer vertical de industria construido sobre el core multi-tenant de ACTIIVA. El negocio visible se llama **ACTGym** y su hostname es `mexgym.actiiva.mx`.

## Recorridos

- `/`: sitio público con método, horarios y tres membresías.
- `/mi-cuenta`: portal del socio. El usuario de prueba ve su plan Progreso, estado, próximo pago y clases.
- `/gestion`: panel para propietarios y administradores. Muestra socios, ingreso mensual estimado, prospectos, agenda y planes; permite cambiar el estado de un socio.

En la prueba inicial, la cuenta administradora actual ocupa dos perfiles de forma intencional: propietario de ACTGym y socio demo. Así se pueden recorrer las dos perspectivas con la misma identidad sin crear ni compartir otra contraseña.

## Fronteras de datos

- `organization_members` contiene a quienes operan el negocio para ACTIIVA.
- `gym_customers` contiene a los socios finales del gimnasio.
- Un socio sólo puede leer su propio perfil y no puede modificar su estado.
- Un propietario o administrador activo puede leer y actualizar socios de su organización.
- El visitante anónimo sólo puede leer el sitio, planes y clases publicados.
- El hostname se resuelve en `src/proxy.ts`; el subdominio se valida contra una lista explícita antes del rewrite.

## Datos ficticios

- Planes: Base, Progreso y Alto rendimiento.
- Clases: Fuerza 06, Engine, Movilidad y Power.
- Socios: un perfil ligado al usuario de prueba y tres perfiles ficticios para visualizar operación.
- Dirección y teléfono son demostrativos; no representan un gimnasio real.

## Fuera del primer slice

- Reservas y control de capacidad por fecha.
- Cobros reales y conciliación con Stripe.
- Check-in por QR.
- Rutinas, mediciones y progreso real.
- Altas de socios e invitaciones desde Gestión.
- Edición del sitio, planes y agenda desde el panel.
- Dominio propio del cliente además del subdominio ACTIIVA.

Estas piezas deben añadirse como slices end-to-end; no se deben simular con botones que aparenten ejecutar una operación inexistente.
