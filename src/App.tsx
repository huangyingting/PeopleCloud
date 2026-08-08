import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronRight, HelpCircle, LibraryBig, Map, Search, Sparkles, X } from 'lucide-react'
import { categories, categoryLabel } from './data/categories'
import { people, personById } from './data/people'
import { periodById, periods } from './data/periods'
import { peopleForPeriod } from './lib/explore'
import type { CategoryId, Person, PeriodId } from './types'
import { Directory } from './components/Directory'
import { FocusTrap } from './components/FocusTrap'
import { PeriodTimeline } from './components/PeriodTimeline'
import { PersonPanel } from './components/PersonPanel'

const HistoryMap = lazy(() => import('./components/HistoryMap'))

interface InitialState {
  entered: boolean
  periodId: PeriodId
  person: Person
  category: CategoryId | 'all'
}

function readUrlState(): InitialState {
  const params = new URLSearchParams(window.location.search)
  const person = personById.get(params.get('person') ?? '')
  const periodParam = params.get('period') as PeriodId | null
  const periodId = person?.periodId ?? (periodParam && periodById.has(periodParam) ? periodParam : 'tang')
  const categoryParam = params.get('category') as CategoryId | null
  const category = categoryParam && categories.some((item) => item.id === categoryParam) ? categoryParam : 'all'
  const available = peopleForPeriod(people, periodId, category)
  const selected = person && person.periodId === periodId && (category === 'all' || person.categories.includes(category))
    ? person
    : available.find((entry) => entry.featured) ?? available[0] ?? people.find((entry) => entry.periodId === periodId)!
  return { entered: params.has('period') || params.has('person'), periodId, person: selected, category }
}

function writeUrl(person: Person, category: CategoryId | 'all', mode: 'push' | 'replace' = 'push') {
  const params = new URLSearchParams()
  params.set('period', person.periodId)
  params.set('person', person.id)
  if (category !== 'all') params.set('category', category)
  const nextUrl = `${window.location.pathname}?${params.toString()}`
  const currentUrl = `${window.location.pathname}${window.location.search}`
  if (nextUrl === currentUrl) return
  window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', nextUrl)
}

function Intro({ onEnter }: { onEnter: () => void }) {
  const categoryCount = new Set(people.flatMap((person) => person.categories)).size
  return (
    <main className="intro" id="main-content">
      <div className="intro-stars" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} style={{ '--star': index } as React.CSSProperties} />)}</div>
      <header className="intro-header">
        <div className="brand"><span className="brand-seal">人</span><span><strong>人间星图</strong><small>PEOPLE CLOUD</small></span></div>
        <a href="#method">如何阅读这张图</a>
      </header>
      <section className="hero">
        <div className="hero-eyebrow"><Sparkles size={14} /> 一部可以漫游的中国人物史</div>
        <h1>群星落人间，<br /><em>山河见其生。</em></h1>
        <p>从先秦诸子到晚清工程师，沿时间与地理坐标，遇见改变思想、文学、科技与政治的人。</p>
        <button className="enter-button" type="button" onClick={onEnter}><span>进入星图</span><ChevronRight /><i aria-hidden="true" /></button>
        <div className="hero-stats" aria-label="语料统计">
          <div><strong>{people.length}</strong><span>位人物</span></div>
          <div><strong>{periods.length}</strong><span>个时期</span></div>
          <div><strong>{categoryCount}</strong><span>个领域</span></div>
        </div>
      </section>
      <aside className="hero-card" aria-label="今日人物">
        <span>星图一隅 · 唐</span>
        <div className="hero-card-orbit"><i /><b>李</b></div>
        <h2>李白</h2><p>诗人 · 701—762</p>
        <blockquote>“大鹏一日同风起，扶摇直上九万里。”</blockquote>
        <small>坐标：江油 · 成长与活动地</small>
      </aside>
      <section id="method" className="intro-method">
        <span><Map size={19} /></span><div><strong>坐标是一种历史关系</strong><p>每个地点都标明出生、籍贯、活动、任职或纪念等关系；有争议时如实标注，不把文化锚点伪装成确定事实。</p></div>
      </section>
      <footer>策展型历史人物样本 · 内容并非穷尽所有名人 · 来源可追溯</footer>
    </main>
  )
}

