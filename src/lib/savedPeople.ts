import { personById } from '../data/people'

export const SAVED_PEOPLE_KEY = 'peoplecloud:saved-people:v1'

export interface SavedPeopleState {
  ids: string[]
  error: string | null
}

function validIds(values: unknown[]): string[] {
  return [...new Set(values.filter((id): id is string => typeof id === 'string' && personById.has(id)))]
}

export function readSavedPeople(): SavedPeopleState {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(SAVED_PEOPLE_KEY)
  } catch {
    return { ids: [], error: '无法读取收藏，请检查浏览器的本地存储权限。' }
  }
  if (raw === null) return { ids: [], error: null }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('Invalid saved people')
    const ids = validIds(parsed)
    const hasInvalidIds = parsed.some((id) => typeof id !== 'string' || !personById.has(id))
    return { ids, error: hasInvalidIds ? '部分收藏记录已失效，已忽略无法识别的人物。' : null }
  } catch {
    return { ids: [], error: '收藏记录无法解析，暂未载入；重新收藏可建立新的记录。' }
  }
}

export function writeSavedPeople(ids: readonly string[]): SavedPeopleState {
  const validated = validIds([...ids])
  try {
    window.localStorage.setItem(SAVED_PEOPLE_KEY, JSON.stringify(validated))
    return { ids: validated, error: null }
  } catch {
    return { ids: validated, error: '收藏更改未保存，请检查浏览器存储权限或可用空间后重试。' }
  }
}
