import { bondStories, extraBonds } from '../src/data/bonds'
import { categories } from '../src/data/categories'
import { encounters } from '../src/data/encounters'
import { people } from '../src/data/people'
import { periods } from '../src/data/periods'

const failures: string[] = []
const ids = new Set<string>()
const relationIds = new Set(people.map((person) => person.id))
const validPeriodIds = new Set(periods.map((period) => period.id))
const validCategories = new Set(categories.map((category) => category.id))
const minimumPeriodCoverage = {
  'pre-qin': 44,
  qin: 20,
  han: 43,
  'three-kingdoms': 35,
  jin: 36,
  'southern-northern': 34,
  sui: 22,
  tang: 70,
  'five-dynasties': 27,
  song: 61,
  'liao-jin-xixia': 27,
  yuan: 34,
  ming: 52,
  qing: 67,
} as const

const fail = (message: string) => failures.push(message)

if (people.length < 572) fail(`expanded corpus regressed to ${people.length} people; expected at least 572`)

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
    if (relation.story !== undefined && (relation.story.length < 12 || relation.story.length > 90)) fail(`${person.name}→${relation.targetId}: relation story must be 12-90 characters, got ${relation.story.length}`)
  }
  const targets = person.relations.map((relation) => relation.targetId)
  if (new Set(targets).size !== targets.length) fail(`${person.name}: duplicate relation target`)
}

const declaredRelations = new Set(people.flatMap((person) => person.relations.map((relation) => `${person.id}>${relation.targetId}`)))
for (const key of Object.keys(bondStories)) {
  if (!declaredRelations.has(key)) fail(`bond story ${key} does not match a declared relation`)
}
for (const bond of extraBonds) {
  if (!relationIds.has(bond.fromId)) fail(`extra bond source ${bond.fromId} is missing`)
}

const encounterIds = new Set<string>()
for (const encounter of encounters) {
  if (!/^[a-z0-9-]+$/.test(encounter.id) || encounterIds.has(encounter.id)) fail(`encounter ${encounter.id}: id must be unique kebab-case`)
  encounterIds.add(encounter.id)
  if (!validPeriodIds.has(encounter.periodId)) fail(`encounter ${encounter.id}: unknown period`)
  if (encounter.participants.length < 2) fail(`encounter ${encounter.id}: needs at least two participants`)
  for (const participant of encounter.participants) {
    if (!relationIds.has(participant.personId)) fail(`encounter ${encounter.id}: missing participant ${participant.personId}`)
    if (participant.role.length < 1) fail(`encounter ${encounter.id}: participant role missing`)
  }
  if (new Set(encounter.participants.map((participant) => participant.personId)).size !== encounter.participants.length) fail(`encounter ${encounter.id}: duplicate participant`)
  if (encounter.narrative.length < 40 || encounter.narrative.length > 130) fail(`encounter ${encounter.id}: narrative must be 40-130 characters, got ${encounter.narrative.length}`)
  if (encounter.confidence === 'disputed' && !/争议|说法|存疑|传说|相传|附会|虚构/.test(encounter.narrative)) fail(`encounter ${encounter.id}: disputed scene needs visible uncertainty`)
  const { longitude, latitude } = encounter.place
  if (longitude < 65 || longitude > 140 || latitude < 10 || latitude > 55) fail(`encounter ${encounter.id}: coordinate outside supported map bounds`)
}
if (encounters.length < 60) fail(`only ${encounters.length} encounters; expected at least 60`)

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
  encounters: encounters.length,
  bonds: new Set(people.flatMap((person) => person.relations.map((relation) => [person.id, relation.targetId].sort().join('|')))).size,
  disputedPlaces: people.filter((person) => person.place.confidence === 'disputed').length,
  periodCoverage: Object.fromEntries(periods.map((period) => [period.label, people.filter((person) => person.periodId === period.id).length])),
  categoryCoverage: Object.fromEntries(categories.map((category) => [category.label, people.filter((person) => person.categories.includes(category.id)).length])),
}, null, 2))
