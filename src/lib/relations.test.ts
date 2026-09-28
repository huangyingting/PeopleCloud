import { describe, expect, it } from 'vitest'
import { encounters, encountersFor } from '../data/encounters'
import { people, personById } from '../data/people'
import { buildBondIndex, bondIndexFor } from './relations'

describe('relationship index', () => {
  const index = bondIndexFor(people)

  it('makes one-way declarations visible from both ends', () => {
    const duFu = index.connectionsFor('du-fu')
    expect(duFu.find((connection) => connection.person.id === 'li-bai')).toBeTruthy()
    const incoming = index.connectionsFor('li-bai').find((connection) => connection.person.id === 'meng-haoran')
    expect(incoming).toBeTruthy()
  })

  it('prefers a person’s own label and borrows the other side’s story', () => {
    const [a, b] = [personById.get('li-bai')!, personById.get('du-fu')!]
    const local = buildBondIndex([
      { ...a, relations: [{ targetId: 'du-fu', kind: 'friend', label: '诗友' }] },
      { ...b, relations: [{ targetId: 'li-bai', kind: 'friend', label: '所怀之人', story: '744年洛阳相遇' }] },
    ])
    expect(local.connectionsFor('li-bai')).toEqual([expect.objectContaining({ label: '诗友', story: '744年洛阳相遇', declared: true })])
    expect(local.connectionsFor('du-fu')).toEqual([expect.objectContaining({ label: '所怀之人', declared: true })])
    expect(local.bonds).toHaveLength(1)
  })

  it('dedupes pairs and never links a person to themself', () => {
    const keys = index.bonds.map((bond) => bond.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(index.bonds.every((bond) => bond.sourceId !== bond.targetId)).toBe(true)
    expect(index.bondBetween('du-fu', 'li-bai')?.story).toMatch(/744/)
  })

  it('attaches historical scenes to every participant', () => {
    expect(encounters.length).toBeGreaterThanOrEqual(60)
    expect(encountersFor('li-bai').map((entry) => entry.id)).toEqual(expect.arrayContaining(['li-du-meet', 'gold-turtle']))
    const years = encounters.map((entry) => entry.year)
    expect(years).toEqual([...years].sort((x, y) => x - y))
  })
})
