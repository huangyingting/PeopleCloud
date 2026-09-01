import { ArrowLeftRight, MapPin, Search, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { categoryLabel } from '../data/categories'
import { periodById } from '../data/periods'
import { placeRelationLabel, relatedPeople, searchPeople } from '../lib/explore'
import type { Person } from '../types'
import { FocusTrap } from './FocusTrap'

interface CompareDialogProps {
  person: Person
  people: Person[]
  onSelect: (person: Person) => void
  onClose: () => void
  returnFocusRef: React.RefObject<HTMLButtonElement | null>
}

function ComparePersonCard({ person, side }: { person: Person; side: 'left' | 'right' }) {
  const period = periodById.get(person.periodId)!
  return (
    <article className={`compare-person compare-person-${side}`} style={{ '--compare-accent': period.accent } as React.CSSProperties}>
      <header>
        <span className="compare-period">{period.label} · {period.dateRange}</span>
        <div><h3>{person.name}</h3><small>{person.courtesy ? `字${person.courtesy} · ` : ''}{person.lifespan}</small></div>
      </header>
      <div className="compare-tags">{person.categories.map((category) => <span key={category}>{categoryLabel[category]}</span>)}</div>
      <p>{person.summary}</p>
      <dl>
        <div><dt>身份</dt><dd>{person.roles.join(' · ')}</dd></div>
        <div><dt>地图坐标</dt><dd><strong>{person.place.name}</strong><span>{placeRelationLabel(person.place.relation)}</span></dd></div>
        <div><dt>代表成就</dt><dd><ul>{person.achievements.slice(0, 3).map((achievement) => <li key={achievement}>{achievement}</li>)}</ul></dd></div>
      </dl>
    </article>
  )
}

export function CompareDialog({ person, people, onSelect, onClose, returnFocusRef }: CompareDialogProps) {
  const recommendations = useMemo(() => relatedPeople(person, people, 6).map((entry) => entry.person), [people, person])
  const [targetId, setTargetId] = useState(() => recommendations[0]?.id ?? people.find((entry) => entry.id !== person.id)!.id)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const target = people.find((entry) => entry.id === targetId && entry.id !== person.id) ?? recommendations[0]
  const results = useMemo(() => searchPeople(people, query)
    .filter((entry) => entry.id !== person.id)
    .slice(0, 8), [people, person.id, query])

  useEffect(() => {
    const fallback = relatedPeople(person, people, 1)[0]?.person ?? people.find((entry) => entry.id !== person.id)
    if (fallback) setTargetId(fallback.id)
    setQuery('')
  }, [people, person])

  if (!target) return null

  return (
    <div className="modal-backdrop compare-backdrop">
      <FocusTrap className="compare-dialog" label="人物对照" onClose={onClose} returnFocusRef={returnFocusRef} initialFocusRef={searchRef}>
        <header className="compare-header">
          <div><span>PARALLEL LIVES</span><h2>人物对照</h2><p>并置时代、领域与地理坐标，不将相似性误写成历史关系。</p></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭人物对照"><X /></button>
        </header>

        <div className="compare-picker">
          <label className="compare-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">搜索对照人物</span>
            <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索第二位人物、身份、地点或时代…" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="清空对照搜索"><X size={14} /></button>}
          </label>
          <div className="compare-suggestions" aria-label="对照人物选择">
            {(query ? results : recommendations).map((candidate) => (
              <button type="button" key={candidate.id} className={candidate.id === target.id ? 'active' : ''} aria-pressed={candidate.id === target.id} onClick={() => { setTargetId(candidate.id); setQuery('') }}>
                <strong>{candidate.name}</strong><small>{periodById.get(candidate.periodId)?.label} · {candidate.roles[0]}</small>
              </button>
            ))}
            {query && results.length === 0 && <span className="compare-empty">没有匹配人物</span>}
          </div>
        </div>

        <div className="compare-stage" role="region" aria-label="人物对照内容" tabIndex={0}>
          <ComparePersonCard person={person} side="left" />
          <div className="compare-axis" aria-hidden="true"><span><ArrowLeftRight /></span><i /></div>
          <ComparePersonCard person={target} side="right" />
        </div>

        <footer className="compare-footer">
          <span><Sparkles size={14} /> 对照只呈现当前策展数据</span>
          <button type="button" onClick={() => { onSelect(target); onClose() }}><MapPin size={15} />在星图中查看 {target.name}</button>
        </footer>
      </FocusTrap>
    </div>
  )
}
