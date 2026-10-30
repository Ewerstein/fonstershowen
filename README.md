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

## Teman och figurer

Ett tema är en mapp i `public/themes/<id>/` med en `manifest.json`. Manifestet listar stilar, vilken modell och vilka rörelser varje stil använder, och vilket klipp som hör till vilket läge. Saknas ett klipp används närmaste läge, och vinkning och handlyft läggs på med kod.

Jultemat använder skelett och rörelser från Quaternius Universal Animation Library (CC0). Tomtarna byggs av enkla former som sitter fast på skelettet, så en ny stil är bara nya färger och former i manifestet. Använd bara material med licens som tillåter kommersiell användning, och lägg in dem under `credits`.

Analys och byggplan finns i dokumentet *Fönstershowen: analys och byggplan*.