function AboutDialog({ onClose, returnFocusRef }: { onClose: () => void; returnFocusRef: React.RefObject<HTMLButtonElement | null> }) {
  return (
    <div className="modal-backdrop">
      <FocusTrap className="about-dialog" label="关于人间星图" onClose={onClose} returnFocusRef={returnFocusRef}>
        <button className="icon-button dialog-close" type="button" onClick={onClose} aria-label="关闭说明"><X /></button>
        <span className="about-kicker">READING THE CONSTELLATION</span>
        <h2>如何阅读人间星图</h2>
        <p>这是一组跨时代、跨领域的策展型人物样本，而不是穷尽性名录。地图帮助你建立时间、地点和人物之间的直觉联系。</p>
        <div className="about-points">
          <article><span>01</span><div><h3>地点有不同含义</h3><p>出生地、籍贯、活动地、任职地和纪念地不会混为一谈。人物详情会解释为何选择此坐标。</p></div></article>
          <article><span>02</span><div><h3>星线不都代表史实关系</h3><p>明确的师友、君臣等关系会直接命名；“同一时期”与“同领域”只用于发现，不暗示两人相识。</p></div></article>
          <article><span>03</span><div><h3>争议不会被抹平</h3><p>人物生年、故里或身份无法确证时，以“约”“不详”“存在争议”表达，不制造精确答案。</p></div></article>
        </div>
        <p className="about-source"><BookOpen size={16} /> 每个人物均附有进一步阅读来源。完整口径见项目中的数据方法文档。</p>
      </FocusTrap>
    </div>
  )
}

