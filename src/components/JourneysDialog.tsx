import { ArrowRight, BookOpen, Check, X } from 'lucide-react'
import { useState, type RefObject } from 'react'
import { journeys, type Journey } from '../data/journeys'
import { personById } from '../data/people'
import { periodById } from '../data/periods'
import { FocusTrap } from './FocusTrap'

interface JourneysDialogProps {
  initialJourneyId?: string
  onStart: (journey: Journey, stopIndex: number) => void
  onClose: () => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
}

export function JourneysDialog({ initialJourneyId, onStart, onClose, returnFocusRef }: JourneysDialogProps) {
  const [journeyId, setJourneyId] = useState(initialJourneyId ?? journeys[0].id)
  const selected = journeys.find((journey) => journey.id === journeyId) ?? journeys[0]

  return (
    <div className="modal-backdrop">
      <FocusTrap className="journeys-dialog" label="主题漫游" onClose={onClose} returnFocusRef={returnFocusRef}>
        <header className="journeys-header">
          <div><span className="journeys-eyebrow">CURATED READINGS</span><h2>循一条线索，读几种人生</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭主题漫游"><X size={20} /></button>
        </header>
        <p className="journeys-disclaimer"><BookOpen size={17} aria-hidden="true" />编辑编排的阅读序列，非历史行旅路线；不表示人物彼此相识或思想直接传承。</p>
        <div className="journeys-layout">
          <div className="journeys-choices" role="group" aria-label="选择主题">
            {journeys.map((journey, index) => (
              <button type="button" key={journey.id} aria-pressed={journey.id === selected.id} onClick={() => setJourneyId(journey.id)}>
                <span className="journeys-choice-index">{String(index + 1).padStart(2, '0')}</span>
                <span><strong>{journey.title}</strong><small>{journey.subtitle}</small></span>
                {journey.id === selected.id && <Check size={16} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <section className="journeys-detail" aria-labelledby="journeys-detail-title">
            <div className="journeys-detail-intro">
              <span className="journeys-eyebrow">{selected.stops.length} 位人物 · 自定步调</span>
              <h3 id="journeys-detail-title">{selected.title}</h3>
              <p>{selected.introduction}</p>
              <button className="journeys-start" type="button" onClick={() => onStart(selected, 0)} aria-label={`开始漫游：${selected.title}`}>从第一站开始 <ArrowRight size={16} /></button>
            </div>
            <ol className="journeys-stops" aria-label={`${selected.title}阅读站点`}>
              {selected.stops.map((stop, index) => {
                const person = personById.get(stop.personId)!
                return (
                  <li key={stop.personId}>
                    <button type="button" onClick={() => onStart(selected, index)} aria-label={`从第 ${index + 1} 站 ${person.name} 开始`}>
                      <span className="journeys-stop-index">{String(index + 1).padStart(2, '0')}</span>
                      <span><strong>{person.name}<small>{periodById.get(person.periodId)!.label}</small></strong><span>{stop.note}</span></span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>
      </FocusTrap>
    </div>
  )
}
