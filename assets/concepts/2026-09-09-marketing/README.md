# ApocalypseWatch presentation review

This folder preserves the pre-delivery source and every visual attempt from the v0.2.1 marketing pass. An archived candidate is not automatically an approved logo.

## Originals

- `original-source-fbb0ad7.zip` preserves all 83 tracked files from baseline fbb0ad7fe7fe404fd301eb1f3e8fdf78781812a0, including the original README and the incomplete raster assets. The index records canonical Git-blob hashes.
- `original-logo-prompts.txt` is the unmodified, previously local logo prompt pack. It is a historical brief, not a record that those prompts were executed.
- `baseline/` contains six views of the unmodified v0.2.0 frontend using its existing synthetic demonstration response. The fixture and capture details are included. It is not a live-flight capture.

## Native vector candidates

`restored-aircraft.svg` restores the previous aircraft emblem through a complete renderer. `flight-signal.svg` keeps the aircraft identity with an open observation ring, stronger contours and restrained color. Their PNGs are direct native-vector renders, not generated photos or product screenshots.

Keep both candidates and every subsequent size, theme and README comparison. The final selection record identifies the asset actually promoted. The old orange emblem must remain available even if a different treatment is selected.

`branding-r1/` preserves the first share-card export. Its embedded icon inherited a black fill on open paths. That export was rejected; subsequent exports preserve the vector's `fill="none"` behavior. The original candidate icon itself was unaffected.

`branding-r2/` contains the corrected share image, a dark/light comparison at 16 through 128 pixels, and exact export checks at nine icon sizes. The flight-signal candidate is selected. Its plane reads more clearly at small sizes, the open ring suggests observation, and the cyan/amber treatment fits the dashboard without implying a fire or disaster. This is an internal design review, not an endorsement from an outside firm.

## Application review attempts

| Folder | Result |
| --- | --- |
| `app-r1/` | The page loaded, but the history chart had no drawable size. Kept the actual API response and failed review record. |
| `app-r2/` | Captured the first layout, including the blank chart and sideways dial. Rejected as final screenshots. A range-check assumption also used the display label instead of its URL identifier. |
| `app-r3/` | Chart sizing and dial orientation corrected. Captures retained. The clipboard check incorrectly expected display text in title case after CSS changed it to uppercase. |
| `app-r4/` | Selected product captures. All 31 checks passed against the actual local API with a fresh synthetic database. Includes desktop, light theme, narrow layouts and evidence tools. |
| `edge-r1/` | Twelve checks passed for explicit level, stale, malformed and unavailable-data fixtures. These are test states, not measured activity and not the primary marketing images. |
| `artifact-r1/` | The extracted demonstration ran without dependencies or external browser requests. A fresh source extraction installed its lockfile, passed all 49 tests and lint, then built successfully. All 83 original Git blobs matched their archived hashes. |

The main README uses byte-identical copies of selected `app-r4` screenshots. Clipboard logic was exercised with an isolated in-memory sink so the review would not overwrite the host clipboard. Live collection, provider credentials and real notification delivery were not exercised. No active desktop or signed-in browser was used.

## Screenshot standard

Product screenshots must come from an actual browser running the built application. Demonstration data must stay labelled. Don't draw a pretend dashboard or hide a stale-data warning for a better-looking picture. Preserve failed captures and describe why they weren't selected.
