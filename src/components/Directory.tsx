import { Search, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { categories, categoryLabel } from '../data/categories'
import { people } from '../data/people'
import { periodById, periods } from '../data/periods'
import { searchPeople } from '../lib/explore'
import type { CategoryId, Person, PeriodId } from '../types'
import { FocusTrap } from './FocusTrap'

interface DirectoryProps {
  onClose: () => void
  onSelect: (person: Person) => void
  returnFocusRef: React.RefObject<HTMLButtonElement | null>
}

export function Directory({ onClose, onSelect, returnFocusRef }: DirectoryProps) {
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState<PeriodId | 'all'>('all')
  const [category, setCategory] = useState<CategoryId | 'all'>('all')
  const results = useMemo(() => searchPeople(people, query, category).filter((person) => period === 'all' || person.periodId === period), [query, period, category])
  const searchRef = useRef<HTMLInputElement>(null)

  return (
    <div className="modal-backdrop">
      <FocusTrap className="directory" label="名人名录" onClose={onClose} returnFocusRef={returnFocusRef} initialFocusRef={searchRef}>
        <header className="directory-header">
          <div><span>PEOPLE ARCHIVE</span><h2>名人名录</h2><p>从 {people.length} 位人物中交叉检索时代、领域与地点</p></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭名人名录"><X /></button>
        </header>
        <div className="directory-controls">
          <label className="search-field">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">搜索人物</span>
            <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="姓名、别名、身份、地点…" />
            {query && <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus() }} aria-label="清空搜索"><X size={15} /></button>}
          </label>
          <label><span>时期</span><select value={period} onChange={(event) => setPeriod(event.target.value as PeriodId | 'all')}><option value="all">全部时期</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.dateRange}</option>)}</select></label>
          <label><span>领域</span><select value={category} onChange={(event) => setCategory(event.target.value as CategoryId | 'all')}><option value="all">全部领域</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        </div>
        <div className="result-summary" role="status">找到 <strong>{results.length}</strong> 位人物{query ? ` · “${query}”` : ''}</div>
        <div className="directory-results">
          {results.map((person) => {
            const personPeriod = periodById.get(person.periodId)!
            return (
              <button type="button" className="directory-card" key={person.id} onClick={() => onSelect(person)}>
                <span className="directory-initial" style={{ '--card-accent': personPeriod.accent } as React.CSSProperties}>{person.name.slice(0, 1)}</span>
                <span className="directory-copy"><strong>{person.name}</strong><small>{personPeriod.label} · {person.lifespan}</small><em>{person.roles.join(' · ')}</em></span>
                <span className="directory-category">{categoryLabel[person.categories[0]]}</span>
              </button>
            )
          })}
          {results.length === 0 && <div className="empty-state"><Search /><h3>没有找到匹配人物</h3><p>试试姓名、别名、身份或地点，也可以清除一个筛选条件。</p><button type="button" onClick={() => { setQuery(''); setPeriod('all'); setCategory('all') }}>清除全部筛选</button></div>}
        </div>
      </FocusTrap>
    </div>
  )
}
