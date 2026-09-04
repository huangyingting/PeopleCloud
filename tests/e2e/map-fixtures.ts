import type { Page } from '@playwright/test'

// Indexed PNG palette (128, 0, 0) encodes sea level in Terrarium RGB.
const flatTerrain = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAMAAABrrFhUAAAAA1BMVEWAAABGTyZaAAAAVElEQVR42u3BAQEAAACAkP6v7ggKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAEPAAEccgnDAAAAAElFTkSuQmCC',
  'base64',
)

export async function mockMapData(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (route) => {
    const url = route.request().url()
    if (url.endsWith('/planet')) return route.fulfill({
      json: { tilejson: '3.0.0', minzoom: 0, maxzoom: 14, tiles: ['https://tiles.openfreemap.org/test/{z}/{x}/{y}.pbf'] },
    })
    if (url.endsWith('.pbf')) return route.fulfill({ contentType: 'application/x-protobuf', body: Buffer.alloc(0) })
    return route.fulfill({ contentType: 'image/png', body: flatTerrain })
  })
  await page.route('https://s3.amazonaws.com/elevation-tiles-prod/**', (route) => route.fulfill({ contentType: 'image/png', body: flatTerrain }))
}
