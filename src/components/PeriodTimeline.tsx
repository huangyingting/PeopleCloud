import { useEffect, useRef } from 'react'
import { people } from '../data/people'
import { periods } from '../data/periods'
import type { PeriodId } from '../types'

interface PeriodTimelineProps {
  value: PeriodId
  onChange: (period: PeriodId) => void
}

export function PeriodTimeline({ value, onChange }: PeriodTimelineProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ref.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [value])

  return (
    <div className="timeline-wrap">
      <div className="timeline-heading">
        <span>时代轨道</span>
        <small>先秦 → 清 · 点击穿行</small>
      </div>
      <div ref={ref} className="period-timeline" role="group" aria-label="选择历史时期">
        {periods.map((period, index) => {
          const count = people.filter((person) => person.periodId === period.id).length
          const active = period.id === value
          return (
            <button
              type="button"
              key={period.id}
              className={active ? 'period-node active' : 'period-node'}
              aria-current={active ? 'true' : undefined}
              aria-label={`${period.label}，${period.dateRange}，收录 ${count} 人`}
              onClick={() => onChange(period.id)}
              style={{ '--period-accent': period.accent, '--period-index': index } as React.CSSProperties}
            >
              <span className="period-dot" aria-hidden="true" />
              <strong>{period.shortLabel}</strong>
              <small>{count} 人</small>
            </button>
          )
        })}
      </div>
    </div>
  )
}
