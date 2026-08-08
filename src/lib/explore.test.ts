import { describe, expect, it } from 'vitest'
import { people } from '../data/people'
import { formatYear, peopleForPeriod, relatedPeople, searchPeople } from './explore'

describe('exploration helpers', () => {
  it('searches aliases, roles, periods and places', () => {
    expect(searchPeople(people, '诗仙').map((person) => person.id)).toContain('li-bai')
    expect(searchPeople(people, '天文学家').map((person) => person.id)).toEqual(expect.arrayContaining(['zhang-heng', 'zu-chongzhi', 'guo-shoujing']))
    expect(searchPeople(people, '黄州').map((person) => person.id)).toEqual(['su-shi'])
    expect(searchPeople(people, '辽金西夏').length).toBeGreaterThanOrEqual(4)
    expect(searchPeople(people, '唐伯虎').map((person) => person.id)).toEqual(['tang-yin'])
    expect(searchPeople(people, '革命家').map((person) => person.id)).toContain('sun-yat-sen')
  })

  it('keeps the expanded corpus broad across every period', () => {
    expect(people).toHaveLength(178)
    expect(new Set(people.map((person) => person.periodId)).size).toBe(14)
    expect(peopleForPeriod(people, 'tang', 'all')).toHaveLength(18)
    expect(peopleForPeriod(people, 'qing', 'all')).toHaveLength(21)
  })

  it('combines period and category filters without leaking results', () => {
    const tangWriters = peopleForPeriod(people, 'tang', 'literature')
    expect(tangWriters.length).toBeGreaterThanOrEqual(3)
    expect(tangWriters.every((person) => person.periodId === 'tang' && person.categories.includes('literature'))).toBe(true)
  })

  it('prioritizes explicit relationships and labels contextual links honestly', () => {
    const liBai = people.find((person) => person.id === 'li-bai')!
    const related = relatedPeople(liBai, people)
    expect(related[0]).toMatchObject({ person: { id: 'du-fu' }, label: '诗友', explicit: true })
    expect(related.slice(1).every((entry) => !entry.explicit && /同一时期|同领域/.test(entry.label))).toBe(true)
  })

  it('formats BCE and unknown years', () => {
    expect(formatYear(-221)).toBe('前221')
    expect(formatYear(960)).toBe('960')
    expect(formatYear(null)).toBe('不详')
  })
})
