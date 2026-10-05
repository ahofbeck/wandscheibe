# Entwicklungsplan – Wandscheibe mit Öffnung (FE-Bemessungstool)

Ziel: Web-Tool (Next.js-Frontend + Python/FastAPI-Backend mit PyNiteFEA) zur Berechnung der
Scheibenbeanspruchung eines wandartigen Trägers mit Öffnung (Vorbild: Beispiel 2, Kap. 3.10,
Abb. 3.69–3.76). UI-Logik nach dem Vorbild VIKTOR: links Parametrisierung, rechts Views,
Berechnung nur über **Run**.

```
wandscheibe/
├─ PLAN.md               ← dieses Dokument (Spezifikation + API-Vertrag)
├─ README.md             ← Start-Anleitung
├─ start.ps1             ← startet Backend + Frontend
├─ backend/              ← FastAPI + PyNiteFEA   (Port 8000)
│  ├─ requirements.txt
│  ├─ app/main.py        ← FastAPI, POST /analyze, GET /health
│  ├─ app/schemas.py     ← Pydantic-Modelle (Request/Response, s. §4)
│  ├─ app/ec2.py         ← Betontabelle EC2 / DE-NA, Expositionsklassen
│  ├─ app/model.py       ← Netz, Randbedingungen, Lasten, Pynite-Aufbau
│  ├─ app/postprocess.py ← Hauptspannungen, Glättung, Schnitte, Zugkräfte
│  └─ tests/test_*.py    ← pytest: Gleichgewicht, Plausibilität
└─ frontend/             ← Next.js (App Router, TypeScript, Tailwind, react-konva, zustand) (Port 3000)
```

---

## 1. Geometrie & Koordinatensystem (verbindlich für Frontend UND Backend)

Einheiten intern: **m, kN**, Spannungen im Response in **MPa (N/mm²)**.

Ursprung (0,0) = **linke untere Ecke der Wand** (UK Decke unten, Außenkante Lager A). x nach rechts, y nach oben.

| Größe | Formel / Default |
|---|---|
| Gesamtlänge `L` | `b_lager_a + l_licht + b_lager_b` = 0,40 + 3,40 + 0,40 = **4,20 m** |
| Stützweite `l_eff` | `b_lager_a/2 + l_licht + b_lager_b/2` = **3,80 m** |
| Achse Lager A | `x_A = b_lager_a/2` = 0,20 |
| Achse Lager B | `x_B = L − b_lager_b/2` = 4,00 |
| Gesamthöhe `H` | `h_decke_unten + h_licht + h_decke_oben` = 0,20 + 2,60 + 0,20 = **3,00 m** |
| Decke unten | Streifen y ∈ [0, h_decke_unten] |
| Decke oben | Streifen y ∈ [H − h_decke_oben, H] |
| Öffnung links | `x_o = x_A + oeffnung.a_lager_a` = 0,20 + 1,10 = 1,30 |
| Öffnung Breite/Höhe | `b = 0,75`, `h = 1,20` |
| Öffnung oben | `y_o,oben = H − oeffnung.a_oben` = 3,00 − 0,90 = 2,10 → Unterkante `y_o = 0,90` |
| Einzellast | Achse bei `x_P = x_A + x_last` = 0,20 + 2,10 = 2,30, verteilt über `b_stuetze = 0,40` → x ∈ [2,10; 2,50] |

**Hinweis Öffnungslage:** Die Bemaßung in der Skizze (90 / 1,20 / 90 = 3,00 m) und Abb. 3.69 zeigen
den Abstand 0,90 m ab **Oberkante Wand**. Daher Parameter `a_oben` = Abstand OK Wand → OK Öffnung
(Default 0,90). Im UI im Tooltip erklären.

Validierung (Frontend + Backend 422): Öffnung muss vollständig innerhalb `0 < x < L`, `0 < y < H` liegen
(Mindeststeg 0,05 m zu allen Rändern); Einzellastbereich innerhalb [0, L]; alle Maße > 0.

## 2. Statisches/FE-Modell (Backend)

- Scheibenmodell in der XY-Ebene mit `model.add_rectangle_mesh(..., plane='XY', element_type='Quad')`,
  Dicke `t_wand` über die **gesamte** Höhe (Deckenstreifen vereinfacht mit Wanddicke – konservativ,
  in `meta.warnings`/UI-Hinweis dokumentieren). Öffnung über `mesh.add_rect_opening(...)`.
