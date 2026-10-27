import {
  DIVIDER,
  GPS,
  GPS_G,
  GPS_P,
  GPS_S,
  LINES,
  LINK,
  MARK_ACCENT,
  MARK_INK,
} from "./logo-paths";

// El blanco del logo original pasa a currentColor para funcionar sobre
// fondo claro y oscuro; el turquesa usa --logo-accent.

/**
 * Versión horizontal para la cabecera: A | LINK GPS en una línea. "GPS" se
 * escala a la altura de LINK y se cierra el espaciado entre sus letras.
 */
export function LogoHorizontal({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="40 268 800 200" role="img" aria-label="Alpha Link GPS" className={className}>
      <path d={MARK_INK} fill="currentColor" />
      <path d={MARK_ACCENT} fill="var(--logo-accent)" />
      <path d={DIVIDER} fill="currentColor" />
      <path d={LINK} fill="currentColor" />
      <g fill="var(--logo-accent)" transform="translate(612 433) scale(1.25) translate(-202.3 -552)">
        <path d={GPS_G} />
        <path d={GPS_P} transform="translate(-28 0)" />
        <path d={GPS_S} transform="translate(-50 0)" />
      </g>
    </svg>
  );
}

/** Versión apilada original: A | LINK sobre — GPS —. */
export function LogoStacked({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="16 252 592 324" role="img" aria-label="Alpha Link GPS" className={className}>
      <path d={MARK_INK} fill="currentColor" />
      <path d={MARK_ACCENT} fill="var(--logo-accent)" />
      <path d={DIVIDER} fill="currentColor" />
      <path d={LINK} fill="currentColor" />
      <path d={GPS} fill="var(--logo-accent)" />
      <path d={LINES} fill="var(--logo-accent)" />
    </svg>
  );
}

/** Solo la A, para el ícono de la pestaña y espacios reducidos. */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="40 270 232 196" aria-hidden="true" className={className}>
      <path d={MARK_INK} fill="currentColor" />
      <path d={MARK_ACCENT} fill="var(--logo-accent)" />
    </svg>
  );
}
