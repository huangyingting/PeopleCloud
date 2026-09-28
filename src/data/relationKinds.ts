import type { RelationKind } from '../types'

export interface RelationKindMeta {
  id: RelationKind
  label: string
  color: string
  /** 连线的虚实：跨代影响与同道不是直接交往，用虚线区分。 */
  dashed: boolean
}

export const relationKinds: RelationKindMeta[] = [
  { id: 'family', label: '亲缘', color: '#e0937a', dashed: false },
  { id: 'mentor', label: '师承', color: '#e6c47c', dashed: false },
  { id: 'friend', label: '知交', color: '#8fd4c3', dashed: false },
  { id: 'historical', label: '君臣·共事', color: '#c7ab86', dashed: false },
  { id: 'rival', label: '对手', color: '#e2665a', dashed: false },
  { id: 'peer', label: '同道', color: '#a2bcd9', dashed: true },
  { id: 'influence', label: '跨代影响', color: '#bda2d6', dashed: true },
]

export const relationKindById = Object.fromEntries(relationKinds.map((kind) => [kind.id, kind])) as Record<RelationKind, RelationKindMeta>
