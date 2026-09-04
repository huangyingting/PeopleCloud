import type { Map, StyleSpecification } from 'maplibre-gl'

export type MapTheme = 'night' | 'landscape'

const palettes = {
  night: {
    land: '#192e2b', water: '#102b38', woodland: '#315347', urban: '#57635b',
    river: '#69a6b2', road: '#ab9b7d', label: '#dce3d6', halo: '#172d2b',
    building: '#85978a', shadow: '#10261f', highlight: '#b5cba6',
  },
  landscape: {
    land: '#cbd0b1', water: '#91bac5', woodland: '#91a77c', urban: '#c5b8a0',
    river: '#477f94', road: '#94764e', label: '#263d36', halo: '#e0e1c8',
    building: '#ab9b80', shadow: '#455d49', highlight: '#fff2c9',
  },
}

export function createMapStyle(): StyleSpecification {
  const colors = palettes.night
  return {
    version: 8,
    name: 'PeopleCloud living atlas',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      relief: {
        type: 'raster',
        tiles: ['https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 6,
        attribution: 'Natural Earth',
      },
      geography: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>',
      },
      elevation: {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 12,
        attribution: '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Terrain: Mapzen / AWS</a>',
      },
    },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': colors.land } },
      {
        id: 'relief', type: 'raster', source: 'relief',
        paint: { 'raster-opacity': 0.62, 'raster-saturation': -0.65, 'raster-brightness-max': 0.52, 'raster-fade-duration': 180 },
      },
      {
        id: 'woodland', type: 'fill', source: 'geography', 'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass']]],
        paint: { 'fill-color': colors.woodland, 'fill-opacity': 0.32 },
      },
      {
        id: 'urban', type: 'fill', source: 'geography', 'source-layer': 'landuse', minzoom: 8,
        filter: ['==', ['get', 'class'], 'residential'],
        paint: { 'fill-color': colors.urban, 'fill-opacity': 0.22 },
      },
      {
        id: 'hillshade', type: 'hillshade', source: 'elevation', minzoom: 5,
        paint: {
          'hillshade-exaggeration': 0.35,
          'hillshade-shadow-color': colors.shadow,
          'hillshade-highlight-color': colors.highlight,
          'hillshade-accent-color': colors.shadow,
        },
      },
      {
        id: 'water', type: 'fill', source: 'geography', 'source-layer': 'water',
        paint: { 'fill-color': colors.water, 'fill-opacity': 0.92 },
      },
      {
        id: 'rivers', type: 'line', source: 'geography', 'source-layer': 'waterway',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': colors.river, 'line-opacity': 0.75,
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 10, 1.5, 15, 4],
        },
      },
      {
        id: 'roads', type: 'line', source: 'geography', 'source-layer': 'transportation', minzoom: 8,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']]],
        paint: {
          'line-color': colors.road, 'line-opacity': 0.5,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 12, 1, 16, 3],
        },
      },
      {
        id: 'buildings', type: 'fill-extrusion', source: 'geography', 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-extrusion-color': colors.building, 'fill-extrusion-opacity': 0.7,
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 5],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        },
      },
      {
        id: 'water-labels', type: 'symbol', source: 'geography', 'source-layer': 'water_name',
        layout: {
          'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-letter-spacing': 0.12,
        },
        paint: { 'text-color': colors.river, 'text-halo-color': colors.halo, 'text-halo-width': 1.5 },
      },
      {
        id: 'place-labels', type: 'symbol', source: 'geography', 'source-layer': 'place', minzoom: 4,
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'hamlet', 'suburb']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 9, 14, 14, 16],
          'text-padding': 12, 'text-max-width': 8,
          'symbol-sort-key': ['coalesce', ['get', 'rank'], 10],
        },
        paint: { 'text-color': colors.label, 'text-halo-color': colors.halo, 'text-halo-width': 2 },
      },
    ],
    sky: { 'sky-color': '#142c38', 'horizon-color': '#829b93', 'fog-color': '#29493e', 'fog-ground-blend': 0.3, 'horizon-fog-blend': 0.6 },
  }
}

export function applyMapTheme(map: Map, theme: MapTheme) {
  const colors = palettes[theme]
  const night = theme === 'night'
  const paint: Array<[string, string, string | number]> = [
    ['land', 'background-color', colors.land],
    ['relief', 'raster-opacity', night ? 0.62 : 0.85],
    ['relief', 'raster-saturation', night ? -0.65 : -0.25],
    ['relief', 'raster-brightness-max', night ? 0.52 : 0.95],
    ['woodland', 'fill-color', colors.woodland],
    ['urban', 'fill-color', colors.urban],
    ['water', 'fill-color', colors.water],
    ['rivers', 'line-color', colors.river],
    ['roads', 'line-color', colors.road],
    ['buildings', 'fill-extrusion-color', colors.building],
    ['hillshade', 'hillshade-shadow-color', colors.shadow],
    ['hillshade', 'hillshade-highlight-color', colors.highlight],
    ['hillshade', 'hillshade-accent-color', colors.shadow],
    ['place-labels', 'text-color', colors.label],
    ['water-labels', 'text-color', colors.river],
    ['place-labels', 'text-halo-color', colors.halo],
    ['water-labels', 'text-halo-color', colors.halo],
  ]
  for (const [layer, property, value] of paint) map.setPaintProperty(layer, property, value)
  map.setSky({
    'sky-color': night ? '#142c38' : '#8cb6c6',
    'horizon-color': night ? '#829b93' : '#e7e3c9',
    'fog-color': night ? '#29493e' : '#d4dcc1',
    'fog-ground-blend': 0.3, 'horizon-fog-blend': 0.6,
  })
}
