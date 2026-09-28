import { ArrowLeft, ArrowRight, ArrowUpRight, Landmark, X } from 'lucide-react'
import { encounters } from '../data/encounters'
import { personById } from '../data/people'
import { periodById } from '../data/periods'
import { confidenceLabel } from '../lib/explore'
import type { Encounter, Person } from '../types'

interface SceneCardProps {
  scene: Encounter
  selectedId: string
  onSelect: (person: Person) => void
  onNavigate: (scene: Encounter) => void
  onClose: () => void
}

export function SceneCard({ scene, selectedId, onSelect, onNavigate, onClose }: SceneCardProps) {
  const index = encounters.findIndex((entry) => entry.id === scene.id)
  const previous = encounters[index - 1]
  const next = encounters[index + 1]
  const period = periodById.get(scene.periodId)!
  return (
    <section className="scene-card" aria-labelledby="scene-card-title" data-scene-id={scene.id} key={scene.id}>
      <header>
        <span className="scene-card-kicker"><Landmark size={13} aria-hidden="true" />历史现场 · {period.label} · {scene.yearLabel}</span>
        <button className="icon-button" type="button" onClick={onClose} aria-label="离开历史现场"><X size={15} /></button>
      </header>
      <h2 id="scene-card-title">{scene.title}</h2>
      <p className="scene-card-place">{scene.place.name}<span className={`confidence confidence-${scene.confidence}`}><span aria-hidden="true" />{scene.confidence === 'disputed' ? '传说或存疑' : confidenceLabel[scene.confidence]}</span></p>
      <p className="scene-card-narrative">{scene.narrative}</p>
      <ul className="scene-cast" aria-label="在场人物">
        {scene.participants.map((participant, order) => {
          const person = personById.get(participant.personId)
          if (!person) return null
          const current = person.id === selectedId
          return (
            <li key={person.id} style={{ '--i': order } as React.CSSProperties}>
              <button type="button" aria-current={current ? 'true' : undefined} onClick={() => onSelect(person)} aria-label={`${person.name}，${participant.role}`}>
                <span className="scene-cast-initial" aria-hidden="true">{person.name.slice(0, 1)}</span>
                <span><strong>{person.name}</strong><small>{participant.role}</small></span>
              </button>
            </li>
          )
        })}
      </ul>
      <footer>
        <button type="button" disabled={!previous} onClick={() => previous && onNavigate(previous)} aria-label={previous ? `上一个历史现场：${previous.title}` : '没有更早的历史现场'}><ArrowLeft size={14} /></button>
        <span>{index + 1} / {encounters.length}</span>
        <button type="button" disabled={!next} onClick={() => next && onNavigate(next)} aria-label={next ? `下一个历史现场：${next.title}` : '没有更晚的历史现场'}><ArrowRight size={14} /></button>
        <a href={`https://zh.wikipedia.org/wiki/${encodeURIComponent(scene.sourceName)}`} target="_blank" rel="noopener noreferrer">延伸阅读<ArrowUpRight size={12} /></a>
      </footer>
    </section>
  )
}
