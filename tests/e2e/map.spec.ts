import { expect, test, type Page } from '@playwright/test'
import { mockMapData } from './map-fixtures'

test.setTimeout(60_000)

async function openMap(page: Page) {
  await page.goto('/?period=tang&person=li-bai')
  await expect(page.locator('.map-person-marker.selected')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.history-map')).toHaveAttribute('data-zoom', /^5\.[26]$/)
}

test.beforeEach(async ({ page }) => mockMapData(page))

test('geographic controls change actual terrain, zoom and connection layers', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openMap(page)
  const map = page.locator('.history-map')
  await expect(map).toHaveAttribute('data-terrain', 'true')
  await page.getByRole('button', { name: '立体地形' }).click()
  await expect(map).toHaveAttribute('data-terrain', 'false')
  await expect(map).toHaveAttribute('data-pitch', '0')
  await page.getByRole('button', { name: '山河', exact: true }).click()
  await expect(map).toHaveClass(/map-theme-landscape/)
  await page.getByRole('button', { name: '人物连线' }).click()
  await expect(page.locator('.constellation-canvas')).toHaveAttribute('data-connection-count', '0')
  await page.getByRole('button', { name: '聚焦人物', exact: true }).click()
  await expect(map).toHaveAttribute('data-zoom', '8.5')
  await page.locator('.maplibregl-ctrl-zoom-in').click()
  await expect(map).toHaveAttribute('data-zoom', '9.5')
  await page.getByRole('button', { name: '立体地形' }).click()
  await expect(map).toHaveAttribute('data-terrain', 'true')
  await expect(map).toHaveAttribute('data-pitch', '52')
  await expect(page.locator('.tile-warning')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('clicking a place discovers nearby people and can continue across eras', async ({ page }, testInfo) => {
  await openMap(page)
  await page.getByRole('button', { name: '立体地形' }).click()
  await expect(page.locator('.history-map')).toHaveAttribute('data-pitch', '0')
  const canvas = page.locator('.maplibregl-canvas')
  const box = await canvas.boundingBox()
  await canvas.click({ position: { x: box!.width * 0.22, y: box!.height * 0.3 } })
  const inspector = page.getByRole('region', { name: '探索此地' })
  await expect(inspector).toBeVisible()
  await expect(inspector.locator('.nearby-people button')).toHaveCount(3)
  await expect(inspector).toContainText('跨时代')
  if (testInfo.project.name === 'mobile-chromium') {
    await expect(page.locator('.person-panel')).toBeHidden()
    await page.locator('.maplibregl-ctrl-zoom-in').click()
    await expect(page.locator('.history-map')).toHaveAttribute('data-zoom', '6.2')
  }
  await inspector.getByRole('button', { name: '近看此地' }).click()
  await expect.poll(async () => Number(await page.locator('.history-map').getAttribute('data-zoom'))).toBeGreaterThanOrEqual(10)
  const name = await inspector.locator('.nearby-people strong').first().innerText()
  await inspector.locator('.nearby-people button').first().click()
  await expect(page.getByRole('complementary', { name: `${name}人物详情` })).toBeVisible()
  await expect(inspector).toBeHidden()
})

test('orbit pauses for user interaction and follows live reduced-motion settings', async ({ page }) => {
  await openMap(page)
  await page.getByRole('button', { name: '环游视野' }).click()
  await expect(page.locator('.history-map')).toHaveAttribute('data-orbiting', 'true')
  await page.getByRole('button', { name: '暂停环游' }).click()
  await expect(page.locator('.history-map')).toHaveAttribute('data-orbiting', 'false')
  await page.getByRole('button', { name: '环游视野' }).click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.getByRole('button', { name: '环游视野' })).toBeDisabled()
  await expect(page.locator('.history-map')).toHaveAttribute('data-orbiting', 'false')
  await expect(page.locator('.constellation-canvas')).toHaveAttribute('data-motion', 'reduced')
})

test('failed elevation falls back to flat geography without losing people', async ({ page }) => {
  await page.route('https://s3.amazonaws.com/elevation-tiles-prod/**', (route) => route.abort())
  await openMap(page)
  await expect(page.locator('.tile-warning')).toContainText('高程数据暂不可用')
  await expect(page.locator('.history-map')).toHaveAttribute('data-terrain', 'false')
  await expect(page.getByRole('button', { name: '立体地形' })).toBeDisabled()
  await expect(page.locator('.map-person-marker')).toHaveCount(23)
  await page.getByRole('button', { name: '下一位人物' }).click()
  await expect(page.locator('.person-panel')).not.toHaveAttribute('data-person-id', 'li-bai')
})
