// Firma discreta de la marca paraguas. Geometría exacta copiada de
// ~/Developer/user/usersmx_logo/SVG/isotipo_user_black.svg (sin recrear el
// isotipo) — se referencia como <img>, no se recolorea, y se usa muy por
// debajo del tamaño del símbolo ACTIIVA del header para que la jerarquía sea
// clara: en superficies de ACTIIVA, ACTIIVA lidera y USERS aparece solo como
// contexto (mismo criterio que "Powered by ACTIIVA" en tenants, invertido).
export function UsersSignature() {
  return (
    <div className="flex items-center gap-1.5 text-muted opacity-70">
      <img src="/brand/users-isotipo.svg" alt="" className="h-2.5 w-auto" />
      <span className="text-[11px] tracking-wide">by USERS</span>
    </div>
  );
}
