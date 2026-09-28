import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { people, personById } from '../data/people'
import { periodById } from '../data/periods'
import { relationKindById } from '../data/relationKinds'
import { bondIndexFor } from '../lib/relations'
import type { Person } from '../types'

const featuredPairs: Array<[string, string]> = [
  ['li-bai', 'du-fu'],
  ['ouyang-xiu', 'su-shi'],
  ['liu-bei', 'zhuge-liang'],
  ['wang-anshi', 'sima-guang'],
  ['lin-zexu', 'zuo-zongtang'],
  ['ji-kang', 'ruan-ji'],
]

const CYCLE_MS = 7000

export function IntroBonds({ onEnter }: { onEnter: (person: Person) => void }) {
  const index = bondIndexFor(people)
  const pairs = featuredPairs.flatMap(([a, b]) => {
    const bond = index.bondBetween(a, b)
    const first = personById.get(a)
    const second = personById.get(b)
    return bond?.story && first && second ? [{ bond, first, second }] : []
  })
  const [active, setActive] = useState(0)
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [paused, setPaused] = useState(reducedMotion)

  useEffect(() => {
    if (paused || pairs.length < 2) return
    const timer = window.setTimeout(() => setActive((current) => (current + 1) % pairs.length), CYCLE_MS)
    return () => window.clearTimeout(timer)
  }, [active, paused, pairs.length])

  const current = pairs[active]
  if (!current) return null
  const meta = relationKindById[current.bond.kind]
  const samePeriod = current.first.periodId === current.second.periodId
  const periodLabel = samePeriod ? periodById.get(current.first.periodId)?.label : `${periodById.get(current.first.periodId)?.label} · ${periodById.get(current.second.periodId)?.label}`

  return (
    <aside className="hero-card bond-card" aria-label="星线 · 人物之间的相遇" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(reducedMotion)} onFocus={() => setPaused(true)} style={{ '--kind': meta.color } as React.CSSProperties}>
      <span>星线 · 此刻相遇</span>
      <div className="bond-card-stage" key={active} aria-hidden="true">
        <svg viewBox="0 0 240 120">
          <path className="bond-card-arc" d="M44 78 Q120 8 196 78" pathLength={1} />
          {!reducedMotion && <circle className="bond-card-spark" r="3.2"><animateMotion dur="3.2s" repeatCount="indefinite" path="M44 78 Q120 8 196 78" /></circle>}
        </svg>
        <b className="bond-card-orb first">{current.first.name.slice(0, 1)}</b>
        <b className="bond-card-orb second">{current.second.name.slice(0, 1)}</b>
      </div>
      <h2 className="bond-card-names"><span>{current.first.name}</span><i aria-hidden="true">·</i><span>{current.second.name}</span></h2>
      <p className="bond-card-kind">{meta.label} · {current.bond.label} · {periodLabel}</p>
      <blockquote key={`story-${active}`}>{current.bond.story}</blockquote>
      <div className="bond-card-dots" role="group" aria-label="选择一段相遇">
        {pairs.map((pair, order) => <button key={pair.bond.key} type="button" aria-label={`${pair.first.name}与${pair.second.name}`} aria-pressed={order === active} onClick={() => { setActive(order); setPaused(true) }} />)}
      </div>
      <button className="hero-card-action" type="button" onClick={() => onEnter(current.first)} aria-label={`从${current.first.name}开始探索`}>从{current.first.name}开始 <ChevronRight size={13} /></button>
    </aside>
  )
}
