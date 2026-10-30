# Fönstershowen

En webbapp som projicerar en figur i ditt fönster. Figuren lever av sig själv, och med en webbkamera vinkar den tillbaka till den som vinkar.

Allt körs i webbläsaren på din dator. Inga konton, ingen server, inga kamerabilder lämnar datorn.

## Så används den

1. Öppna appen i Chrome på datorn som är kopplad till projektorn.
2. Klicka **Öppna scenen på projektorn**. Klicka på scenen och tryck F för helskärm.
3. Gå till **Installera**: skriv in fönstrets mått, dra de fyra hörnen tills testbilden ligger i fönstret och slå på spegling om projektorn lyser på duken inifrån.
4. Gå till **Studio** och stäng av testbilden.

Tangenter på scenen: F helskärm, W vinka, C fira, L titta runt, S sova eller vakna.

## Utveckla

```bash
npm install
npm run dev        # kontrollpanel på http://localhost:5173, scen på /stage.html
npm test           # Vitest
npm run typecheck
npm run build
```

## Arkitektur

- `src/panel` kontrollpanelen (React, Tailwind).
- `src/stage` scenen på projektorn (Three.js), perspektiv, spegling och mask.
- `src/core/director.ts` regissören som väljer vad figuren gör. Ren logik, testad.
- `src/shared` typer, händelsebuss mellan fönstren, inställningar i IndexedDB.

Sensorer skickar händelser, regissören väljer läge, figuren spelar läget. En ny sensor eller figur kräver ingen ändring i de andra delarna.

Analys och byggplan finns i dokumentet *Fönstershowen: analys och byggplan*.
