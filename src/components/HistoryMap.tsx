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
import { MapPin, RotateCcw, Sparkles } from 'lucide-react'
import { periodById } from '../data/periods'
import type { Person } from '../types'

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
  private pulseFrame = 0
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
  }

  update(people: Person[], selected: Person) {
    const changed = this.selected?.id !== selected.id
    this.people = people
    this.selected = selected
    this.draw()
    if (changed && !this.reducedMotion) this.animatePulse()
  }

  private scheduleDraw = () => {
    if (this.frame) return
    this.frame = window.requestAnimationFrame(() => {
      this.frame = 0
      this.draw()
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
  }

  private point(person: Person, width: number, height: number) {
    const projected = this.map.project([person.place.longitude, person.place.latitude])
    return new THREE.Vector3(projected.x - width / 2, height / 2 - projected.y, 0)
  }

  private draw(pulse = 0) {
    if (!this.selected) return
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    this.camera.left = -width / 2
    this.camera.right = width / 2
    this.camera.top = height / 2
    this.camera.bottom = -height / 2
    this.camera.near = -100
    this.camera.far = 100
    this.camera.position.z = 10
    this.camera.updateProjectionMatrix()
    this.clear()

    const positions = new Float32Array(this.people.length * 3)
    this.people.forEach((person, index) => {
      const projected = this.point(person, width, height)
      positions[index * 3] = projected.x
      positions[index * 3 + 1] = projected.y
      positions[index * 3 + 2] = person.id === this.selected?.id ? 2 : 1
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: 0xe6bd73,
      map: this.texture,
      transparent: true,
      opacity: 0.82,
      size: 24,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }))
    this.group.add(points)

    const selectedPoint = this.point(this.selected, width, height)
    const related = this.people
      .filter((person) => person.id !== this.selected?.id)
      .map((person) => ({
        person,
        explicit: this.selected?.relations.some((relation) => relation.targetId === person.id) || person.relations.some((relation) => relation.targetId === this.selected?.id),
        shared: person.categories.some((category) => this.selected?.categories.includes(category)),
      }))
      .filter((entry) => entry.explicit || entry.shared)
      .sort((a, b) => Number(b.explicit) - Number(a.explicit))
      .slice(0, 5)

    for (const entry of related) {
      const target = this.point(entry.person, width, height)
      const distance = selectedPoint.distanceTo(target)
      const middle = selectedPoint.clone().lerp(target, 0.5)
      middle.y += Math.min(90, 24 + distance * 0.13)
      const curve = new THREE.QuadraticBezierCurve3(selectedPoint, middle, target)
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(42)),
        new THREE.LineBasicMaterial({ color: entry.explicit ? 0xf1c77a : 0x8fbab0, transparent: true, opacity: entry.explicit ? 0.7 : 0.28, depthTest: false }),
      )
      this.group.add(line)
    }

    const ringRadius = 15 + pulse * 34
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(ringRadius, ringRadius + 1.4, 72),
      new THREE.MeshBasicMaterial({ color: 0xf0c477, transparent: true, opacity: 0.75 * (1 - pulse), side: THREE.DoubleSide, depthTest: false }),
    )
    ring.position.copy(selectedPoint)
    this.group.add(ring)
    try {
      this.renderer.render(this.scene, this.camera)
    } catch (error) {
      console.warn('Three.js constellation enhancement was disabled.', error)
      this.renderer.domElement.hidden = true
    }
  }

  private animatePulse() {
    window.cancelAnimationFrame(this.pulseFrame)
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / 900)
      this.draw(progress)
      if (progress < 1) this.pulseFrame = window.requestAnimationFrame(step)
    }
    this.pulseFrame = window.requestAnimationFrame(step)
  }

  dispose() {
    window.cancelAnimationFrame(this.frame)
    window.cancelAnimationFrame(this.pulseFrame)
    this.map.off('move', this.scheduleDraw)
    this.map.off('resize', this.scheduleDraw)
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

export default function HistoryMap({ people, selected, onSelect }: HistoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapType | null>(null)
  const starsRef = useRef<ConstellationOverlay | null>(null)
  const markersRef = useRef<Marker[]>([])
  const [ready, setReady] = useState(false)
  const [fatalError, setFatalError] = useState(!supportsWebGl())
  const [tileWarning, setTileWarning] = useState(false)
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
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      map?.remove()
      mapRef.current = null
    }
  }, [fatalError])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    markersRef.current.forEach((marker) => marker.remove())
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
      const group = groups.get(`${person.place.longitude.toFixed(4)},${person.place.latitude.toFixed(4)}`) ?? [person]
      const index = group.findIndex((entry) => entry.id === person.id)
      const offsetX = (index - (group.length - 1) / 2) * 38
      return new Marker({ element: button, anchor: 'center', offset: [offsetX, 0] })
        .setLngLat([person.place.longitude, person.place.latitude])
        .addTo(map)
    })
    starsRef.current?.update(people, selected)
  }, [people, ready, selected])

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
      <div className="map-legend"><span><i className="legend-person" />人物地点</span><span><i className="legend-link" />同域星线</span><span><Sparkles size={12} />Three.js 星图</span></div>
      {tileWarning && <div className="tile-warning" role="status">地形底图连接不稳定，人物坐标与交互仍可使用。</div>}
      <button className="reset-map" type="button" onClick={() => mapRef.current?.fitBounds(chinaBounds, { padding: 54, duration: 700 })}><RotateCcw size={14} />纵览山河</button>
    </section>
  )
}
