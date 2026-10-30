/** Öppnar scenen på projektorn. Chrome och Edge kan placera fönstret på rätt skärm själva. */

interface ScreenDetailed {
  isPrimary: boolean;
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
}

interface ScreenDetails {
  screens: ScreenDetailed[];
  currentScreen: ScreenDetailed;
}

export type OpenResult = 'external' | 'here' | 'blocked';

export async function openStage(): Promise<OpenResult> {
  const url = new URL('stage.html', window.location.href).toString();
  let features = 'popup,width=1280,height=720';
  let external = false;

  const w = window as Window & { getScreenDetails?: () => Promise<ScreenDetails> };
  if (typeof w.getScreenDetails === 'function') {
    try {
      const details = await w.getScreenDetails();
      const target = details.screens.find((s) => s !== details.currentScreen && !s.isPrimary) ??
        details.screens.find((s) => s !== details.currentScreen);
      if (target) {
        features = `popup,left=${target.availLeft},top=${target.availTop},width=${target.availWidth},height=${target.availHeight}`;
        external = true;
      }
    } catch {
      // Användaren nekade skärmåtkomst: öppna som vanligt fönster.
    }
  }

  const opened = window.open(url, 'fonstershowen-scen', features);
  if (!opened) return 'blocked';
  return external ? 'external' : 'here';
}
