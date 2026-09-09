# Using ApocalypseWatch v0.2.1

[Project overview](../README.md) · [Setup and deployment](development/README.md)

ApocalypseWatch displays business-jet activity from a configured snapshot. Its local backend can collect a cohort and build that snapshot, but the website may use someone else's published feed. Check the source before interpreting a reading.

## Read the opening screen

The activity dial and world map sit together. The dial shows a level from 1 to 5, with observed and expected counts below it. **Signal calculation** opens the underlying values. The map shows the positions present in the latest snapshot, not continuous aircraft movement.

![Activity dial and map using synthetic demonstration data](../assets/screenshots/dashboard-dark.png)

A **Demo mode** notice means the aircraft and history are synthetic. The sample aircraft identifiers start with N-DEMO. Nothing in that view describes an actual flight.

The experimental level is a numerical activity band. It doesn't establish intent or predict an emergency. Estimated seat capacity isn't a passenger count.

## Compare the history

Choose **24h**, **7d**, **30d** or **1y** on the chart. The address keeps your chosen range so you can link to it. **Table** shows the latest 48 samples within that range. These ranges end at the latest available sample, which may be older than today.

The expected line and standard-deviation band appear only when the snapshot includes those values. Missing values stay missing; they aren't replaced with a zero baseline.

## Check coverage before drawing a conclusion

The coverage calendar counts half-hour slots across a 365-day window. A missing day isn't a quiet day. Partial, delayed and malformed states are called out separately. Check the latest sample time as well as the overall percentage.

## Export the evidence

**Download JSON** saves the current reading, model inputs and source details to your browser's download location. **Copy text** copies a concise version. The exports include UTC timestamps and browser-local generation time. Synthetic mode and the experiment's limitations remain in the copied text.

![Evidence and sensitivity controls using synthetic data](../assets/screenshots/evidence-dark.png)

Before sharing, inspect the packet. It includes the page URL and configured snapshot URL. Avoid including private source URLs or identifiers in a public post.

## Try a different threshold

The sensitivity slider previews a different sigma threshold against the loaded data. It doesn't reconfigure collection, change the provider's model or send a notification. Reset it to return to the production threshold supplied by the snapshot.

The local model's default threshold is 7σ, with lower bands beginning at 1.75σ, 3.5σ and 5.25σ. A provider's explicitly supplied level stays authoritative in the main dial.

## Themes and compact display

Choose **Dark**, **Light** or **System** in the header. The preference is stored in this browser. Reduced-motion settings are respected.

Append `?embed` to use the compact view. It identifies synthetic data and doesn't show a reassuring default level when a request fails. A static host can place it in an iframe if its headers permit that. The default self-hosted server blocks framing; don't weaken that protection without reviewing your deployment.

## When something is missing

| What you see | What it means |
| --- | --- |
| Unable to reach dashboard | No supported snapshot has arrived. Check the source URL or local API. |
| Dashboard refresh delayed | The last successful snapshot remains visible. It may be stale. |
| Stale aircraft sweep | The sample is older than twice its declared cadence. |
| No usable airborne entries | The snapshot doesn't contain aircraft with reported positive altitude. It doesn't prove the cohort is grounded. |
| No event-history card | Static snapshots don't have a local transition database, or no transitions have been recorded. |

Live provider availability and credentials are deployment concerns. The demonstration can show the interface without either, but it cannot validate a real collection pipeline.
