import { useMemo, useState } from 'react'
import { buildEvidencePacket, buildEvidenceText, downloadJson } from '../lib/evidence.js'
import { formatTimestamp } from '../lib/format'

function packetFilename(packet) {
  const stamp = packet.emergency.asOf
    ? packet.emergency.asOf.replace(/[^0-9]/g, '').slice(0, 14)
    : new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
  return `apocalypsewatch-evidence-${stamp}.json`
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('Clipboard access is unavailable.')
}

export function EvidencePacket({ data, signal, emergencyLevel, archiveHealth, sensitivity, lastFetchedAt }) {
  const [copyLabel, setCopyLabel] = useState('Copy text')
  const packet = useMemo(
    () => buildEvidencePacket({
      data,
      signal,
      emergencyLevel,
      archiveHealth,
      sensitivity,
      lastFetchedAt,
    }),
    [data, signal, emergencyLevel, archiveHealth, sensitivity, lastFetchedAt],
  )
  const text = useMemo(() => buildEvidenceText(packet), [packet])
  const coverage = packet.archive.coverageRatio === null ? '—' : `${Math.round(packet.archive.coverageRatio * 100)}%`

  async function handleCopy() {
    try {
      await copyText(text)
      setCopyLabel('Copied')
      window.setTimeout(() => setCopyLabel('Copy text'), 1800)
    } catch {
      setCopyLabel('Copy unavailable')
      window.setTimeout(() => setCopyLabel('Copy text'), 2200)
    }
  }

  return (
    <section className="card evidence-card" id="evidence-packet" aria-labelledby="evidence-title">
      <div className="card-header">
        <div>
          <div className="card-title" id="evidence-title">Public evidence packet</div>
          <div className="evidence-subtitle">Current snapshot · JSON + plain text</div>
        </div>
        <div className="card-eyebrow">Generated {formatTimestamp(packet.generatedAt)}</div>
      </div>

      <p className="evidence-intro">
        A citation-ready snapshot of the dial, model inputs, data age, archive validation, and source links. ISO
        timestamps in the downloaded JSON are UTC; the packet also includes the browser&apos;s local generation time.
      </p>

      <div className="evidence-metrics" aria-label="Evidence packet summary">
        <div><span>Level</span><strong>{packet.emergency.level}/5 · {packet.emergency.label}</strong><small>as of {formatTimestamp(packet.emergency.asOf)}</small></div>
        <div><span>Airborne</span><strong>{packet.counts.airborne ?? '—'} / {packet.counts.tracked ?? '—'}</strong><small>tracked cohort</small></div>
        <div><span>Deviation</span><strong>{packet.counts.sigmaShift === null ? '—' : `${packet.counts.sigmaShift}σ`}</strong><small>expected {packet.counts.expectedConcurrent ?? '—'}</small></div>
        <div><span>Data age</span><strong>{packet.emergency.dataAgeMinutes === null ? '—' : `${packet.emergency.dataAgeMinutes} min`}</strong><small>latest provider sample</small></div>
        <div><span>Archive</span><strong>{coverage}</strong><small>{packet.archive.observedSlots.toLocaleString()} / {packet.archive.expectedSlots.toLocaleString()} slots</small></div>
      </div>

      <details className="evidence-details">
        <summary>Preview shareable text</summary>
        <textarea className="evidence-text" value={text} readOnly rows={8} aria-label="Plain-text evidence packet" />
      </details>

      <div className="evidence-actions">
        <button type="button" className="evidence-action evidence-action--primary" onClick={() => downloadJson(packetFilename(packet), packet)}>
          Download JSON
        </button>
        <button type="button" className="evidence-action" onClick={handleCopy}>{copyLabel}</button>
      </div>

      <div className="evidence-sources">
        <span>Sources</span>
        {packet.sources.map((source) => source.url ? (
          <a key={source.label} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
        ) : (
          <span key={source.label}>{source.label}: {source.name}</span>
        ))}
      </div>
    </section>
  )
}
