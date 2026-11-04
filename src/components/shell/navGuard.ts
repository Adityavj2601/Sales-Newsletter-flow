/**
 * One place for “you have unsaved changes” to hook into navigation that doesn't come from a link click
 * (the ⌘K palette, the product switcher). A guard returns true when it took over: it will call `proceed`
 * itself once the person has chosen Save or Don't save.
 */
type Guard = (proceed: () => void) => boolean;
let current: Guard | null = null;

export const setNavGuard = (g: Guard | null) => { current = g; };
/** Run `proceed` now, unless a guard is active and takes over. */
export const guardedNav = (proceed: () => void) => { if (!current || !current(proceed)) proceed(); };
