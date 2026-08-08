import { ArrowUpRight, BookOpen, MapPin, Route, X } from 'lucide-react'
import { categoryLabel } from '../data/categories'
import { periodById } from '../data/periods'
import { confidenceLabel, placeRelationLabel, relatedPeople } from '../lib/explore'
import type { Person } from '../types'

interface PersonPanelProps {
  person: Person
  people: Person[]
  onSelect: (person: Person) => void
  onClose: () => void
}

export function PersonPanel({ person, people, onSelect, onClose }: PersonPanelProps) {
  const period = periodById.get(person.periodId)!
  const related = relatedPeople(person, people)

  return (
    <aside className="person-panel" aria-label={`${person.name}人物详情`} data-person-id={person.id}>
      <div className="panel-grab" aria-hidden="true" />
      <button className="icon-button panel-close" type="button" onClick={onClose} aria-label="关闭人物详情"><X size={18} /></button>
      <div className="person-kicker"><span style={{ background: period.accent }} />{period.label} · {period.dateRange}</div>
      <div className="person-title-row">
        <div>
          <h2>{person.name}</h2>
          <p>{person.courtesy ? `字${person.courtesy} · ` : ''}{person.lifespan}</p>
        </div>
        <div className="name-orbit" aria-hidden="true"><span>{person.name.slice(0, 1)}</span></div>
      </div>
      <div className="person-tags">
        {person.roles.map((role) => <span key={role}>{role}</span>)}
      </div>
      <p className="person-summary">{person.summary}</p>

      <section className="panel-section" aria-labelledby="achievement-title">
        <h3 id="achievement-title"><BookOpen size={15} /> 代表成就</h3>
        <ul>{person.achievements.map((achievement) => <li key={achievement}>{achievement}</li>)}</ul>
      </section>

      <section className="panel-section geography-card" aria-labelledby="place-title">
        <h3 id="place-title"><MapPin size={15} /> 地图为何定位于此</h3>
        <div className="place-main">
          <strong>{person.place.name}</strong>
          <span>{placeRelationLabel(person.place.relation)}</span>
        </div>
        <p>{person.place.note}</p>
        <div className={`confidence confidence-${person.place.confidence}`}>
          <span aria-hidden="true" />{confidenceLabel[person.place.confidence]}
        </div>
      </section>

      <section className="panel-section" aria-labelledby="related-title">
        <h3 id="related-title"><Route size={15} /> 继续沿星河探索</h3>
        <div className="related-grid">
          {related.map((entry) => (
            <button type="button" key={entry.person.id} onClick={() => onSelect(entry.person)}>
              <span>{entry.person.name}</span>
              <small>{entry.label}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel-section sources" aria-labelledby="source-title">
        <h3 id="source-title">来源与进一步阅读</h3>
        {person.sources.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">
            {source.title}<ArrowUpRight size={14} />
          </a>
        ))}
        <p>短简介为本项目原创编写；来源用于核对人物基本资料与继续阅读。</p>
      </section>
      <div className="category-caption">领域：{person.categories.map((category) => categoryLabel[category]).join(' · ')}</div>
    </aside>
  )
}
