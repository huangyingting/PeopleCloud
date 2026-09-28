import { categoryLabel } from '../data/categories'
import { periodById } from '../data/periods'
import type { CategoryId, Person, PlaceRelation, RelationKind } from '../types'
import { bondIndexFor } from './relations'

const relationLabels: Record<PlaceRelation, string> = {
  birthplace: '出生地',
  ancestral_home: '籍贯 / 郡望',
  active: '主要活动地',
  office: '主要任职地',
  capital: '都城关联',
  memorial: '纪念地',
}

export const placeRelationLabel = (relation: PlaceRelation) => relationLabels[relation]

export const confidenceLabel = {
  high: '较高可信度',
  medium: '中等可信度',
  disputed: '存在争议',
} as const

export function searchPeople(entries: Person[], query: string, category: CategoryId | 'all' = 'all') {
  const normalized = query.trim().toLocaleLowerCase('zh-CN')
  return entries.filter((person) => {
    if (category !== 'all' && !person.categories.includes(category)) return false
    if (!normalized) return true
    const period = periodById.get(person.periodId)
    const haystack = [
      person.name,
      person.courtesy,
      ...person.aliases,
      ...person.roles,
      ...person.categories.map((item) => categoryLabel[item]),
      person.summary,
      person.place.name,
      period?.label,
    ].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN')
    return haystack.includes(normalized)
  })
}

export function peopleForPeriod(entries: Person[], periodId: Person['periodId'], category: CategoryId | 'all') {
  return entries.filter((person) => person.periodId === periodId && (category === 'all' || person.categories.includes(category)))
}

export interface RelatedEntry {
  person: Person
  label: string
  explicit: boolean
  kind?: RelationKind
  story?: string
}

export function relatedPeople(person: Person, entries: Person[], limit = 4): RelatedEntry[] {
  const explicit: RelatedEntry[] = bondIndexFor(entries)
    .connectionsFor(person.id)
    .map((connection) => ({ person: connection.person, label: connection.label, explicit: true, kind: connection.kind, story: connection.story }))

  const explicitIds = new Set(explicit.map((entry) => entry.person.id))
  const contextual = entries
    .filter((candidate) => candidate.id !== person.id && !explicitIds.has(candidate.id))
    .map((candidate) => {
      const shared = candidate.categories.filter((category) => person.categories.includes(category))
      const samePeriod = candidate.periodId === person.periodId
      const score = shared.length * 3 + (samePeriod ? 2 : 0) + (candidate.featured ? 0.25 : 0)
      const sharedLabel = shared[0] ? categoryLabel[shared[0]] : ''
      return {
        person: candidate,
        score,
        label: samePeriod && sharedLabel ? `同一时期 · ${sharedLabel}` : sharedLabel ? `同领域 · ${sharedLabel}` : '延伸阅读',
        explicit: false,
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name, 'zh-CN'))
    .map((entry): RelatedEntry => ({ person: entry.person, label: entry.label, explicit: false }))

  return [...explicit, ...contextual].slice(0, limit)
}

export function formatYear(year: number | null) {
  if (year === null) return '不详'
  return year < 0 ? `前${Math.abs(year)}` : String(year)
}
