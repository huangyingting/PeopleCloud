export type PeriodId =
  | 'pre-qin'
  | 'qin'
  | 'han'
  | 'three-kingdoms'
  | 'jin'
  | 'southern-northern'
  | 'sui'
  | 'tang'
  | 'five-dynasties'
  | 'song'
  | 'liao-jin-xixia'
  | 'yuan'
  | 'ming'
  | 'qing'

export type CategoryId =
  | 'thought'
  | 'politics'
  | 'military'
  | 'literature'
  | 'art'
  | 'science'
  | 'medicine'
  | 'exploration'

export type PlaceRelation =
  | 'birthplace'
  | 'ancestral_home'
  | 'active'
  | 'office'
  | 'capital'
  | 'memorial'

export type Confidence = 'high' | 'medium' | 'disputed'

export interface Period {
  id: PeriodId
  label: string
  shortLabel: string
  startYear: number
  endYear: number
  dateRange: string
  note: string
  accent: string
  center: [number, number]
  zoom: number
}

export interface PersonPlace {
  name: string
  longitude: number
  latitude: number
  relation: PlaceRelation
  confidence: Confidence
  note: string
}

export interface PersonSource {
  title: string
  url: string
}

export type RelationKind =
  | 'family'
  | 'mentor'
  | 'friend'
  | 'peer'
  | 'historical'
  | 'rival'
  | 'influence'

export interface PersonRelation {
  targetId: string
  kind: RelationKind
  label: string
  /** 一句可核对的互动叙述：两人在何时何地、因何事发生联系。 */
  story?: string
}

export interface EncounterParticipant {
  personId: string
  role: string
}

export interface Encounter {
  id: string
  title: string
  periodId: PeriodId
  year: number
  yearLabel: string
  place: { name: string; longitude: number; latitude: number }
  participants: EncounterParticipant[]
  narrative: string
  confidence: Confidence
  sourceName: string
}

export interface Person {
  id: string
  name: string
  courtesy?: string
  aliases: string[]
  periodId: PeriodId
  bornYear: number | null
  diedYear: number | null
  lifespan: string
  roles: string[]
  categories: CategoryId[]
  summary: string
  achievements: string[]
  place: PersonPlace
  sources: PersonSource[]
  relations: PersonRelation[]
  featured?: boolean
}
