import { periodById } from '../data/periods'
import { relationKindById } from '../data/relationKinds'
import type { Connection } from '../lib/relations'
import type { Person } from '../types'

interface RelationConstellationProps {
  person: Person
  connections: Connection[]
  activeId: string | null
  onHover: (id: string | null) => void
  onSelect: (person: Person) => void
}

const WIDTH = 320
const HEIGHT = 212
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 }
export const CONSTELLATION_LIMIT = 12

// A small ego network: the selected person at the centre, each documented tie on a ring around them.
export function RelationConstellation({ person, connections, activeId, onHover, onSelect }: RelationConstellationProps) {
  const shown = connections.slice(0, CONSTELLATION_LIMIT)
  const nodes = shown.map((connection, index) => {
    const angle = -Math.PI / 2 + ((index + (shown.length % 2 ? 0 : 0.5)) / Math.max(shown.length, 1)) * Math.PI * 2
    const radius = shown.length > 7 ? (index % 2 ? 0.74 : 1) : 0.92
    const x = CENTER.x + Math.cos(angle) * 124 * radius
    const y = CENTER.y + Math.sin(angle) * 80 * radius
    const bend = 12 * (index % 2 ? -1 : 1)
    const curve = { x: (CENTER.x + x) / 2 + Math.sin(angle) * bend, y: (CENTER.y + y) / 2 - Math.cos(angle) * bend }
    return { connection, x, y, curve, meta: relationKindById[connection.kind], crossPeriod: connection.person.periodId !== person.periodId }
  })
  const stateClass = (id: string) => (activeId === id ? ' active' : activeId ? ' muted' : '')

  return (
    <svg className="ego-constellation" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" key={person.id} data-node-count={nodes.length}>
      <defs>
        <radialGradient id="ego-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff3cf" />
          <stop offset="45%" stopColor="#e6b467" stopOpacity=".55" />
          <stop offset="100%" stopColor="#e6b467" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="ego-orbit" cx={CENTER.x} cy={CENTER.y} rx={124} ry={80} />
      <ellipse className="ego-orbit faint" cx={CENTER.x} cy={CENTER.y} rx={92} ry={59} />
      {nodes.map(({ connection, x, y, meta, curve }, index) => (
        <path
          key={`line-${connection.person.id}`}
          className={`ego-line${meta.dashed ? ' dashed' : ''}${stateClass(connection.person.id)}`}
          d={`M${CENTER.x} ${CENTER.y} Q${curve.x} ${curve.y} ${x} ${y}`}
          pathLength={1}
          stroke={meta.color}
          style={{ '--i': index } as React.CSSProperties}
        />
      ))}
      <circle className="ego-core-glow" cx={CENTER.x} cy={CENTER.y} r={30} fill="url(#ego-core)" />
      <circle className="ego-core" cx={CENTER.x} cy={CENTER.y} r={6.5} />
      <text className="ego-core-label" x={CENTER.x} y={CENTER.y + 22} textAnchor="middle">{person.name}</text>
      {nodes.map(({ connection, x, y, meta, crossPeriod }, index) => (
        <g
          key={`node-${connection.person.id}`}
          className={`ego-node${stateClass(connection.person.id)}`}
          style={{ '--i': index } as React.CSSProperties}
          onMouseEnter={() => onHover(connection.person.id)}
          onMouseLeave={() => onHover(null)}
          onClick={() => onSelect(connection.person)}
        >
          <circle className="ego-hit" cx={x} cy={y} r={16} />
          <circle cx={x} cy={y} r={crossPeriod ? 4.4 : 5} fill={crossPeriod ? '#0c1717' : meta.color} stroke={meta.color} strokeWidth={crossPeriod ? 1.6 : 0} />
          <text x={x} y={y < CENTER.y - 4 ? y - 10 : y + 17} textAnchor="middle">
            {connection.person.name}{crossPeriod && <tspan className="ego-period" dx="3">{periodById.get(connection.person.periodId)?.shortLabel}</tspan>}
          </text>
        </g>
      ))}
    </svg>
  )
}
