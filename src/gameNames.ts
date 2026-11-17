// Display names for the games, in ONE place so a rename is a one-line change.
// Public URL is /dia-de-los-muertos. /waves redirects there. Asset files stay under /waves and public/waves/.
// Used by the arcade cabinet, choose meta, dia-de-los-muertos.html (%%WAVES_NAME%%), and the share text.
export const WAVES_NAME = 'Día de los Muertos';

/** Split a name into the two marquee lines: everything but the last word on the small top line, the last word big underneath. */
export function marqueeLines(name: string): [string, string] {
  const i = name.lastIndexOf(' ');
  return i < 0 ? ['', name.toUpperCase()] : [name.slice(0, i).toUpperCase(), name.slice(i + 1).toUpperCase()];
}
