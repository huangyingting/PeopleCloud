import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight, Compass, HelpCircle, LibraryBig, Map, Maximize2, Minimize2, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { categories, categoryLabel } from './data/categories'
import type { Journey } from './data/journeys'
import { people, personById } from './data/people'
import { periodById, periods } from './data/periods'
import { peopleForPeriod } from './lib/explore'
import { readSavedPeople, SAVED_PEOPLE_KEY, writeSavedPeople } from './lib/savedPeople'
import type { CategoryId, Person, PeriodId } from './types'
import { Directory } from './components/Directory'
import { CompareDialog } from './components/CompareDialog'
import { FocusTrap } from './components/FocusTrap'
import { JourneysDialog } from './components/JourneysDialog'
import { ExploreDrawer } from './components/ExploreDrawer'
import { PersonPanel } from './components/PersonPanel'
import './features.css'

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
  const requestedCategory = categoryParam && categories.some((item) => item.id === categoryParam) ? categoryParam : 'all'
  const requestedPeople = peopleForPeriod(people, periodId, requestedCategory)
  const category = requestedPeople.length ? requestedCategory : 'all'
  const available = requestedPeople.length ? requestedPeople : peopleForPeriod(people, periodId, 'all')
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

function Intro({ onEnter }: { onEnter: (person?: Person) => void }) {
  const categoryCount = new Set(people.flatMap((person) => person.categories)).size
  const featuredPerson = personById.get('li-bai')!
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
        <button className="enter-button" type="button" onClick={() => onEnter()}><span>进入星图</span><ChevronRight /><i aria-hidden="true" /></button>
        <div className="hero-stats" aria-label="语料统计">
          <div><strong>{people.length}</strong><span>位人物</span></div>
          <div><strong>{periods.length}</strong><span>个时期</span></div>
          <div><strong>{categoryCount}</strong><span>个领域</span></div>
        </div>
      </section>
      <aside className="hero-card">
        <span>星图一隅 · 唐</span>
        <div className="hero-card-orbit"><i /><b>李</b></div>
        <h2>李白</h2><p>诗人 · 701—762</p>
        <blockquote>“大鹏一日同风起，扶摇直上九万里。”</blockquote>
        <small>坐标：江油 · 成长与活动地</small>
        <button className="hero-card-action" type="button" onClick={() => onEnter(featuredPerson)} aria-label="从李白开始探索">从此人开始 <ChevronRight size={13} /></button>
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
  const [compareOpen, setCompareOpen] = useState(false)
  const [journeysOpen, setJourneysOpen] = useState(false)
  const [activeJourney, setActiveJourney] = useState<{ journey: Journey; stopIndex: number } | null>(null)
  const [savedPeople, setSavedPeople] = useState(readSavedPeople)
  const [saveFeedback, setSaveFeedback] = useState('')
  const [panelOpen, setPanelOpen] = useState(true)
  const [exploreOpen, setExploreOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [visited, setVisited] = useState<Person[]>(initial.entered ? [initial.person] : [])
  const directoryButtonRef = useRef<HTMLButtonElement>(null)
  const aboutButtonRef = useRef<HTMLButtonElement>(null)
  const compareButtonRef = useRef<HTMLButtonElement>(null)
  const journeysButtonRef = useRef<HTMLButtonElement>(null)
  const journeyContentsRef = useRef<HTMLButtonElement>(null)
  const journeyReturnFocusRef = useRef<HTMLButtonElement>(null)
  const exploreButtonRef = useRef<HTMLButtonElement>(null)
  const focusButtonRef = useRef<HTMLButtonElement>(null)
  const reopenButtonRef = useRef<HTMLButtonElement>(null)
  const period = periodById.get(periodId)!
  const visiblePeople = useMemo(() => peopleForPeriod(people, periodId, category), [periodId, category])

  const rememberPerson = useCallback((person: Person) => {
    setVisited((current) => [...current.filter((entry) => entry.id !== person.id), person].slice(-6))
  }, [])

  const showPerson = useCallback((person: Person, nextCategory: CategoryId | 'all') => {
    setSaveFeedback('')
    setPeriodId(person.periodId)
    setCategory(nextCategory)
    setSelected(person)
    rememberPerson(person)
    setPanelOpen(true)
    setDirectoryOpen(false)
    writeUrl(person, nextCategory)
  }, [rememberPerson])

  const selectPerson = useCallback((person: Person) => {
    setActiveJourney((current) => {
      if (!current) return null
      const stopIndex = current.journey.stops.findIndex((stop) => stop.personId === person.id)
      return stopIndex < 0 ? null : { ...current, stopIndex }
    })
    const nextCategory = category === 'all' || person.categories.includes(category) ? category : 'all'
    showPerson(person, nextCategory)
  }, [category, showPerson])

  const startJourney = useCallback((journey: Journey, stopIndex: number) => {
    const stop = journey.stops[stopIndex]
    if (!stop) return
    const person = personById.get(stop.personId)
    if (!person) return
    showPerson(person, 'all')
    setActiveJourney({ journey, stopIndex })
    setJourneysOpen(false)
  }, [showPerson])

  const navigateJourney = (direction: -1 | 1) => {
    if (activeJourney) startJourney(activeJourney.journey, activeJourney.stopIndex + direction)
  }

  const closeDirectory = useCallback(() => setDirectoryOpen(false), [])
  const closeAbout = useCallback(() => setAboutOpen(false), [])
  const closeCompare = useCallback(() => setCompareOpen(false), [])
  const closeJourneys = useCallback(() => setJourneysOpen(false), [])
  const closeExplore = useCallback(() => {
    setExploreOpen(false)
    exploreButtonRef.current?.focus()
  }, [])

  const toggleSaved = (person: Person) => {
    const wasSaved = savedPeople.ids.includes(person.id)
    const ids = wasSaved ? savedPeople.ids.filter((id) => id !== person.id) : [...savedPeople.ids, person.id]
    const result = writeSavedPeople(ids)
    setSavedPeople(result.error ? { ...savedPeople, error: result.error } : result)
    setSaveFeedback(result.error ? '' : `${wasSaved ? '已取消收藏' : '已收藏'}${person.name}。`)
  }

  useEffect(() => {
    const syncSaved = (event: StorageEvent) => {
      if (event.key !== SAVED_PEOPLE_KEY && event.key !== null) return
      const restored = readSavedPeople()
      setSavedPeople(restored)
      setSaveFeedback(restored.error ? '' : '收藏已与此浏览器同步。')
    }
    window.addEventListener('storage', syncSaved)
    return () => window.removeEventListener('storage', syncSaved)
  }, [])

  const selectPeriod = useCallback((nextPeriod: PeriodId) => {
    setActiveJourney(null)
    setSaveFeedback('')
    const sameCategory = peopleForPeriod(people, nextPeriod, category)
    const nextCategory = sameCategory.length ? category : 'all'
    const candidates = peopleForPeriod(people, nextPeriod, nextCategory)
    setPeriodId(nextPeriod)
    setCategory(nextCategory)
    const nextPerson = candidates.find((person) => person.featured) ?? candidates[0]
    setSelected(nextPerson)
    rememberPerson(nextPerson)
    setPanelOpen(true)
    writeUrl(nextPerson, nextCategory)
  }, [category, rememberPerson])

  const selectCategory = (nextCategory: CategoryId | 'all') => {
    const candidates = peopleForPeriod(people, periodId, nextCategory)
    if (!candidates.length) return
    setActiveJourney(null)
    setSaveFeedback('')
    setCategory(nextCategory)
    const nextPerson = candidates.some((person) => person.id === selected.id) ? selected : candidates.find((person) => person.featured) ?? candidates[0]
    setSelected(nextPerson)
    rememberPerson(nextPerson)
    setPanelOpen(true)
    writeUrl(nextPerson, nextCategory)
  }

  useEffect(() => {
    const restore = () => {
      const state = readUrlState()
      setActiveJourney(null)
      setDirectoryOpen(false)
      setAboutOpen(false)
      setCompareOpen(false)
      setJourneysOpen(false)
      setSaveFeedback('')
      setEntered(state.entered)
      setPeriodId(state.periodId)
      setSelected(state.person)
      rememberPerson(state.person)
      setCategory(state.category)
      setPanelOpen(true)
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [rememberPerson])

  const navigateVisible = useCallback((direction: -1 | 1) => {
    const index = visiblePeople.findIndex((person) => person.id === selected.id)
    const nextIndex = (Math.max(index, 0) + direction + visiblePeople.length) % visiblePeople.length
    const nextPerson = visiblePeople[nextIndex]
    if (nextPerson) selectPerson(nextPerson)
  }, [selectPerson, selected.id, visiblePeople])

  const surpriseMe = useCallback(() => {
    if (visiblePeople.length < 2) return
    const currentIndex = visiblePeople.findIndex((person) => person.id === selected.id)
    const jump = 1 + Math.floor(Math.random() * (visiblePeople.length - 1))
    selectPerson(visiblePeople[(Math.max(currentIndex, 0) + jump) % visiblePeople.length])
  }, [selectPerson, selected.id, visiblePeople])

  const enterExperience = useCallback((person?: Person) => {
    const nextPerson = person ?? selected
    if (person) {
      setPeriodId(person.periodId)
      setCategory('all')
      setSelected(person)
    }
    rememberPerson(nextPerson)
    setEntered(true)
    writeUrl(nextPerson, person ? 'all' : category, 'replace')
  }, [category, rememberPerson, selected])

  const modalOpen = directoryOpen || aboutOpen || compareOpen || journeysOpen
  const panelVisible = panelOpen && !focusMode

  useEffect(() => {
    if (!entered || modalOpen) return
    const openDirectory = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault()
        setDirectoryOpen(true)
      }
      if (event.key === 'Escape') {
        if (exploreOpen && !focusMode) closeExplore()
        else if (focusMode) {
          setFocusMode(false)
          focusButtonRef.current?.focus()
        }
      }
    }
    window.addEventListener('keydown', openDirectory)
    return () => window.removeEventListener('keydown', openDirectory)
  }, [entered, modalOpen, exploreOpen, focusMode, closeExplore])

  if (!entered) return <Intro onEnter={enterExperience} />

  return (
    <main className={`app-shell map-first${focusMode ? ' focus-mode' : ''}`} id="main-content" style={{ '--active-accent': period.accent } as React.CSSProperties}>
      <header className="topbar" inert={modalOpen ? true : undefined} aria-hidden={modalOpen ? true : undefined}>
        <button className="brand brand-button" type="button" onClick={() => { setActiveJourney(null); setFocusMode(false); setExploreOpen(false); setEntered(false) }} aria-label="返回人间星图首页">
          <span className="brand-seal">人</span><span><strong>人间星图</strong><small>PEOPLE CLOUD</small></span>
        </button>
        <button ref={exploreButtonRef} className="explore-trigger action-button" type="button" aria-label={exploreOpen && !focusMode ? '收起时代与领域' : '展开时代与领域'} aria-expanded={exploreOpen && !focusMode} aria-controls="explore-controls" onClick={() => setExploreOpen((current) => !current)}>
          <SlidersHorizontal size={15} /><span>{period.label}<small>{category === 'all' ? `${visiblePeople.length} 人` : categoryLabel[category]}</small></span><ChevronDown size={13} />
        </button>
        {focusMode && <span className="focus-context">{period.label} · {selected.name}</span>}
        <div className="top-actions">
          <button ref={journeysButtonRef} className="action-button journeys-trigger" type="button" onClick={() => { journeyReturnFocusRef.current = journeysButtonRef.current; setJourneysOpen(true) }} aria-label="打开主题漫游"><Compass size={17} /><span>主题漫游</span></button>
          <button className="search-action" type="button" onClick={() => setDirectoryOpen(true)}><Search size={16} /><span>搜索人物、地点…</span><kbd>⌘ K</kbd></button>
          <button ref={directoryButtonRef} className="action-button" type="button" aria-label="打开名人名录" onClick={() => setDirectoryOpen(true)}><LibraryBig size={17} /><span>名录</span></button>
          <button ref={aboutButtonRef} className="icon-button" type="button" onClick={() => setAboutOpen(true)} aria-label="查看使用与数据说明"><HelpCircle size={19} /></button>
          <button ref={focusButtonRef} className="action-button focus-mode-toggle" type="button" aria-label={focusMode ? '退出专注地图' : '专注地图'} aria-pressed={focusMode} onClick={() => setFocusMode((current) => !current)} title={focusMode ? '恢复工作台 · Esc' : '收起面板，留出完整地图'}>
            {focusMode ? <Minimize2 size={17} /> : <Maximize2 size={17} />}<span>{focusMode ? '退出专注' : '专注地图'}</span>
          </button>
        </div>
      </header>

      <section className={`workspace${panelVisible ? ' panel-visible' : ''}`} inert={modalOpen ? true : undefined} aria-hidden={modalOpen ? true : undefined}>
        <Suspense fallback={<div className="map-suspense"><span /><p>星图组件载入中…</p></div>}>
          <HistoryMap people={visiblePeople} selected={selected} onSelect={selectPerson} onInspect={() => { if (!focusMode) { setPanelOpen(false); setExploreOpen(false) } }} minimal={focusMode} />
        </Suspense>
        <ExploreDrawer open={exploreOpen && !focusMode} periodId={periodId} category={category} onPeriodChange={selectPeriod} onCategoryChange={selectCategory} onClose={closeExplore} />
        {!panelVisible && <button ref={reopenButtonRef} className="reopen-panel" type="button" aria-expanded="false" aria-controls="person-details" onClick={() => { setFocusMode(false); setPanelOpen(true) }}><span>{selected.name}</span><small>打开人物卷轴</small><ChevronRight /></button>}
        <div id="person-details" hidden={focusMode}>
          {panelOpen && <PersonPanel
            person={selected}
            people={people}
            visiblePeople={visiblePeople}
            visited={visited}
            saved={savedPeople.ids.includes(selected.id)}
            savedError={savedPeople.error}
            saveFeedback={saveFeedback}
            onToggleSaved={() => toggleSaved(selected)}
            activeJourney={activeJourney}
            onNavigateJourney={navigateJourney}
            onEndJourney={() => setActiveJourney(null)}
            onOpenJourneys={() => { journeyReturnFocusRef.current = journeyContentsRef.current; setJourneysOpen(true) }}
            journeyContentsRef={journeyContentsRef}
            onSelect={selectPerson}
            onNavigate={navigateVisible}
            onSurprise={surpriseMe}
            onOpenCompare={() => setCompareOpen(true)}
            compareButtonRef={compareButtonRef}
            onClose={() => { setPanelOpen(false); window.requestAnimationFrame(() => reopenButtonRef.current?.focus()) }}
          />}
        </div>
      </section>

      {directoryOpen && <Directory savedIds={savedPeople.ids} savedError={savedPeople.error} onToggleSaved={toggleSaved} onClose={closeDirectory} onSelect={selectPerson} returnFocusRef={focusMode ? focusButtonRef : directoryButtonRef} />}
      {journeysOpen && <JourneysDialog initialJourneyId={activeJourney?.journey.id} onStart={startJourney} onClose={closeJourneys} returnFocusRef={journeyReturnFocusRef} />}
      {aboutOpen && <AboutDialog onClose={closeAbout} returnFocusRef={aboutButtonRef} />}
      {compareOpen && <CompareDialog person={selected} people={people} onSelect={selectPerson} onClose={closeCompare} returnFocusRef={compareButtonRef} />}
    </main>
  )
}