- `x_control`/`y_control` erzwingen Netzlinien an: Lagerrändern (b_lager_a, L−b_lager_b),
  Lagerachsen, Öffnungskanten, Deckenkanten, Stützenrändern, **allen Schnittpositionen** (§3).
- Material: `E = Ecm` (kN/m²), `nu = 0.2`, `G = E/(2(1+nu))`, `rho` = 0 (Eigengewicht separat als Knotenlast).
- Out-of-plane-DOF sperren: an **allen** Knoten `DZ, RX, RY, RZ` fest → reine Scheibe.
- Auflager (über die Lagerbreite verteilt, Knoten auf y = 0):
  - Lager A: alle Knoten x ∈ [0, b_lager_a] → `DY` fest; Knoten nächst `x_A` zusätzlich `DX` fest.
  - Lager B: alle Knoten x ∈ [L − b_lager_b, L] → `DY` fest.
- Lastfälle (Pynite load cases), Kräfte in −Y, als Knotenlasten über Einzugslängen/-flächen:
  - `EG`  : Eigengewicht `gamma_beton · t_wand · A_elem / 4` je Elementknoten.
  - `G_D` : `oben.gk` auf Knoten y = H (über ganze Länge L) + `unten.gk` auf Knoten y = h_decke_unten.
  - `Q_D` : analog mit `qk`.
  - `G_S` : `stuetze.Gk` gleichmäßig auf Knoten y = H im Bereich der Stützenbreite.
  - `Q_S` : analog mit `Qk`.
  - Linienlast → Knotenlasten über Einzugslänge (Randknoten halbe Länge). Summe muss exakt stimmen.
- Kombinationen (Response-Keys):
  | key | Label | Faktoren |
  |---|---|---|
  | `gleich_uls` | Gleichlast (GZT) | 1,35·EG + 1,35·G_D + 1,5·Q_D |
  | `einzel_uls` | Einzellast (GZT) | 1,35·G_S + 1,5·Q_S |
  | `gesamt_uls` | Gesamt (GZT) | 1,35·(EG+G_D+G_S) + 1,5·(Q_D+Q_S) |
  | `gesamt_char` | Gesamt (charakteristisch) | alles 1,0 |
- Lösung: `analyze_linear(check_stability=True, sparse=True)`.
- **Vor der Implementierung verifizieren** (Mini-Testmodell): Einheit von `Quad3D.membrane()`
  (Spannung kN/m² vs. Kraft/Länge), Reihenfolge `[Sx, Sy, Txy]`, Orientierung lokale↔globale Achsen
  bei plane='XY', Zuordnung der Eckpunkte zu (xi, eta) = (±1, ±1). Ergebnis im Code kommentieren.

## 3. Postprocessing (Backend)

1. Elementspannungen am Elementmittelpunkt (`membrane(0,0)`) → σx, σy, τxy [MPa].
2. Geglättete Knotenspannungen: `membrane()` an den 4 Ecken auswerten, je Knoten mitteln.
3. Hauptspannungen: σ1,2 = (σx+σy)/2 ± √(((σx−σy)/2)² + τxy²), Winkel
   α = ½·atan2(2τxy, σx−σy) (Richtung von σ1, rad, gegen x-Achse).
4. Spannungsschnitte:
   - **σx-Schnitte** (vertikale Schnittlinien x = const, Abb. 3.71/3.75): Werte entlang y aus geglätteten
     Knotenspannungen der Netzlinie (Öffnung → Lücke: Punkte im Öffnungsbereich weglassen,
     Linie in Segmente teilen). Default-Positionen (vom Frontend gesendet):
     `[x_A + 0.40, x_o, x_o + b, x_B − 0.70]` → gerundet auf Netz.
   - **σy-Schnitte** (horizontale Linien y = const, Abb. 3.72/3.76). Default:
     `[H − h_decke_oben/2, y_o + h + (H − h_decke_oben − y_o − h)/2, y_o + h/2, y_o/2 + h_decke_unten/2, h_decke_unten/2]`.
   - Je Schnitt Resultierende: `Z = Σ(σ>0)·t·Δ` (Zug, kN) und `D = Σ(σ<0)·t·Δ` (Druck, kN),
     Lage des Maximums, für σx-Schnitte zusätzlich `As_erf = Z / fyd` [cm²] mit fyd = 500/1,15 MPa.
