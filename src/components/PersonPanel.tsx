import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bookmark, ChevronDown, ChevronUp, Columns3, Dices, List, MapPin, Route, X } from 'lucide-react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { categoryLabel } from '../data/categories'
import type { Journey } from '../data/journeys'
import { periodById } from '../data/periods'
import { confidenceLabel, placeRelationLabel, relatedPeople } from '../lib/explore'
import type { Person } from '../types'

interface PersonPanelProps {
  person: Person
  people: Person[]
  visiblePeople: Person[]
  visited: Person[]
  saved: boolean
  savedError: string | null
  saveFeedback: string
  onToggleSaved: () => void
  activeJourney: { journey: Journey; stopIndex: number } | null
  onNavigateJourney: (direction: -1 | 1) => void
  onEndJourney: () => void
  onOpenJourneys: () => void
  journeyContentsRef: RefObject<HTMLButtonElement | null>
  onSelect: (person: Person) => void
  onNavigate: (direction: -1 | 1) => void
  onSurprise: () => void
  onOpenCompare: () => void
  compareButtonRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}

export function PersonPanel({ person, people, visiblePeople, visited, saved, savedError, saveFeedback, onToggleSaved, activeJourney, onNavigateJourney, onEndJourney, onOpenJourneys, journeyContentsRef, onSelect, onNavigate, onSurprise, onOpenCompare, compareButtonRef, onClose }: PersonPanelProps) {
  const period = periodById.get(person.periodId)!
  const related = relatedPeople(person, people)
  const visibleIndex = Math.max(0, visiblePeople.findIndex((entry) => entry.id === person.id))
  const [expanded, setExpanded] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  const navigatorRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0
  }, [person.id])

  return (
    <aside ref={panelRef} className={expanded ? 'person-panel expanded' : 'person-panel'} aria-label={`${person.name}人物详情`} data-person-id={person.id}>
      <button className="panel-grab" type="button" onClick={() => setExpanded((current) => !current)} aria-label={expanded ? '收起人物详情' : '展开人物详情'} aria-expanded={expanded}>
        <span aria-hidden="true" />{expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      <button className="icon-button panel-close" type="button" onClick={onClose} aria-label="关闭人物详情"><X size={18} /></button>
      <div className="person-kicker"><span style={{ background: period.accent }} />{period.label} · {period.dateRange}</div>
      {activeJourney && <section className="journey-current" aria-labelledby="active-journey-title">
        <div className="journey-current-heading">
          <span>编辑阅读序列 · 非历史路线</span>
          <button type="button" onClick={() => { onEndJourney(); window.requestAnimationFrame(() => navigatorRef.current?.focus()) }} aria-label="结束主题漫游">结束 <X size={13} /></button>
        </div>
        <h3 id="active-journey-title">{activeJourney.journey.title}</h3>
        <p className="journey-current-progress" role="status">第 {activeJourney.stopIndex + 1} / {activeJourney.journey.stops.length} 站 · {person.name}{activeJourney.stopIndex === activeJourney.journey.stops.length - 1 ? ' · 已到终站' : ''}</p>
        <p className="journey-current-note">{activeJourney.journey.stops[activeJourney.stopIndex].note}</p>
        <div className="journey-current-actions">
          <button type="button" disabled={activeJourney.stopIndex === 0} onClick={() => onNavigateJourney(-1)} aria-label="漫游上一站"><ArrowLeft size={15} /><span>上一站</span></button>
          <button ref={journeyContentsRef} type="button" onClick={onOpenJourneys} aria-label="查看漫游目录"><List size={15} /><span>目录</span></button>
          <button type="button" disabled={activeJourney.stopIndex === activeJourney.journey.stops.length - 1} onClick={() => onNavigateJourney(1)} aria-label="漫游下一站"><span>下一站</span><ArrowRight size={15} /></button>
        </div>
      </section>}
      {!activeJourney && <div className="person-navigator" aria-label="人物漫游导航">
        <div><span>本期漫游</span><strong>{visibleIndex + 1}<small> / {visiblePeople.length}</small></strong></div>
        <div className="person-navigator-actions">
          <button ref={navigatorRef} type="button" onClick={() => onNavigate(-1)} aria-label="上一位人物"><ArrowLeft size={15} /></button>
          <button type="button" onClick={onSurprise} disabled={visiblePeople.length < 2} aria-label="偶遇一位人物"><Dices size={15} /><span>偶遇</span></button>
          <button type="button" onClick={() => onNavigate(1)} aria-label="下一位人物"><ArrowRight size={15} /></button>
        </div>
      </div>}
      <div className="person-title-row">
        <div>
          <h2>{person.name}</h2>
          <p>{person.courtesy ? `字${person.courtesy} · ` : ''}{person.lifespan}</p>
        </div>
        <button className="saved-person-toggle" type="button" onClick={onToggleSaved} aria-pressed={saved} aria-label={`${saved ? '取消收藏' : '收藏'}${person.name}`}><Bookmark size={17} aria-hidden="true" /><span>{saved ? '已收藏' : '收藏'}</span></button>
      </div>
      {savedError && <p className="saved-notice saved-notice-error" role="alert">{savedError}</p>}
      <p className={saveFeedback ? 'saved-notice' : 'sr-only'} role="status">{saveFeedback}</p>
      <div className="person-tags">
        {person.roles.map((role) => <span key={role}>{role}</span>)}
      </div>
      <p className="person-summary">{person.summary}</p>

      <div className="person-primary-actions">
        <button ref={compareButtonRef} type="button" onClick={onOpenCompare} aria-label="人物对照"><Columns3 size={16} /><span><strong>人物对照</strong><small>并置时代、领域与地点</small></span><ArrowRight size={14} /></button>
      </div>

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

      {visited.length > 1 && <section className="panel-section journey-section" aria-labelledby="journey-title">
        <h3 id="journey-title"><Route size={15} /> 你的星图足迹</h3>
        <div className="journey-trail">
          {visited.map((entry, index) => <button type="button" key={entry.id} className={entry.id === person.id ? 'active' : ''} aria-current={entry.id === person.id ? 'true' : undefined} onClick={() => onSelect(entry)}><span>{String(index + 1).padStart(2, '0')}</span>{entry.name}</button>)}
        </div>
      </section>}

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
