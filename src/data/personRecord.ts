import type { Person, PersonPlace } from '../types'

export type PersonInput = Omit<Person, 'aliases' | 'relations' | 'sources'> & {
  aliases?: string[]
  relations?: Person['relations']
  sourceName?: string
}

const wiki = (name: string) => `https://zh.wikipedia.org/wiki/${encodeURIComponent(name)}`

export const person = ({ sourceName, aliases = [], relations = [], ...value }: PersonInput): Person => ({
  ...value,
  aliases,
  relations,
  sources: [{ title: `${sourceName ?? value.name}条目`, url: wiki(sourceName ?? value.name) }],
})

export const place = (
  name: string,
  longitude: number,
  latitude: number,
  relation: PersonPlace['relation'],
  note: string,
  confidence: PersonPlace['confidence'] = 'high',
): PersonPlace => ({ name, longitude, latitude, relation, confidence, note })
