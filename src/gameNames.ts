// Display names for the games, in ONE place so a rename is a one-line change.
// The /waves game was renamed from "Chancla Waves" to "Día de los Muertos" (Gabe, 2026-11-10). The URL stays /waves.
// To rename it again, change WAVES_NAME only.
// Used by: the /choose arcade cabinet marquee + aria label (src/choose/arcade.ts), the /choose meta description
// (astro/pages/choose.astro), waves.html <title>/description/og tags and the TAP TO PLAY aria label (via the %%WAVES_NAME%%
// placeholder replaced in vite.config.ts), and the Waves share-on-X text (src/play/waves.ts).
export const WAVES_NAME = 'Día de los Muertos';

/** Split a name into the two marquee lines: everything but the last word on the small top line, the last word big underneath. */
export function marqueeLines(name: string): [string, string] {
  const i = name.lastIndexOf(' ');
  return i < 0 ? ['', name.toUpperCase()] : [name.slice(0, i).toUpperCase(), name.slice(i + 1).toUpperCase()];
}