5. Auflagerreaktionen je Kombination (Summe der Knotenreaktionen Lager A / Lager B, kN).
6. Extremwerte: max σ1, min σ2, max/min σx, σy, |τxy|; Vergleich min σ2 gegen fcd
   (`fcd = 0,85·fck/1,5`, DE-NA) und gegen reduzierte Druckfestigkeit `0,6·(1−fck/250)·fcd`
   (Info, Ausnutzung als Prozent).
7. Gleichgewichtskontrolle: Σ Reaktionen vs. Σ Lasten je Kombination → `meta.equilibrium`.

## 4. API-Vertrag

`GET /health` → `{"status":"ok","pynite":"<version>"}`

`POST /analyze` — Request (JSON):
```json
{
  "geometrie": {
    "t_wand": 0.30, "b_lager_a": 0.40, "b_lager_b": 0.40,
    "l_licht": 3.40, "h_licht": 2.60, "h_decke_oben": 0.20, "h_decke_unten": 0.20,
    "oeffnung": { "a_lager_a": 1.10, "b": 0.75, "h": 1.20, "a_oben": 0.90 },
    "b_stuetze": 0.40
  },
  "material": { "beton": "C30/37", "exposition": "XC1", "gamma_beton": 25.0 },
  "lasten": {
    "oben":    { "gk": 20.0, "qk": 8.0 },
    "unten":   { "gk": 20.0, "qk": 8.0 },
    "stuetze": { "Gk": 1000.0, "Qk": 600.0, "x_last": 2.10 }
  },
  "berechnung": {
    "netz": 0.10,
    "schnitte_x": [0.60, 1.30, 2.05, 3.30],
    "schnitte_y": [2.90, 2.45, 1.50, 0.55, 0.10]
  }
}
```

Response (200):
```json
{
  "meta": { "n_nodes": 0, "n_elements": 0, "runtime_s": 0.0, "pynite": "3.2.0",
            "warnings": ["..."], "equilibrium": { "<combo>": { "sum_loads": 0.0, "sum_reactions": 0.0 } } },
  "geometrie": { "L": 4.2, "H": 3.0, "l_eff": 3.8, "x_A": 0.2, "x_B": 4.0,
                 "oeffnung": { "x": 1.3, "y": 0.9, "b": 0.75, "h": 1.2 } },
  "material": { "beton": "C30/37", "fck": 30, "fcd": 17.0, "fctm": 2.9, "Ecm": 33000,
                "fyd": 434.8, "exposition": "XC1", "min_beton": "C16/20", "c_min_dur": 10,
                "expo_ok": true },
  "kombinationen": [ { "key": "gleich_uls", "label": "Gleichlast (GZT)" } ],
  "ergebnisse": {
    "<combo key>": {
      "elemente": [ { "id": "Q1", "xy": [[x,y],[x,y],[x,y],[x,y]], "cx": 0, "cy": 0,
                      "sx": 0, "sy": 0, "txy": 0, "s1": 0, "s2": 0, "alpha": 0 } ],
      "knoten":   [ { "id": "N1", "x": 0, "y": 0, "sx": 0, "sy": 0, "txy": 0, "s1": 0, "s2": 0 } ],
      "schnitte_x": [ { "pos": 1.30, "segmente": [ [ { "y": 0.0, "s": 0.0 } ] ],
                        "Z": 0, "D": 0, "As_erf": 0, "s_max": 0, "s_min": 0 } ],
      "schnitte_y": [ { "pos": 0.10, "segmente": [ [ { "x": 0.0, "s": 0.0 } ] ],
                        "Z": 0, "D": 0, "s_max": 0, "s_min": 0 } ],
      "reaktionen": { "A": { "Fx": 0, "Fy": 0 }, "B": { "Fx": 0, "Fy": 0 } },
      "extrema": { "s1_max": 0, "s2_min": 0, "sx_max": 0, "sx_min": 0, "sy_max": 0, "sy_min": 0,
                   "txy_abs_max": 0, "ausnutzung_druck": 0.0 }
    }
  }
}
```
Fehler: 422 (Validierung, `detail` mit deutscher Meldung), 500 (`detail` mit Fehlertext).
CORS für `http://localhost:3000` erlauben; Frontend ruft zusätzlich via Next-Rewrite `/api/fe/:path*` → `http://127.0.0.1:8000/:path*`.

