import type { Person, RelationKind } from '../types'

export interface Connection {
  person: Person
  kind: RelationKind
  label: string
  story?: string
  /** 本人档案中声明的关系为 true；仅由对方档案声明的为 false。 */
  declared: boolean
}

export interface Bond {
  key: string
  sourceId: string
  targetId: string
  kind: RelationKind
  label: string
  story?: string
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

export interface BondIndex {
  bonds: Bond[]
  connectionsFor: (personId: string) => Connection[]
  bondBetween: (a: string, b: string) => Bond | undefined
}

// Relations are declared one-way in the records; the index makes every tie visible from both ends.
export function buildBondIndex(entries: Person[]): BondIndex {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const bonds = new Map<string, Bond>()
  const connections = new Map<string, Connection[]>()

  const add = (ownerId: string, connection: Connection) => {
    const list = connections.get(ownerId) ?? []
    const existing = list.findIndex((item) => item.person.id === connection.person.id)
    if (existing === -1) list.push(connection)
    else if (!list[existing].story && connection.story) list[existing] = { ...list[existing], story: connection.story }
    connections.set(ownerId, list)
  }

  for (const source of entries) {
    for (const relation of source.relations) {
      const target = byId.get(relation.targetId)
      if (!target) continue
      const key = pairKey(source.id, target.id)
      const bond = bonds.get(key)
      if (!bond) bonds.set(key, { key, sourceId: source.id, targetId: target.id, kind: relation.kind, label: relation.label, story: relation.story })
      else if (!bond.story && relation.story) bonds.set(key, { ...bond, story: relation.story })
    }
  }

  // Own declarations first so their labels win, then incoming ties described from the other side.
  for (const source of entries) {
    for (const relation of source.relations) {
      const target = byId.get(relation.targetId)
      if (target) add(source.id, { person: target, kind: relation.kind, label: relation.label, story: relation.story, declared: true })
    }
  }
  for (const source of entries) {
    for (const relation of source.relations) {
      const target = byId.get(relation.targetId)
      if (target) add(target.id, { person: source, kind: relation.kind, label: relation.label, story: relation.story, declared: false })
    }
  }

  return {
    bonds: Array.from(bonds.values()),
    connectionsFor: (personId) => connections.get(personId) ?? [],
    bondBetween: (a, b) => bonds.get(pairKey(a, b)),
  }
}

const indexCache = new WeakMap<Person[], BondIndex>()

export function bondIndexFor(entries: Person[]) {
  let index = indexCache.get(entries)
  if (!index) {
    index = buildBondIndex(entries)
    indexCache.set(entries, index)
  }
  return index
}
