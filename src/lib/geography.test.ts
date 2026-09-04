import { describe, expect, it } from 'vitest'
import { people } from '../data/people'
import { distanceKm, formatCoordinate, formatDistance, nearbyPeople } from './geography'
import { createMapStyle } from './mapStyle'

describe('geographic exploration', () => {
  it('calculates great-circle rather than screen-space distance', () => {
    expect(distanceKm([116.4, 39.9], [116.4, 39.9])).toBe(0)
    expect(distanceKm([116.4, 39.9], [121.47, 31.23])).toBeCloseTo(1068, -1)
    expect(distanceKm([0, 0], [180, 0])).toBeCloseTo(20015, -1)
  })

  it('returns nearest people across eras without mutating the corpus', () => {
    const original = people.map((person) => person.id)
    const nearest = nearbyPeople(people, [108.94, 34.34], 5)
    expect(nearest).toHaveLength(5)
    expect(nearest[0].distance).toBeLessThan(10)
    expect(nearest.every((entry, index) => index === 0 || entry.distance >= nearest[index - 1].distance)).toBe(true)
    expect(people.map((person) => person.id)).toEqual(original)
    expect(nearbyPeople([], [0, 0])).toEqual([])
  })

  it('labels approximate distances and geographic coordinates', () => {
    expect(formatDistance(0.2)).toBe('不足 1 km')
    expect(formatDistance(47.8)).toBe('48 km')
    expect(formatCoordinate([108.94, 34.34])).toBe('34.34°N  108.94°E')
    expect(formatCoordinate([-74, -12])).toBe('12.00°S  74.00°W')
  })

  it('defines vector geography and genuine elevation without an API key', () => {
    const style = createMapStyle()
    expect(style.sources.geography.type).toBe('vector')
    expect(style.sources.elevation.type).toBe('raster-dem')
    expect(style.layers.some((layer) => layer.type === 'fill-extrusion')).toBe(true)
    expect(style.layers.some((layer) => layer.id === 'place-labels')).toBe(true)
  })
})