## 5. EC2 / DE-NA Daten (identisch in `backend/app/ec2.py` und `frontend/lib/ec2.ts`)

Betonklassen (fck, fctm, Ecm [MPa]):
C12/15 (12; 1.6; 27000), C16/20 (16; 1.9; 29000), C20/25 (20; 2.2; 30000), C25/30 (25; 2.6; 31000),
C30/37 (30; 2.9; 33000), C35/45 (35; 3.2; 34000), C40/50 (40; 3.5; 35000), C45/55 (45; 3.8; 36000),
C50/60 (50; 4.1; 37000), C55/67 (55; 4.2; 38000), C60/75 (60; 4.4; 39000), C70/85 (70; 4.6; 41000),
C80/95 (80; 4.8; 42000), C90/105 (90; 5.0; 44000), C100/115 (100; 5.2; 45000).

Expositionsklassen → Mindestbetonfestigkeit (DIN EN 1992-1-1/NA, Tab. E.1DE), c_min,dur [mm] (Betonstahl, Tab. 4.4DE):
X0 → C12/15, 10 · XC1 → C16/20, 10 · XC2 → C16/20, 20 · XC3 → C20/25, 20 · XC4 → C25/30, 25 ·
XD1 → C30/37, 40 · XD2 → C35/45, 40 · XD3 → C35/45, 40 · XS1 → C30/37, 40 · XS2 → C35/45, 40 ·
XS3 → C35/45, 40 · XF1 → C25/30, – · XF2 → C25/30, – · XF3 → C25/30, – · XF4 → C30/37, – ·
XA1 → C25/30, – · XA2 → C35/45, – · XA3 → C35/45, – · XM1 → C30/37, – · XM2 → C35/45, – · XM3 → C35/45, –
(„–“ = c_min,dur aus begleitender XC/XD/XS-Klasse, als `null` liefern).
`expo_ok = fck(beton) >= fck(min_beton)`; sonst Warnung im UI.

## 6. Frontend (Next.js) – UI nach VIKTOR-Logik

Stack: Next.js (App Router, TS), Tailwind CSS, **react-konva/konva** (2D-Rendering), zustand (State).

