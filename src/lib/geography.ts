import type { Person } from '../types'

export type Coordinate = [longitude: number, latitude: number]

export function distanceKm(from: Coordinate, to: Coordinate) {
  const radians = Math.PI / 180
  const latitude = (to[1] - from[1]) * radians
  const longitude = (to[0] - from[0]) * radians
  const a = Math.sin(latitude / 2) ** 2 + Math.cos(from[1] * radians) * Math.cos(to[1] * radians) * Math.sin(longitude / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)))
}

export function nearbyPeople(entries: Person[], coordinate: Coordinate, limit = 3) {
  return entries
    .map((person) => ({ person, distance: distanceKm(coordinate, [person.place.longitude, person.place.latitude]) }))
    .sort((a, b) => a.distance - b.distance || a.person.id.localeCompare(b.person.id))
    .slice(0, limit)
}

export function formatDistance(km: number) {
  return km < 1 ? '不足 1 km' : `${Math.round(km).toLocaleString('zh-CN')} km`
}

export function formatCoordinate([longitude, latitude]: Coordinate) {
  return `${Math.abs(latitude).toFixed(2)}°${latitude < 0 ? 'S' : 'N'}  ${Math.abs(longitude).toFixed(2)}°${longitude < 0 ? 'W' : 'E'}`
}