export default function App() {
  const initial = useMemo(readUrlState, [])
  const [entered, setEntered] = useState(initial.entered)
  const [periodId, setPeriodId] = useState(initial.periodId)
  const [selected, setSelected] = useState(initial.person)
  const [category, setCategory] = useState<CategoryId | 'all'>(initial.category)
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const directoryButtonRef = useRef<HTMLButtonElement>(null)
  const aboutButtonRef = useRef<HTMLButtonElement>(null)
  const period = periodById.get(periodId)!
  const visiblePeople = useMemo(() => peopleForPeriod(people, periodId, category), [periodId, category])

  const selectPerson = useCallback((person: Person) => {
    const nextCategory = category === 'all' || person.categories.includes(category) ? category : 'all'
    setPeriodId(person.periodId)
    setCategory(nextCategory)
    setSelected(person)
    setPanelOpen(true)
    setDirectoryOpen(false)
    writeUrl(person, nextCategory)
  }, [category])

  const selectPeriod = useCallback((nextPeriod: PeriodId) => {
    const sameCategory = peopleForPeriod(people, nextPeriod, category)
    const nextCategory = sameCategory.length ? category : 'all'
    const candidates = peopleForPeriod(people, nextPeriod, nextCategory)
    setPeriodId(nextPeriod)
    setCategory(nextCategory)
    const nextPerson = candidates.find((person) => person.featured) ?? candidates[0]
    setSelected(nextPerson)
    setPanelOpen(true)
    writeUrl(nextPerson, nextCategory)
  }, [category])

  const selectCategory = (nextCategory: CategoryId | 'all') => {
    const candidates = peopleForPeriod(people, periodId, nextCategory)
    if (!candidates.length) return
    setCategory(nextCategory)
    const nextPerson = candidates.some((person) => person.id === selected.id) ? selected : candidates.find((person) => person.featured) ?? candidates[0]
    setSelected(nextPerson)
    setPanelOpen(true)
    writeUrl(nextPerson, nextCategory)
  }

  useEffect(() => {
    const restore = () => {
      const state = readUrlState()
      setEntered(state.entered)
      setPeriodId(state.periodId)
      setSelected(state.person)
      setCategory(state.category)
      setPanelOpen(true)
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])

  useEffect(() => {
    if (!entered) return
    const openDirectory = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault()
        setDirectoryOpen(true)
      }
    }
    window.addEventListener('keydown', openDirectory)
    return () => window.removeEventListener('keydown', openDirectory)
  }, [entered])

  if (!entered) return <Intro onEnter={() => { setEntered(true); writeUrl(selected, category, 'replace') }} />

  return (
    <main className="app-shell" id="main-content" style={{ '--active-accent': period.accent } as React.CSSProperties}>
      <header className="topbar" inert={directoryOpen || aboutOpen ? true : undefined} aria-hidden={directoryOpen || aboutOpen ? true : undefined}>
        <button className="brand brand-button" type="button" onClick={() => setEntered(false)} aria-label="返回人间星图首页">
          <span className="brand-seal">人</span><span><strong>人间星图</strong><small>PEOPLE CLOUD</small></span>
        </button>
        <div className="topbar-context"><span>{period.label}</span><strong>{period.note}</strong></div>
        <div className="top-actions">
          <button className="search-action" type="button" onClick={() => setDirectoryOpen(true)}><Search size={16} /><span>搜索人物、地点…</span><kbd>⌘ K</kbd></button>
          <button ref={directoryButtonRef} className="action-button" type="button" aria-label="打开名人名录" onClick={() => setDirectoryOpen(true)}><LibraryBig size={17} /><span>名录</span></button>
          <button ref={aboutButtonRef} className="icon-button" type="button" onClick={() => setAboutOpen(true)} aria-label="查看使用与数据说明"><HelpCircle size={19} /></button>
        </div>
      </header>

      <div inert={directoryOpen || aboutOpen ? true : undefined} aria-hidden={directoryOpen || aboutOpen ? true : undefined}>
        <PeriodTimeline value={periodId} onChange={selectPeriod} />
      </div>

      <section className="workspace" inert={directoryOpen || aboutOpen ? true : undefined} aria-hidden={directoryOpen || aboutOpen ? true : undefined}>
        <Suspense fallback={<div className="map-suspense"><span /><p>星图组件载入中…</p></div>}>
          <HistoryMap people={visiblePeople} selected={selected} onSelect={selectPerson} />
        </Suspense>
        <div className="category-filter" aria-label="人物领域筛选">
          <button type="button" className={category === 'all' ? 'active' : ''} aria-pressed={category === 'all'} onClick={() => selectCategory('all')}>全部 <span>{peopleForPeriod(people, periodId, 'all').length}</span></button>
          {categories.map(({ id, label, icon: Icon }) => {
            const count = peopleForPeriod(people, periodId, id).length
            return <button type="button" key={id} disabled={!count} className={category === id ? 'active' : ''} aria-pressed={category === id} onClick={() => selectCategory(id)} title={!count ? `${period.label}暂无${label}人物` : undefined}><Icon size={14} />{label}<span>{count}</span></button>
          })}
        </div>
        <div className="map-result-count" aria-live="polite">{category === 'all' ? period.label : categoryLabel[category]} · {visiblePeople.length} 位人物</div>
        {!panelOpen && <button className="reopen-panel" type="button" onClick={() => setPanelOpen(true)}><span>{selected.name}</span><small>打开人物卷轴</small><ChevronRight /></button>}
        {panelOpen && <PersonPanel person={selected} people={people} onSelect={selectPerson} onClose={() => setPanelOpen(false)} />}
      </section>

      {directoryOpen && <Directory onClose={() => setDirectoryOpen(false)} onSelect={selectPerson} returnFocusRef={directoryButtonRef} />}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} returnFocusRef={aboutButtonRef} />}
    </main>
  )
}