Layout (Desktop, 100vh, kein Seiten-Scroll):
- **Topbar** dunkel (#1b1d2e), links Hamburger + App-Name „WANDSCHEIBE“ (eigener Schriftzug, kein VIKTOR-Logo),
  rechts Status-Chip (Backend online/offline via `/health`).
- **Linkes Panel (~40 %)**: Tabs `Geometrie` · `Material` · `Lasten` · `Berechnung`; Felder in Karten wie Screenshot 1,
  jedes Feld mit Label, Einheit, Tooltip. Zahleninputs (step 0,05 m bzw. 1 cm – Eingabe in den in der Aufgabe genannten
  Einheiten: cm für Dicken/Breiten, m für Längen; intern m). Slider + Zahlenanzeige für Lasten
  (gk/qk 0–100 kN/m, Gk 0–3000 kN, Qk 0–2000 kN). Dropdowns Betongüte/Exposition (mit Warn-Badge bei unzulässiger Kombination).
  `Berechnung`: Netzweite (0,20 / 0,10 / 0,05 m), Schnittpositionen x/y editierbar (Liste, „Standard wiederherstellen“).
- **Rechtes Panel**: Tabs `System` | `Ergebnis` (wie Screenshot 2 „Map View | Building“), Vollbild-Button.
  - **System** (live, ohne Run): maßstäbliche Ansicht wie Skizze (Bild 3): Wandumriss, schraffierte Decken,
    Öffnung, Lager (Dreiecke + Breite), Maßketten oben (Lagerachsen / Stütze) und unten (40 | 3,40 | 40, 3,80),
    links Gesamthöhe, rechts Höhenkette Öffnung (90 / 1,20 / 90), Öffnungsabstand 1,10 / 0,75,
    grüne Lastpfeile g+q oben und unten, grüner Einzellastpfeil G_k+Q_k, Reaktionen A_Ed/B_Ed,
    Label Betongüte. Daneben kleiner „Schnitt Wand“ (I-Querschnitt mit t_wand und Deckenstärken).
    Zoom per Mausrad, Pan per Drag, „Einpassen“-Button. Zusätzlich Ein/Aus: Netzvorschau, Schnittlinien.
  - **Ergebnis** (nur nach Run): Auswahl Kombination (Dropdown) + Ansicht (Segmented Control):
    1. *Hauptspannungen* – Kreuze je Element, Länge ∝ |σ|, blau = Druck, rot = Zug (Abb. 3.69/3.73)
    2. *Trajektorien* – Kreuze konstanter Länge, nur Richtung, Farbe nach Vorzeichen (Abb. 3.70/3.74)
    3. *Schnitte σx* – vertikale Schnitte, Verlauf als Kurve senkrecht zur Schnittlinie, Fläche gefüllt
       blau/rot, Beschriftung Max-Werte, Z und As,erf (Abb. 3.71/3.75)
    4. *Schnitte σy* – horizontale Schnitte analog (Abb. 3.72/3.76)
    5. *Konturplot* – σx / σy / τxy / σ1 / σ2 wählbar, divergente Farbskala (rot Zug / blau Druck, weiß 0) mit Legende
    Hover-Tooltip zeigt Element-/Knotenwerte. Skalierungsfaktor-Slider für Pfeile/Kurven.
    Unter der Grafik: Kennwert-Tabelle (Auflagerkräfte A/B, Extremwerte, Ausnutzung Druck, Gleichgewichtskontrolle,
    Schnitt-Resultierende Z/D/As,erf).
- **Bottom-Bar** (wie VIKTOR): links Statustext, rechts **Run**-Button (blau, Spinner während Berechnung).
  Ergebnisse ändern sich **nur** bei Run. Werden Eingaben nach einem Run geändert, erscheint im Ergebnis-Tab
  ein Banner „Eingaben geändert – Ergebnis veraltet, bitte Run drücken“ (Hash-Vergleich der Eingaben).
  Nach erfolgreichem Run automatisch auf Tab `Ergebnis` wechseln. Fehler (422/500/offline) als Toast.

Frontend-Dateien:
```
frontend/
  next.config.ts            (rewrites /api/fe → 127.0.0.1:8000)
  app/layout.tsx, app/page.tsx, app/globals.css
  lib/types.ts              (Request/Response-Typen exakt nach §4)
  lib/defaults.ts           (Initialwerte, Default-Schnitte aus Geometrie)
  lib/geometry.ts           (abgeleitete Größen §1 + Validierung)
  lib/ec2.ts                (§5)
  lib/api.ts                (health, analyze)
  store/useStore.ts         (zustand: inputs, result, resultHash, status)
  components/layout/TopBar.tsx, BottomBar.tsx, ParamPanel.tsx, ViewPanel.tsx
  components/inputs/NumberField.tsx, SliderField.tsx, SelectField.tsx, Section.tsx
  components/views/SystemView.tsx       (Konva)
  components/views/ResultView.tsx       (Steuerung + Kennwerte)
  components/views/canvas/*.tsx         (PrincipalStress, Trajectories, SectionsX, SectionsY, Contour, Legend, Dimension, Hatch)
```
Konva in Next: Komponenten mit `dynamic(() => import(...), { ssr: false })` laden.

## 7. Arbeitspakete & Reihenfolge

| # | Paket | Wer | Abnahme |
|---|---|---|---|
| 1 | Plan + API-Vertrag | Opus | dieses Dokument |
| 2 | Backend (FE-Modell, Postprocessing, API, Tests) | Sonnet-Agent A | `pytest` grün, Gleichgewicht < 0,1 %, curl auf `/analyze` mit Defaults < 15 s |
| 3 | Frontend (UI, System-View, Ergebnis-Views) | Sonnet-Agent B (parallel zu 2, gegen Vertrag) | `npm run build` fehlerfrei |
| 4 | Integration, Start-Skript, E2E-Test im Browser | Opus | Run liefert Bilder analog Abb. 3.69–3.76 |

Plausibilitätserwartungen (Gleichlast): Druckbogen über der Öffnung, Zugband im unteren Bereich (σx > 0 unten),
σy-Konzentration an den Lagern; Einzellast: Druckstreben von der Stütze zu den Lagern, Spaltzug unter der Last.
