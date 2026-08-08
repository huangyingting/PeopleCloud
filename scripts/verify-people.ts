import { categories } from '../src/data/categories'
import { people } from '../src/data/people'
import { periods } from '../src/data/periods'

const failures: string[] = []
const ids = new Set<string>()
const relationIds = new Set(people.map((person) => person.id))
const validPeriodIds = new Set(periods.map((period) => period.id))
const validCategories = new Set(categories.map((category) => category.id))
const minimumPeriodCoverage = {
  'pre-qin': 12,
  qin: 8,
  han: 14,
  'three-kingdoms': 12,
  jin: 10,
  'southern-northern': 11,
  sui: 8,
  tang: 18,
  'five-dynasties': 8,
  song: 18,
  'liao-jin-xixia': 8,
  yuan: 12,
  ming: 18,
  qing: 20,
} as const

const fail = (message: string) => failures.push(message)

if (people.length < 175) fail(`expanded corpus regressed to ${people.length} people; expected at least 175`)

for (const person of people) {
  if (!/^[a-z0-9-]+$/.test(person.id)) fail(`${person.name}: id must be kebab-case ASCII`)
  if (ids.has(person.id)) fail(`${person.name}: duplicate id ${person.id}`)
  ids.add(person.id)
  if (!validPeriodIds.has(person.periodId)) fail(`${person.name}: unknown period ${person.periodId}`)
  if (person.name.trim().length < 2) fail(`${person.id}: name is missing`)
  if (person.lifespan.trim().length < 3) fail(`${person.name}: lifespan is too vague`)
  if (person.bornYear !== null && person.diedYear !== null && person.bornYear > person.diedYear) fail(`${person.name}: born after death`)
  if (person.bornYear !== null && (person.bornYear < -900 || person.bornYear > 1912)) fail(`${person.name}: bornYear outside product scope`)
  if (person.diedYear !== null && (person.diedYear < -900 || person.diedYear > 1950)) fail(`${person.name}: diedYear outside validation range`)
  if (person.summary.length < 38 || person.summary.length > 125) fail(`${person.name}: summary must be 38-125 characters, got ${person.summary.length}`)
  if (person.roles.length === 0) fail(`${person.name}: no roles`)
  if (person.categories.length === 0 || person.categories.some((category) => !validCategories.has(category))) fail(`${person.name}: invalid categories`)
  if (person.achievements.length < 2 || person.achievements.some((entry) => entry.length < 6)) fail(`${person.name}: needs at least two concrete achievements`)
  if (!person.place.name || !person.place.note) fail(`${person.name}: incomplete place semantics`)
  if (person.place.longitude < 65 || person.place.longitude > 140 || person.place.latitude < 10 || person.place.latitude > 55) fail(`${person.name}: coordinate outside supported map bounds`)
  if (person.place.confidence === 'disputed' && !/争议|说法|无法确证|传说/.test(person.place.note)) fail(`${person.name}: disputed location needs visible uncertainty note`)
  if (person.sources.length === 0) fail(`${person.name}: needs a source`)
  for (const source of person.sources) {
    if (!source.title || !source.url.startsWith('https://')) fail(`${person.name}: invalid HTTPS source`)
    try { new URL(source.url) } catch { fail(`${person.name}: malformed source URL`) }
  }
  for (const relation of person.relations) {
    if (!relationIds.has(relation.targetId)) fail(`${person.name}: missing relation target ${relation.targetId}`)
    if (relation.targetId === person.id) fail(`${person.name}: self relation is not allowed`)
    if (relation.label.length < 2) fail(`${person.name}: relation label is too vague`)
  }
}

for (const period of periods) {
  const entries = people.filter((person) => person.periodId === period.id)
  const minimum = minimumPeriodCoverage[period.id]
  if (entries.length < minimum) fail(`${period.label}: only ${entries.length} people, expanded minimum is ${minimum}`)
  if (new Set(entries.flatMap((person) => person.categories)).size < 2) fail(`${period.label}: needs at least two represented fields`)
}

for (const category of categories) {
  const count = people.filter((person) => person.categories.includes(category.id)).length
  if (count < 2) fail(`${category.label}: category is underrepresented (${count})`)
}

if (failures.length) {
  console.error(JSON.stringify({ status: 'failed', people: people.length, periods: periods.length, failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'passed',
  people: people.length,
  periods: periods.length,
  categories: categories.length,
  sourcedPeople: people.filter((person) => person.sources.length > 0).length,
  disputedPlaces: people.filter((person) => person.place.confidence === 'disputed').length,
  periodCoverage: Object.fromEntries(periods.map((period) => [period.label, people.filter((person) => person.periodId === period.id).length])),
  categoryCoverage: Object.fromEntries(categories.map((category) => [category.label, people.filter((person) => person.categories.includes(category.id)).length])),
}, null, 2))
