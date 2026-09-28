import { ArrowRight, BookOpen, Check, Landmark, X } from 'lucide-react'
import { useState, type RefObject } from 'react'
import { encounters } from '../data/encounters'
import { journeys, type Journey } from '../data/journeys'
import { personById } from '../data/people'
import { periodById, periods } from '../data/periods'
import type { Encounter } from '../types'
import { FocusTrap } from './FocusTrap'

const scenePeriods = periods
  .map((period) => ({ period, scenes: encounters.filter((scene) => scene.periodId === period.id) }))
  .filter((entry) => entry.scenes.length > 0)

interface JourneysDialogProps {
  initialJourneyId?: string
  onStart: (journey: Journey, stopIndex: number) => void
  onOpenScene: (scene: Encounter) => void
  onClose: () => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
}

export function JourneysDialog({ initialJourneyId, onStart, onOpenScene, onClose, returnFocusRef }: JourneysDialogProps) {
  const [journeyId, setJourneyId] = useState(initialJourneyId ?? journeys[0].id)
  const [mode, setMode] = useState<'journeys' | 'scenes'>('journeys')
  const [scenePeriodId, setScenePeriodId] = useState(scenePeriods[0].period.id)
  const selected = journeys.find((journey) => journey.id === journeyId) ?? journeys[0]
  const sceneGroup = scenePeriods.find((entry) => entry.period.id === scenePeriodId) ?? scenePeriods[0]

  return (
    <div className="modal-backdrop">
      <FocusTrap className="journeys-dialog" label="主题漫游" onClose={onClose} returnFocusRef={returnFocusRef}>
        <header className="journeys-header">
          <div><span className="journeys-eyebrow">CURATED READINGS</span><h2>循一条线索，读几种人生</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭主题漫游"><X size={20} /></button>
        </header>
        <div className="journeys-tabs" role="group" aria-label="漫游方式">
          <button type="button" aria-pressed={mode === 'journeys'} onClick={() => setMode('journeys')}><BookOpen size={14} aria-hidden="true" />主题漫游<small>{journeys.length}</small></button>
          <button type="button" aria-pressed={mode === 'scenes'} onClick={() => setMode('scenes')}><Landmark size={14} aria-hidden="true" />历史现场<small>{encounters.length}</small></button>
        </div>
        {mode === 'journeys' ? <>
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
        </> : <>
        <p className="journeys-disclaimer"><Landmark size={17} aria-hidden="true" />人物确曾同在的时刻：会面、论辩、共事或交锋。传说与存疑的场景会单独标注。</p>
        <div className="journeys-layout">
          <div className="journeys-choices" role="group" aria-label="选择时代">
            {scenePeriods.map(({ period, scenes }) => (
              <button type="button" key={period.id} aria-pressed={period.id === sceneGroup.period.id} onClick={() => setScenePeriodId(period.id)}>
                <span className="journeys-choice-index">{String(scenes.length).padStart(2, '0')}</span>
                <span><strong>{period.label}</strong><small>{period.dateRange}</small></span>
                {period.id === sceneGroup.period.id && <Check size={16} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <section className="journeys-detail" aria-labelledby="scenes-detail-title">
            <div className="journeys-detail-intro">
              <span className="journeys-eyebrow">{sceneGroup.scenes.length} 个历史现场 · 按时间排列</span>
              <h3 id="scenes-detail-title">{sceneGroup.period.label}的相遇</h3>
            </div>
            <ol className="journeys-stops scene-stops" aria-label={`${sceneGroup.period.label}历史现场`}>
              {sceneGroup.scenes.map((scene) => (
                <li key={scene.id}>
                  <button type="button" onClick={() => onOpenScene(scene)} aria-label={`进入历史现场：${scene.title}，${scene.yearLabel}`}>
                    <span className="journeys-stop-index">{scene.yearLabel}</span>
                    <span>
                      <strong>{scene.title}{scene.confidence === 'disputed' && <small>存疑</small>}</strong>
                      <span>{scene.participants.map(({ personId }) => personById.get(personId)?.name).join(' · ')} — {scene.place.name}</span>
                    </span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </div>
        </>}
      </FocusTrap>
    </div>
  )
}
