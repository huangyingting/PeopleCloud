import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  ScaleControl,
  type Map as MapType,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Compass, Focus, Layers3, MapPin, Maximize2, Moon, Mountain, Orbit, Pause, RotateCcw, Route, X, ZoomIn } from 'lucide-react'
import { categoryLabel } from '../data/categories'
import { people as allPeople } from '../data/people'
import { periodById } from '../data/periods'
import { placeRelationLabel } from '../lib/explore'
import { formatCoordinate, formatDistance, nearbyPeople, type Coordinate } from '../lib/geography'
import { applyMapTheme, createMapStyle, type MapTheme } from '../lib/mapStyle'
import type { CategoryId, Person } from '../types'

const chinaBounds: [[number, number], [number, number]] = [[70, 14], [138, 56]]

function cameraOffset(container: HTMLElement): [number, number] {
  const panel = container.closest('.workspace')?.querySelector('.person-panel')?.getBoundingClientRect()
  const compact = window.matchMedia('(max-width: 700px)').matches
  return compact ? [0, -(panel?.height ?? 0) / 2 + 45] : [-(panel?.width ?? 0) / 2, 25]
}

function motionDuration(duration: number) {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration
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
  private readonly materials = {
    stars: new THREE.PointsMaterial({
      vertexColors: true, map: this.texture, transparent: true, opacity: 0.88,
      size: 24, sizeAttenuation: false, depthTest: false, blending: THREE.AdditiveBlending,
    }),
    threads: new THREE.LineBasicMaterial({
      color: 0x7ea89e, transparent: true, opacity: 0.12, depthTest: false, blending: THREE.AdditiveBlending,
    }),
    historicalLine: new THREE.LineBasicMaterial({
      color: 0xf2c66f, transparent: true, opacity: 0.76, depthTest: false, blending: THREE.AdditiveBlending,
    }),
    contextualLine: new THREE.LineBasicMaterial({
      color: 0x83b6ad, transparent: true, opacity: 0.3, depthTest: false, blending: THREE.AdditiveBlending,
    }),
    historicalTraveler: new THREE.MeshBasicMaterial({
      color: 0xffdda0, transparent: true, opacity: 0.95, depthTest: false, blending: THREE.AdditiveBlending,
    }),
    contextualTraveler: new THREE.MeshBasicMaterial({
      color: 0x9de1d2, transparent: true, opacity: 0.72, depthTest: false, blending: THREE.AdditiveBlending,
    }),
    pulse: new THREE.MeshBasicMaterial({
      color: 0xf5c974, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false, blending: THREE.AdditiveBlending,
    }),
    orbit: new THREE.MeshBasicMaterial({
      color: 0xe7b866, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthTest: false, blending: THREE.AdditiveBlending,
    }),
  }
  private viewportWidth = 0
  private viewportHeight = 0
  private people: Person[] = []
  private selected: Person | null = null
  private frame = 0
  private animationFrame = 0
  private lastAnimatedAt = 0
  private startedAt = performance.now()
  private pulseStartedAt = 0
  private travelers: Traveler[] = []
  private pulseRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null
  private orbitRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null
  private readonly motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  private reducedMotion = this.motionQuery.matches
  private connections = true
  private offsets = new Map<string, number>()
  private failed = false

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
    this.motionQuery.addEventListener('change', this.handleMotion)
    this.ensureAnimation()
  }

  update(people: Person[], selected: Person, offsets?: Map<string, number>) {
    const changed = this.selected?.id !== selected.id
    this.people = people
    this.selected = selected
    if (offsets) this.offsets = offsets
    if (changed) this.pulseStartedAt = performance.now()
    this.buildScene()
  }

  setConnections(visible: boolean) {
    this.connections = visible
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
    }
    this.travelers = []
    this.pulseRing = null
    this.orbitRing = null
  }

  private point(person: Person, width: number, height: number) {
    const projected = this.map.project([person.place.longitude, person.place.latitude])
    return new THREE.Vector3(projected.x + (this.offsets.get(person.id) ?? 0) - width / 2, height / 2 - projected.y, 0)
  }

  private setupViewport() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (!width || !height) return null
    if (width !== this.viewportWidth || height !== this.viewportHeight) {
      this.viewportWidth = width
      this.viewportHeight = height
      this.renderer.setSize(width, height, false)
      this.camera.left = -width / 2
      this.camera.right = width / 2
      this.camera.top = height / 2
      this.camera.bottom = -height / 2
      this.camera.near = -100
      this.camera.far = 100
      this.camera.position.z = 10
      this.camera.updateProjectionMatrix()
    }
    return { width, height }
  }

  private buildScene() {
    if (!this.selected || this.failed) return
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
    this.materials.stars.size = this.people.length > 14 ? 21 : 24
    const points = new THREE.Points(geometry, this.materials.stars)
    this.group.add(points)

    const threads: number[] = []
    const threadKeys = new Set<string>()
    for (const person of this.connections ? this.people : []) {
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
      this.group.add(new THREE.LineSegments(threadGeometry, this.materials.threads))
    }

    const selectedPoint = projected.get(this.selected.id)!
    const related = this.people
      .filter((person) => person.id !== this.selected?.id)
      .map((person) => ({
        person,
        explicit: this.selected?.relations.some((relation) => relation.targetId === person.id) || person.relations.some((relation) => relation.targetId === this.selected?.id),
        shared: person.categories.filter((category) => this.selected?.categories.includes(category)).length,
      }))
      .filter((entry) => this.connections && (entry.explicit || entry.shared > 0))
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
        entry.explicit ? this.materials.historicalLine : this.materials.contextualLine,
      )
      this.group.add(line)
      const traveler = new THREE.Mesh(
        new THREE.CircleGeometry(entry.explicit ? 3 : 2.2, 16),
        entry.explicit ? this.materials.historicalTraveler : this.materials.contextualTraveler,
      )
      this.group.add(traveler)
      this.travelers.push({ mesh: traveler, curve, phase: index / Math.max(1, related.length) })
    })
    this.renderer.domElement.dataset.peopleCount = String(this.people.length)
    this.renderer.domElement.dataset.connectionCount = String(related.length)
    this.renderer.domElement.dataset.motion = this.reducedMotion ? 'reduced' : 'animated'

    this.pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(16, 17.5, 72),
      this.materials.pulse,
    )
    this.pulseRing.position.copy(selectedPoint)
    this.group.add(this.pulseRing)
    this.orbitRing = new THREE.Mesh(
      new THREE.RingGeometry(22, 22.8, 96, 1, 0.25, Math.PI * 1.55),
      this.materials.orbit,
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
      this.failed = true
      this.renderer.domElement.hidden = true
    }
  }

  private animate = (now: number) => {
    this.animationFrame = 0
    if (now - this.lastAnimatedAt >= 32) {
      this.renderFrame(now)
      this.lastAnimatedAt = now
    }
    this.ensureAnimation()
  }

  private ensureAnimation() {
    if (this.failed || this.reducedMotion || this.animationFrame || document.hidden) return
    this.animationFrame = window.requestAnimationFrame(this.animate)
  }

  private handleVisibility = () => {
    if (document.hidden) {
      window.cancelAnimationFrame(this.animationFrame)
      this.animationFrame = 0
    } else this.ensureAnimation()
  }

  private handleMotion = () => {
    this.reducedMotion = this.motionQuery.matches
    window.cancelAnimationFrame(this.animationFrame)
    this.animationFrame = 0
    this.buildScene()
  }

  dispose() {
    window.cancelAnimationFrame(this.frame)
    window.cancelAnimationFrame(this.animationFrame)
    this.map.off('move', this.scheduleDraw)
    this.map.off('resize', this.scheduleDraw)
    document.removeEventListener('visibilitychange', this.handleVisibility)
    this.motionQuery.removeEventListener('change', this.handleMotion)
    this.clear()
    Object.values(this.materials).forEach((material) => material.dispose())
    this.texture.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

interface HistoryMapProps {
  people: Person[]
  selected: Person
  onSelect: (person: Person) => void
  onInspect?: () => void
}

interface MarkerEntry {
  marker: Marker
  button: HTMLButtonElement
  person: Person
  offsetX: number
}

interface InspectedPlace {
  coordinate: Coordinate
  name: string
}

export default function HistoryMap({ people, selected, onSelect, onInspect }: HistoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapType | null>(null)
  const starsRef = useRef<ConstellationOverlay | null>(null)
  const markersRef = useRef<MarkerEntry[]>([])
  const [ready, setReady] = useState(false)
  const [fatalError, setFatalError] = useState(() => !supportsWebGl())
  const [tileWarning, setTileWarning] = useState(false)
  const [terrainFailed, setTerrainFailed] = useState(false)
  const [enhancementWarning, setEnhancementWarning] = useState(false)
  const [theme, setTheme] = useState<MapTheme>('night')
  const [is3D, setIs3D] = useState(true)
  const [connections, setConnections] = useState(true)
  const [orbiting, setOrbiting] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [inspected, setInspected] = useState<InspectedPlace | null>(null)
  const [camera, setCamera] = useState({ coordinate: [selected.place.longitude, selected.place.latitude] as Coordinate, zoom: 5.4, pitch: 44 })
  const [hovered, setHovered] = useState<Person | null>(null)
  const is3DRef = useRef(is3D)
  const orbitRef = useRef(orbiting)
  is3DRef.current = is3D
  orbitRef.current = orbiting
  const period = periodById.get(selected.periodId)!
  const selectedRef = useRef(selected)
  const peopleRef = useRef(people)
  const selectRef = useRef(onSelect)
  const inspectRef = useRef(onInspect)
  selectedRef.current = selected
  peopleRef.current = people
  const choosePerson = (person: Person) => {
    setInspected(null)
    setHovered(null)
    setOrbiting(false)
    onSelect(person)
  }
  selectRef.current = choosePerson
  inspectRef.current = onInspect

  useEffect(() => {
    if (fatalError || !containerRef.current || !overlayRef.current) return
    let map: MapType | null = null
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: createMapStyle(),
        center: [selectedRef.current.place.longitude, selectedRef.current.place.latitude],
        zoom: 4.7,
        pitch: 42,
        bearing: -7,
        minZoom: 3,
        maxZoom: 16,
        maxPitch: 70,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        maxBounds: chinaBounds,
        attributionControl: false,
        fadeDuration: 180,
        cancelPendingTileRequestsWhileZooming: true,
        maxTileCacheSize: window.innerWidth < 700 ? 40 : 80,
      })
      map.addControl(new NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-left')
      map.addControl(new ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')
      map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
      let initialized = false
      const initializeInteraction = () => {
        if (initialized) return
        initialized = true
        map?.resize()
        setReady(true)
        if (map && overlayRef.current) {
          try {
            starsRef.current = new ConstellationOverlay(map, overlayRef.current)
            starsRef.current.update(peopleRef.current, selectedRef.current)
          } catch (error) {
            console.warn('Constellation enhancement could not start.', error)
            setEnhancementWarning(true)
          }
        }
      }
      map.once('style.load', initializeInteraction)
      map.once('load', initializeInteraction)
      map.on('error', (event) => {
        if (String(event.error?.message ?? '').toLowerCase().includes('webgl')) setFatalError(true)
        else {
          setTileWarning(true)
          if ('sourceId' in event && event.sourceId === 'elevation') {
            map?.setTerrain(null)
            map?.setLayoutProperty('hillshade', 'visibility', 'none')
            setTerrainFailed(true)
            setIs3D(false)
          }
        }
      })
      let lastCameraUpdate = 0
      map.on('moveend', () => {
        if (!map) return
        const now = performance.now()
        if (orbitRef.current && now - lastCameraUpdate < 250) return
        lastCameraUpdate = now
        const center = map.getCenter()
        setCamera({ coordinate: [center.lng, center.lat], zoom: map.getZoom(), pitch: map.getPitch() })
      })
      map.on('click', (event) => {
        if ((event.originalEvent.target as HTMLElement).closest('button, a, .maplibregl-control-container')) return
        const features = map?.queryRenderedFeatures(event.point, { layers: ['place-labels', 'water-labels'] }) ?? []
        const name: unknown = features[0]?.properties?.['name:zh'] ?? features[0]?.properties?.name
        setInspected({ coordinate: [event.lngLat.lng, event.lngLat.lat], name: typeof name === 'string' ? name : '此处的历史回声' })
        setHovered(null)
        setOrbiting(false)
        if (window.matchMedia('(max-width: 700px)').matches) inspectRef.current?.()
      })
      const stopOrbit = () => setOrbiting(false)
      map.on('dragstart', stopOrbit)
      map.on('zoomstart', stopOrbit)
      map.on('rotatestart', (event) => { if (!('orbit' in event && event.orbit)) stopOrbit() })
      mapRef.current = map
    } catch (error) {
      console.warn('Map rendering could not start.', error)
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
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setReducedMotion(query.matches)
      if (query.matches) {
        setOrbiting(false)
        mapRef.current?.stop()
      }
    }
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

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
      button.style.setProperty('--marker-color', `#${categoryColors[person.categories[0]].toString(16)}`)
      button.tabIndex = person.id === selected.id ? 0 : -1
      if (person.id === selected.id) button.setAttribute('aria-current', 'true')
      button.setAttribute('aria-label', `${person.name}，${person.roles.join('、')}，${person.place.name}`)
      button.setAttribute('aria-describedby', 'map-keyboard-help')
      button.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Home End Enter')
      button.innerHTML = `<span class="marker-core" aria-hidden="true"></span><span class="marker-label">${person.name}</span>`
      button.addEventListener('click', () => selectRef.current(person))
      button.addEventListener('mouseenter', () => setHovered(person))
      button.addEventListener('mouseleave', () => setHovered((current) => current?.id === person.id ? null : current))
      button.addEventListener('focus', () => setHovered(person))
      button.addEventListener('blur', () => setHovered((current) => current?.id === person.id ? null : current))
      button.addEventListener('keydown', (event) => {
        const entries = markersRef.current
        const currentIndex = entries.findIndex((entry) => entry.person.id === person.id)
        if (currentIndex < 0 || !entries.length) return
        let nextIndex: number | null = null
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + entries.length) % entries.length
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % entries.length
        if (event.key === 'Home') nextIndex = 0
        if (event.key === 'End') nextIndex = entries.length - 1
        if (nextIndex === null) return
        event.preventDefault()
        entries.forEach((entry, index) => { entry.button.tabIndex = index === nextIndex ? 0 : -1 })
        entries[nextIndex]?.button.focus()
      })
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
    starsRef.current?.update(people, selected, new Map(markersRef.current.map((entry) => [entry.person.id, entry.offsetX])))
    return () => { map.off('move', refreshLabels) }
  }, [people, ready, selected])

  useEffect(() => {
    if (hovered && !people.some((person) => person.id === hovered.id)) setHovered(null)
  }, [hovered, people])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    applyMapTheme(map, theme)
  }, [ready, theme])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.setTerrain(is3D && !terrainFailed ? { source: 'elevation', exaggeration: 1.35 } : null)
    map.setLayoutProperty('buildings', 'visibility', is3D ? 'visible' : 'none')
    map.easeTo({ pitch: is3D ? 52 : 0, bearing: is3D ? map.getBearing() : 0, duration: motionDuration(700) })
  }, [ready, is3D, terrainFailed])

  useEffect(() => {
    if (ready) starsRef.current?.setConnections(connections)
  }, [ready, connections])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !containerRef.current) return
    const compact = window.matchMedia('(max-width: 700px)').matches
    setInspected(null)
    setOrbiting(false)
    map.flyTo({
      center: [selected.place.longitude, selected.place.latitude],
      zoom: compact ? 5.2 : 5.6,
      pitch: is3DRef.current ? (compact ? 32 : 48) : 0,
      bearing: is3DRef.current ? -7 : 0,
      offset: cameraOffset(containerRef.current),
      duration: motionDuration(1050),
      essential: false,
    })
  }, [ready, selected])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !inspected) return
    const element = document.createElement('div')
    element.className = 'inspection-marker'
    element.setAttribute('aria-hidden', 'true')
    const marker = new Marker({ element }).setLngLat(inspected.coordinate).addTo(map)
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setInspected(null) }
    document.addEventListener('keydown', close)
    return () => {
      marker.remove()
      document.removeEventListener('keydown', close)
    }
  }, [inspected])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !orbiting || reducedMotion) return
    let frame = 0
    let previous = 0
    const rotate = (now: number) => {
      if (document.hidden) { previous = 0; frame = requestAnimationFrame(rotate); return }
      if (!previous) previous = now
      const elapsed = now - previous
      if (elapsed >= 50) {
        map.jumpTo({ bearing: map.getBearing() + Math.min(elapsed, 100) * 0.004 }, { orbit: true })
        previous = now
      }
      frame = requestAnimationFrame(rotate)
    }
    frame = requestAnimationFrame(rotate)
    return () => cancelAnimationFrame(frame)
  }, [orbiting, reducedMotion])

  const fallbackPlaces = useMemo(() => [...people].sort((a, b) => a.place.name.localeCompare(b.place.name, 'zh-CN')), [people])
  const nearby = useMemo(() => inspected ? nearbyPeople(allPeople, inspected.coordinate) : [], [inspected])

  const focusSelected = () => {
    if (!containerRef.current) return
    setOrbiting(false)
    setInspected(null)
    mapRef.current?.flyTo({
      center: [selected.place.longitude, selected.place.latitude],
      zoom: 8.5,
      pitch: is3D ? 58 : 0,
      offset: cameraOffset(containerRef.current),
      duration: motionDuration(1200),
      essential: false,
    })
  }

  const showPeriodOverview = () => {
    const map = mapRef.current
    if (!map || !people.length) return
    setOrbiting(false)
    setInspected(null)
    const longitudes = people.map((person) => person.place.longitude)
    const latitudes = people.map((person) => person.place.latitude)
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ]
    const compact = window.matchMedia('(max-width: 700px)').matches
    const panel = containerRef.current?.closest('.workspace')?.querySelector('.person-panel')?.getBoundingClientRect()
    const height = containerRef.current?.clientHeight ?? window.innerHeight
    const bottom = Math.min((panel?.height ?? 0) + 35, height * 0.6)
    map.fitBounds(bounds, {
      padding: compact
        ? { top: Math.min(155, height * 0.23), right: 35, bottom, left: 35 }
        : { top: Math.min(160, height * 0.25), right: (panel?.width ?? 0) + 60, bottom: Math.min(120, height * 0.25), left: 60 },
      maxZoom: 5.7,
      pitch: is3D ? 25 : 0,
      bearing: 0,
      duration: motionDuration(900),
    })
  }

  const inspectCloser = () => {
    if (!inspected || !containerRef.current) return
    setOrbiting(false)
    mapRef.current?.flyTo({
      center: inspected.coordinate, zoom: Math.max(10, mapRef.current.getZoom() + 1.5),
      pitch: is3D ? 62 : 0, offset: cameraOffset(containerRef.current),
      duration: motionDuration(1400),
    })
  }

  if (fatalError) {
    return (
      <div className="map-fallback" data-testid="map-fallback">
        <div><MapPin /><h2>地图渲染暂不可用</h2><p>你的浏览器没有可用的 WebGL，人物内容仍可完整浏览。按地点选择一位人物继续。</p></div>
        <div className="fallback-places">{fallbackPlaces.map((person) => <button type="button" key={person.id} onClick={() => choosePerson(person)}><strong>{person.place.name}</strong><span>{person.name} · {person.place.note}</span></button>)}</div>
      </div>
    )
  }

  return (
    <section className={`history-map map-theme-${theme}`} aria-label={`${period.label}人物地图`} data-zoom={camera.zoom.toFixed(1)} data-pitch={camera.pitch.toFixed(0)} data-terrain={is3D && !terrainFailed} data-orbiting={orbiting}>
      <div ref={containerRef} className="map-canvas" />
      <div ref={overlayRef} className="three-overlay" />
      {!ready && <div className="map-loading"><span /><strong>正在展开山河星图</strong><small>加载地理与人物坐标…</small></div>}
      <div className="map-period-stamp" aria-live="polite"><span>{period.label}</span><div><strong>{period.dateRange}</strong><small>{period.note}</small></div></div>
      <div className="map-style-controls" aria-label="地图图层">
        <div className="map-theme-switch" role="group" aria-label="底图风格">
          <button type="button" aria-pressed={theme === 'night'} onClick={() => setTheme('night')}><Moon size={14} />星夜</button>
          <button type="button" aria-pressed={theme === 'landscape'} onClick={() => setTheme('landscape')}><Mountain size={14} />山河</button>
        </div>
        <button type="button" className="connection-toggle" aria-pressed={connections} onClick={() => setConnections((current) => !current)}><Route size={14} /><span>人物连线</span></button>
      </div>
      <div className="map-legend"><span><i className="legend-person" />人物锚点</span><span><i className="legend-link" />关联线 · 非行迹</span><span>现代地理参考底图</span></div>
      <p className="map-context-note">现代地理参考 · 非历史疆域</p>
      <div className="map-coordinate"><Compass size={12} /><span>{formatCoordinate(camera.coordinate)}</span><span>z{camera.zoom.toFixed(1)}</span></div>
      {hovered && !inspected && hovered.id !== selected.id && <button className="map-person-preview" type="button" onClick={() => choosePerson(hovered)} aria-label={`聚焦${hovered.name}`}>
        <span className="preview-orbit" aria-hidden="true">{hovered.name.slice(0, 1)}</span>
        <span className="preview-copy"><small>{periodById.get(hovered.periodId)?.label} · {categoryLabel[hovered.categories[0]]}</small><strong>{hovered.name}</strong><em>{hovered.roles.slice(0, 2).join(' · ')}</em><span>{hovered.place.name} · {placeRelationLabel(hovered.place.relation)}</span></span>
        <span className="preview-action">点击聚焦</span>
      </button>}
      {inspected && <section className="place-inspector" aria-label="探索此地">
        <header><span><MapPin size={15} />落点探索</span><button className="icon-button" type="button" aria-label="关闭地点探索" onClick={() => setInspected(null)}><X size={16} /></button></header>
        <h3>{inspected.name}</h3>
        <p>{formatCoordinate(inspected.coordinate)}<button type="button" onClick={inspectCloser}><ZoomIn size={13} />近看此地</button></p>
        <div className="nearby-heading"><strong>附近的人物</strong><span>跨时代 · 直线距离</span></div>
        <div className="nearby-people">{nearby.map(({ person, distance }) => <button type="button" key={person.id} onClick={() => choosePerson(person)}>
          <span className="nearby-initial">{person.name.slice(0, 1)}</span>
          <span><strong>{person.name}</strong><small>{periodById.get(person.periodId)?.label} · {person.place.name}</small></span>
          <em>{formatDistance(distance)}</em>
        </button>)}</div>
        <small className="place-inspector-note">按人物地点锚点推荐，不代表实际行程。</small>
      </section>}
      {(tileWarning || enhancementWarning) && <div className="tile-warning" role="status">{terrainFailed ? '高程数据暂不可用，已切换平面地图。' : tileWarning ? '部分地理数据未能加载，人物仍可探索。' : '星光增强暂不可用，地图仍可探索。'}<button type="button" onClick={() => window.location.reload()}><RotateCcw size={12} />重试</button></div>}
      <div className="map-view-controls" aria-label="地图视野控制">
        <button type="button" aria-label="聚焦人物" onClick={focusSelected}><Focus size={14} /><span>聚焦人物</span></button>
        <button type="button" aria-label="时代全景" onClick={showPeriodOverview}><Maximize2 size={14} /><span>时代全景</span></button>
        <button type="button" aria-label="立体地形" aria-pressed={is3D} disabled={terrainFailed} onClick={() => { setOrbiting(false); setIs3D((current) => !current) }} title={terrainFailed ? '高程数据暂不可用' : '切换平面与真实高程地形'}><Layers3 size={14} /><span>{is3D ? '3D 地形' : '2D 平面'}</span></button>
        <button type="button" aria-label={orbiting ? '暂停环游' : '环游视野'} aria-pressed={orbiting} disabled={reducedMotion} title={reducedMotion ? '已遵循系统减少动态效果设置' : '缓慢环绕当前视野，拖动地图即可暂停'} onClick={() => { setInspected(null); mapRef.current?.stop(); setOrbiting((current) => !current) }}>{orbiting ? <Pause size={14} /> : <Orbit size={14} />}<span>{orbiting ? '暂停' : '环游'}</span></button>
      </div>
      <p className="map-keyboard-help" id="map-keyboard-help">点击地图发现附近人物 · 滚轮缩放 · 右键拖动倾斜<span className="sr-only"> · Tab 进入地图人物，方向键切换人物，Enter 打开</span></p>
    </section>
  )
}
