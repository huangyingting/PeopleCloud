import { Brush, Compass, Crown, FlaskConical, HeartPulse, Landmark, ScrollText, Swords } from 'lucide-react'
import type { CategoryId } from '../types'

export const categories: Array<{
  id: CategoryId
  label: string
  icon: typeof Crown
}> = [
  { id: 'thought', label: '思想', icon: Landmark },
  { id: 'politics', label: '政治', icon: Crown },
  { id: 'military', label: '军事', icon: Swords },
  { id: 'literature', label: '文学', icon: ScrollText },
  { id: 'art', label: '艺术', icon: Brush },
  { id: 'science', label: '科技', icon: FlaskConical },
  { id: 'medicine', label: '医学', icon: HeartPulse },
  { id: 'exploration', label: '探索', icon: Compass },
]

export const categoryLabel = Object.fromEntries(categories.map(({ id, label }) => [id, label])) as Record<CategoryId, string>
