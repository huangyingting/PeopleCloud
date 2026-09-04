import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readSavedPeople, SAVED_PEOPLE_KEY, writeSavedPeople } from './savedPeople'

describe('saved people storage', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('starts empty without writing to storage', () => {
    expect(readSavedPeople()).toEqual({ ids: [], error: null })
    expect(window.localStorage.getItem(SAVED_PEOPLE_KEY)).toBeNull()
  })

  it('persists only known, unique corpus ids and restores them', () => {
    expect(writeSavedPeople(['li-bai', 'confucius', 'li-bai', 'not-a-person'])).toEqual({ ids: ['li-bai', 'confucius'], error: null })
    expect(window.localStorage.getItem(SAVED_PEOPLE_KEY)).toBe('["li-bai","confucius"]')
    expect(readSavedPeople()).toEqual({ ids: ['li-bai', 'confucius'], error: null })
    expect(writeSavedPeople([])).toEqual({ ids: [], error: null })
    expect(readSavedPeople().ids).toEqual([])
  })

  it('deduplicates valid stored ids without a warning', () => {
    window.localStorage.setItem(SAVED_PEOPLE_KEY, '["li-bai","li-bai","du-fu"]')
    expect(readSavedPeople()).toEqual({ ids: ['li-bai', 'du-fu'], error: null })
  })

  it('ignores stale ids and non-string values while reporting invalid records', () => {
    window.localStorage.setItem(SAVED_PEOPLE_KEY, JSON.stringify(['li-bai', 'unknown', null, 123, {}, '__proto__']))
    expect(readSavedPeople()).toEqual({ ids: ['li-bai'], error: expect.stringContaining('已忽略') })
  })

  it.each(['null', '{}', '"li-bai"', '42', '{bad json'])('reports malformed stored data: %s', (raw) => {
    window.localStorage.setItem(SAVED_PEOPLE_KEY, raw)
    expect(readSavedPeople()).toEqual({ ids: [], error: expect.stringContaining('无法解析') })
    expect(window.localStorage.getItem(SAVED_PEOPLE_KEY)).toBe(raw)
  })

  it('reports denied storage reads', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError') })
    expect(readSavedPeople()).toEqual({ ids: [], error: expect.stringContaining('无法读取收藏') })
  })

  it('handles a denied localStorage accessor for reads and writes', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError') })
    expect(readSavedPeople().error).toContain('无法读取收藏')
    expect(writeSavedPeople(['li-bai']).error).toContain('更改未保存')
  })

  it('reports failed writes without replacing a previously saved collection', () => {
    window.localStorage.setItem(SAVED_PEOPLE_KEY, '["du-fu"]')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    expect(writeSavedPeople(['li-bai']).error).toContain('更改未保存')
    expect(readSavedPeople().ids).toEqual(['du-fu'])
  })
})
