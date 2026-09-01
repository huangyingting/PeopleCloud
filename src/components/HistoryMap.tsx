import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type Map as MapType,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Focus, MapPin, Maximize2, Sparkles } from 'lucide-react'
import { categoryLabel } from '../data/categories'
import { periodById } from '../data/periods'
import { placeRelationLabel } from '../lib/explore'
import type { CategoryId, Person } from '../types'

const chinaBounds: [[number, number], [number, number]] = [[72, 16], [136, 54]]

const mapStyle: StyleSpecification = {
  version: 8,
  name: 'PeopleCloud silk map',
  sources: {
    relief: {
      type: 'raster',
      tiles: ['https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 6,
      bounds: [68, 14, 138, 56],
      attribution: 'Natural Earth · OpenFreeMap',
    },
  },
  layers: [
    { id: 'ink', type: 'background', paint: { 'background-color': '#071110' } },
    {
      id: 'relief',
      type: 'raster',
      source: 'relief',
      paint: {
        'raster-opacity': 0.84,
        'raster-saturation': -0.7,
        'raster-contrast': 0.35,
        'raster-brightness-min': 0.03,
        'raster-brightness-max': 0.42,
        'raster-hue-rotate': 22,
        'raster-fade-duration': 180,
      },
    },
  ],
}

function supportsWebGl() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function glowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 31)
  gradient.addColorStop(0, 'rgba(255,247,213,1)')
  gradient.addColorStop(0.16, 'rgba(231,189,104,.95)')
  gradient.addColorStop(0.42, 'rgba(208,145,75,.45)')
  gradient.addColorStop(1, 'rgba(208,145,75,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

const categoryColors: Record<CategoryId, number> = {
  thought: 0xd9bd79,
  politics: 0xc96c58,
  military: 0xd39059,
  literature: 0x9db6d4,
  art: 0xc391bd,
  science: 0x72c3b4,
  medicine: 0x8fc681,
  exploration: 0x7fa9d0,
}

interface Traveler {
  mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>
  curve: THREE.QuadraticBezierCurve3
  phase: number
}

class ConstellationOverlay {
  private readonly map: MapType
  private readonly container: HTMLElement
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.OrthographicCamera()
  private readonly renderer: THREE.WebGLRenderer
  private readonly group = new THREE.Group()
  private readonly texture = glowTexture()
  private people: Person[] = []
  private selected: Person | null = null
  private frame = 0
  private animationFrame = 0
  private startedAt = performance.now()
  private pulseStartedAt = 0
  private travelers: Traveler[] = []
  private pulseRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null
  private orbitRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(map: MapType, container: HTMLElement) {
    this.map = map
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
    // Some low-power/headless GPU drivers legally return null shader logs.
    // Three's development diagnostics assume a string, so disable only that
    // diagnostic path; rendering failures are still contained below.
    this.renderer.debug.checkShaderErrors = false
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    this.renderer.domElement.className = 'constellation-canvas'
    this.renderer.domElement.setAttribute('aria-hidden', 'true')
    this.container.appendChild(this.renderer.domElement)
    this.scene.add(this.group)
    this.map.on('move', this.scheduleDraw)
    this.map.on('resize', this.scheduleDraw)
    document.addEventListener('visibilitychange', this.handleVisibility)
    this.ensureAnimation()
  }

  update(people: Person[], selected: Person) {
    const changed = this.selected?.id !== selected.id
    this.people = people
    this.selected = selected
    if (changed) this.pulseStartedAt = performance.now()
    this.buildScene()
  }

  private scheduleDraw = () => {
    if (this.frame) return
    this.frame = window.requestAnimationFrame(() => {
      this.frame = 0
      this.buildScene()
    })
  }

  private clear() {
    while (this.group.children.length) {
      const child = this.group.children.pop() as THREE.Line | THREE.Points | THREE.Mesh
      child.geometry?.dispose()
      const material = child.material
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
      else material?.dispose()
    }
    this.travelers = []
    this.pulseRing = null
    this.orbitRing = null
  }

  private point(person: Person, width: number, height: number) {
    const projected = this.map.project([person.place.longitude, person.place.latitude])
    return new THREE.Vector3(projected.x - width / 2, height / 2 - projected.y, 0)
  }

  private setupViewport() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (!width || !height) return null
    this.renderer.setSize(width, height, false)
    this.camera.left = -width / 2
    this.camera.right = width / 2
    this.camera.top = height / 2
    this.camera.bottom = -height / 2
    this.camera.near = -100
    this.camera.far = 100
    this.camera.position.z = 10
    this.camera.updateProjectionMatrix()
    return { width, height }
  }

  private buildScene() {
    if (!this.selected) return
    const viewport = this.setupViewport()
    if (!viewport) return
    const { width, height } = viewport
    this.clear()

    const positions = new Float32Array(this.people.length * 3)
    const colors = new Float32Array(this.people.length * 3)
    const projected = new Map<string, THREE.Vector3>()
    this.people.forEach((person, index) => {
      const point = this.point(person, width, height)
      const color = new THREE.Color(categoryColors[person.categories[0]])
      projected.set(person.id, point)
      positions[index * 3] = point.x
      positions[index * 3 + 1] = point.y
      positions[index * 3 + 2] = person.id === this.selected?.id ? 2 : 1
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({
      vertexColors: true,
      map: this.texture,
      transparent: true,
      opacity: 0.88,
      size: this.people.length > 14 ? 21 : 24,
      sizeAttenuation: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }))
    this.group.add(points)

    const threads: number[] = []
    const threadKeys = new Set<string>()
    for (const person of this.people) {
      const origin = projected.get(person.id)!
      const nearest = this.people
        .filter((candidate) => candidate.id !== person.id)
        .map((candidate) => ({ candidate, distance: origin.distanceTo(projected.get(candidate.id)!) }))
        .filter((entry) => entry.distance < 245)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 1)
      for (const { candidate } of nearest) {
        const key = [person.id, candidate.id].sort().join(':')
        if (threadKeys.has(key)) continue
        threadKeys.add(key)
        const target = projected.get(candidate.id)!
        threads.push(origin.x, origin.y, 0, target.x, target.y, 0)
      }
    }
    if (threads.length) {
      const threadGeometry = new THREE.BufferGeometry()
      threadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(threads, 3))
      this.group.add(new THREE.LineSegments(threadGeometry, new THREE.LineBasicMaterial({
        color: 0x7ea89e,
        transparent: true,
        opacity: 0.12,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      })))
    }

    const selectedPoint = projected.get(this.selected.id)!
    const related = this.people
      .filter((person) => person.id !== this.selected?.id)
      .map((person) => ({
        person,
        explicit: this.selected?.relations.some((relation) => relation.targetId === person.id) || person.relations.some((relation) => relation.targetId === this.selected?.id),
        shared: person.categories.filter((category) => this.selected?.categories.includes(category)).length,
      }))
      .filter((entry) => entry.explicit || entry.shared > 0)
      .sort((a, b) => Number(b.explicit) - Number(a.explicit) || b.shared - a.shared || projected.get(a.person.id)!.distanceTo(selectedPoint) - projected.get(b.person.id)!.distanceTo(selectedPoint))
      .slice(0, this.people.length > 14 ? 6 : 7)

    related.forEach((entry, index) => {
      const target = projected.get(entry.person.id)!
      const distance = selectedPoint.distanceTo(target)
      const middle = selectedPoint.clone().lerp(target, 0.5)
      middle.y += Math.min(96, 22 + distance * 0.12) * (index % 2 ? -1 : 1)
      const curve = new THREE.QuadraticBezierCurve3(selectedPoint, middle, target)
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)),
        new THREE.LineBasicMaterial({
          color: entry.explicit ? 0xf2c66f : 0x83b6ad,
          transparent: true,
          opacity: entry.explicit ? 0.76 : 0.3,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      this.group.add(line)
      const traveler = new THREE.Mesh(
        new THREE.CircleGeometry(entry.explicit ? 3 : 2.2, 16),
        new THREE.MeshBasicMaterial({
          color: entry.explicit ? 0xffdda0 : 0x9de1d2,
          transparent: true,
          opacity: entry.explicit ? 0.95 : 0.72,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      this.group.add(traveler)
      this.travelers.push({ mesh: traveler, curve, phase: index / Math.max(1, related.length) })
    })
    this.renderer.domElement.dataset.peopleCount = String(this.people.length)
    this.renderer.domElement.dataset.connectionCount = String(related.length)
    this.renderer.domElement.dataset.motion = this.reducedMotion ? 'reduced' : 'animated'

    this.pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(16, 17.5, 72),
      new THREE.MeshBasicMaterial({ color: 0xf5c974, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false, blending: THREE.AdditiveBlending }),
    )
    this.pulseRing.position.copy(selectedPoint)
    this.group.add(this.pulseRing)
    this.orbitRing = new THREE.Mesh(
      new THREE.RingGeometry(22, 22.8, 96, 1, 0.25, Math.PI * 1.55),
      new THREE.MeshBasicMaterial({ color: 0xe7b866, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthTest: false, blending: THREE.AdditiveBlending }),
    )
    this.orbitRing.position.copy(selectedPoint)
    this.group.add(this.orbitRing)
    this.renderFrame(performance.now())
    this.ensureAnimation()
  }

  private renderFrame(now: number) {
    const elapsed = now - this.startedAt
    if (!this.reducedMotion) {
      this.travelers.forEach(({ mesh, curve, phase }, index) => {
        const progress = (elapsed / (2800 + index * 130) + phase) % 1
        mesh.position.copy(curve.getPoint(progress))
        mesh.scale.setScalar(0.72 + Math.sin(progress * Math.PI) * 0.5)
      })
      if (this.orbitRing) {
        this.orbitRing.rotation.z = elapsed / 4200
        const breath = 1 + Math.sin(elapsed / 520) * 0.045
        this.orbitRing.scale.setScalar(breath)
      }
    } else {
      this.travelers.forEach(({ mesh, curve }, index) => mesh.position.copy(curve.getPoint((index + 1) / (this.travelers.length + 1))))
    }

    if (this.pulseRing) {
      const pulse = this.pulseStartedAt ? Math.min(1, (now - this.pulseStartedAt) / 1050) : 1
      this.pulseRing.scale.setScalar(1 + pulse * 2.6)
      this.pulseRing.material.opacity = this.reducedMotion ? 0 : 0.78 * (1 - pulse)
      if (pulse >= 1) this.pulseStartedAt = 0
    }
    try {
      this.renderer.render(this.scene, this.camera)
    } catch (error) {
      console.warn('Three.js constellation enhancement was disabled.', error)
      this.renderer.domElement.hidden = true
    }
  }

  private animate = (now: number) => {
    this.animationFrame = 0
    this.renderFrame(now)
    this.ensureAnimation()
  }

  private ensureAnimation() {
    if (this.reducedMotion || this.animationFrame || document.hidden) return
    this.animationFrame = window.requestAnimationFrame(this.animate)
  }

  private handleVisibility = () => this.ensureAnimation()

  dispose() {
    window.cancelAnimationFrame(this.frame)
    window.cancelAnimationFrame(this.animationFrame)
    this.map.off('move', this.scheduleDraw)
    this.map.off('resize', this.scheduleDraw)
    document.removeEventListener('visibilitychange', this.handleVisibility)
    this.clear()
    this.texture.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

interface HistoryMapProps {
  people: Person[]
  selected: Person
  onSelect: (person: Person) => void
}

interface MarkerEntry {
  marker: Marker
  button: HTMLButtonElement
  person: Person
  offsetX: number
}

export default function HistoryMap({ people, selected, onSelect }: HistoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapType | null>(null)
  const starsRef = useRef<ConstellationOverlay | null>(null)
  const markersRef = useRef<MarkerEntry[]>([])
  const [ready, setReady] = useState(false)
  const [fatalError, setFatalError] = useState(!supportsWebGl())
  const [tileWarning, setTileWarning] = useState(false)
  const [hovered, setHovered] = useState<Person | null>(null)
  const period = periodById.get(selected.periodId)!
  const selectedRef = useRef(selected)
  const peopleRef = useRef(people)
  const selectRef = useRef(onSelect)
  selectedRef.current = selected
  peopleRef.current = people
  selectRef.current = onSelect

  useEffect(() => {
    if (fatalError || !containerRef.current || !overlayRef.current) return
    let map: MapType | null = null
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: mapStyle,
        center: [selectedRef.current.place.longitude, selectedRef.current.place.latitude],
        zoom: 4.7,
        pitch: 42,
        bearing: -7,
        minZoom: 3.25,
        maxZoom: 8.2,
        maxBounds: chinaBounds,
        attributionControl: false,
        fadeDuration: 180,
        cancelPendingTileRequestsWhileZooming: false,
        maxTileCacheSize: window.innerWidth < 700 ? 40 : 80,
      })
      map.addControl(new NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-left')
      map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
      map.once('load', () => {
        setReady(true)
        if (map && overlayRef.current) {
          starsRef.current = new ConstellationOverlay(map, overlayRef.current)
          starsRef.current.update(peopleRef.current, selectedRef.current)
        }
      })
      let sourceErrors = 0
      map.on('error', (event) => {
        if (String(event.error?.message ?? '').toLowerCase().includes('webgl')) setFatalError(true)
        else if (++sourceErrors >= 2) setTileWarning(true)
      })
      mapRef.current = map
    } catch {
      setFatalError(true)
    }
    return () => {
      starsRef.current?.dispose()
      starsRef.current = null
      markersRef.current.forEach(({ marker }) => marker.remove())
      markersRef.current = []
      map?.remove()
      mapRef.current = null
    }
  }, [fatalError])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    markersRef.current.forEach(({ marker }) => marker.remove())
    const groups = new Map<string, Person[]>()
    for (const person of people) {
      const key = `${person.place.longitude.toFixed(4)},${person.place.latitude.toFixed(4)}`
      groups.set(key, [...(groups.get(key) ?? []), person])
    }
    markersRef.current = people.map((person) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = person.id === selected.id ? 'map-person-marker selected' : 'map-person-marker'
      button.dataset.personId = person.id
      button.setAttribute('aria-label', `${person.name}，${person.roles.join('、')}，${person.place.name}`)
      button.innerHTML = `<span class="marker-core" aria-hidden="true"></span><span class="marker-label">${person.name}</span>`
      button.addEventListener('click', () => selectRef.current(person))
      button.addEventListener('mouseenter', () => setHovered(person))
      button.addEventListener('mouseleave', () => setHovered((current) => current?.id === person.id ? null : current))
      button.addEventListener('focus', () => setHovered(person))
      button.addEventListener('blur', () => setHovered((current) => current?.id === person.id ? null : current))
      const group = groups.get(`${person.place.longitude.toFixed(4)},${person.place.latitude.toFixed(4)}`) ?? [person]
      const index = group.findIndex((entry) => entry.id === person.id)
      const offsetX = (index - (group.length - 1) / 2) * 38
      const marker = new Marker({ element: button, anchor: 'center', offset: [offsetX, 0] })
        .setLngLat([person.place.longitude, person.place.latitude])
        .addTo(map)
      return { marker, button, person, offsetX }
    })

    const refreshLabels = () => {
      const canvas = map.getCanvas()
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const zoom = map.getZoom()
      const horizontalGap = zoom >= 6.4 ? 66 : zoom >= 5.5 ? 86 : 108
      const verticalGap = zoom >= 6.4 ? 22 : 28
      const labelBudget = width < 700 ? (zoom >= 6 ? 7 : 5) : zoom >= 6 ? 15 : 10
      const occupied: Array<{ x: number; y: number }> = []
      const prioritized = [...markersRef.current].sort((a, b) => {
        const aScore = Number(a.person.id === selected.id) * 4 + Number(a.person.featured) * 2
        const bScore = Number(b.person.id === selected.id) * 4 + Number(b.person.featured) * 2
        return bScore - aScore || a.person.name.localeCompare(b.person.name, 'zh-CN')
      })

      for (const entry of prioritized) {
        const point = map.project([entry.person.place.longitude, entry.person.place.latitude])
        point.x += entry.offsetX
        const inside = point.x > -25 && point.x < width + 25 && point.y > -25 && point.y < height + 25
        const collides = occupied.some((used) => Math.abs(used.x - point.x) < horizontalGap && Math.abs(used.y - point.y) < verticalGap)
        const selectedMarker = entry.person.id === selected.id
        const show = inside && (selectedMarker || (occupied.length < labelBudget && !collides))
        entry.button.classList.toggle('label-visible', show)
        entry.button.dataset.labelVisible = String(show)
        if (show) occupied.push(point)
      }
    }
    map.on('move', refreshLabels)
    refreshLabels()
    starsRef.current?.update(people, selected)
    return () => { map.off('move', refreshLabels) }
  }, [people, ready, selected])

  useEffect(() => {
    if (hovered && !people.some((person) => person.id === hovered.id)) setHovered(null)
  }, [hovered, people])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const compact = window.matchMedia('(max-width: 700px)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.flyTo({
      center: [selected.place.longitude, selected.place.latitude],
      zoom: compact ? 5.1 : 5.4,
      pitch: compact ? 28 : 44,
      bearing: compact ? 0 : -7,
      offset: compact ? [0, -80] : [-110, 0],
      duration: reduced ? 0 : 1050,
      essential: false,
    })
  }, [ready, selected])

  const fallbackPlaces = useMemo(() => [...people].sort((a, b) => a.place.name.localeCompare(b.place.name, 'zh-CN')), [people])

  const focusSelected = () => {
    const compact = window.matchMedia('(max-width: 700px)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    mapRef.current?.flyTo({
      center: [selected.place.longitude, selected.place.latitude],
      zoom: compact ? 5.1 : 5.4,
      pitch: compact ? 28 : 44,
      bearing: compact ? 0 : -7,
      offset: compact ? [0, -80] : [-110, 0],
      duration: reduced ? 0 : 800,
      essential: false,
    })
  }

  const showPeriodOverview = () => {
    const map = mapRef.current
    if (!map || !people.length) return
    const longitudes = people.map((person) => person.place.longitude)
    const latitudes = people.map((person) => person.place.latitude)
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ]
    const compact = window.matchMedia('(max-width: 700px)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.fitBounds(bounds, {
      padding: compact ? { top: 125, right: 35, bottom: 250, left: 35 } : { top: 110, right: 430, bottom: 90, left: 80 },
      maxZoom: 5.7,
      pitch: compact ? 18 : 32,
      bearing: 0,
      duration: reduced ? 0 : 900,
    })
  }

  if (fatalError) {
    return (
      <div className="map-fallback" data-testid="map-fallback">
        <div><MapPin /><h2>地图渲染暂不可用</h2><p>你的浏览器没有可用的 WebGL，人物内容仍可完整浏览。按地点选择一位人物继续。</p></div>
        <div className="fallback-places">{fallbackPlaces.map((person) => <button type="button" key={person.id} onClick={() => onSelect(person)}><strong>{person.place.name}</strong><span>{person.name} · {person.place.note}</span></button>)}</div>
      </div>
    )
  }

  return (
    <section className="history-map" aria-label={`${period.label}人物地图`}>
      <div ref={containerRef} className="map-canvas" />
      <div ref={overlayRef} className="three-overlay" />
      {!ready && <div className="map-loading"><span /><strong>正在展开山河星图</strong><small>加载地理与人物坐标…</small></div>}
      <div className="map-period-stamp" aria-live="polite"><span>{period.label}</span><div><strong>{period.dateRange}</strong><small>{period.note}</small></div></div>
      <div className="map-legend"><span><i className="legend-person" />人物地点</span><span><i className="legend-link" />关系流光</span><span><Sparkles size={12} />领域星色 · Three.js</span></div>
      {hovered && hovered.id !== selected.id && <button className="map-person-preview" type="button" onClick={() => onSelect(hovered)} aria-label={`聚焦${hovered.name}`}>
        <span className="preview-orbit" aria-hidden="true">{hovered.name.slice(0, 1)}</span>
        <span className="preview-copy"><small>{periodById.get(hovered.periodId)?.label} · {categoryLabel[hovered.categories[0]]}</small><strong>{hovered.name}</strong><em>{hovered.roles.slice(0, 2).join(' · ')}</em><span>{hovered.place.name} · {placeRelationLabel(hovered.place.relation)}</span></span>
        <span className="preview-action">点击聚焦</span>
      </button>}
      {tileWarning && <div className="tile-warning" role="status">地形底图连接不稳定，人物坐标与交互仍可使用。</div>}
      <div className="map-view-controls" aria-label="地图视野控制">
        <button type="button" onClick={focusSelected}><Focus size={14} /><span>聚焦人物</span></button>
        <button type="button" onClick={showPeriodOverview}><Maximize2 size={14} /><span>时代全景</span></button>
      </div>
    </section>
  )
}
