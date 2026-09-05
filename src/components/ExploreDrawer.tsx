import { X } from 'lucide-react'
import { categories, categoryLabel } from '../data/categories'
import { people } from '../data/people'
import { periodById } from '../data/periods'
import { peopleForPeriod } from '../lib/explore'
import type { CategoryId, PeriodId } from '../types'
import { PeriodTimeline } from './PeriodTimeline'

interface ExploreDrawerProps {
  open: boolean
  periodId: PeriodId
  category: CategoryId | 'all'
  onPeriodChange: (period: PeriodId) => void
  onCategoryChange: (category: CategoryId | 'all') => void
  onClose: () => void
}

export function ExploreDrawer({ open, periodId, category, onPeriodChange, onCategoryChange, onClose }: ExploreDrawerProps) {
  const period = periodById.get(periodId)!
  return (
    <section id="explore-controls" className="explore-drawer" aria-label="时代与领域" hidden={!open}>
      {open && <>
        <header>
          <div><h2>时代与领域</h2><p>沿时间与兴趣，缩小探索范围</p></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="收起时代与领域"><X size={17} /></button>
        </header>
        <PeriodTimeline value={periodId} onChange={onPeriodChange} />
        <div className="category-filter" aria-label="人物领域筛选">
          <button type="button" className={category === 'all' ? 'active' : ''} aria-pressed={category === 'all'} onClick={() => onCategoryChange('all')}>全部 <span>{peopleForPeriod(people, periodId, 'all').length}</span></button>
          {categories.map(({ id, label, icon: Icon }) => {
            const count = peopleForPeriod(people, periodId, id).length
            return <button type="button" key={id} disabled={!count} className={category === id ? 'active' : ''} aria-pressed={category === id} onClick={() => onCategoryChange(id)} title={!count ? `${period.label}暂无${label}人物` : undefined}><Icon size={14} />{label}<span>{count}</span></button>
          })}
        </div>
        <div className="map-result-count" role="status">{category === 'all' ? period.label : categoryLabel[category]} · {peopleForPeriod(people, periodId, category).length} 位人物</div>
      </>}
    </section>
  )
}
