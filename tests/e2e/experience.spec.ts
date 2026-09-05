import { expect, test, type Page } from '@playwright/test'
import { mockMapData } from './map-fixtures'

async function enter(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '进入星图' }).click()
  await expect(page.locator('.history-map')).toBeVisible()
  await expect(page.locator('.map-person-marker').first()).toBeVisible({ timeout: 20_000 })
}

test.beforeEach(async ({ page }) => {
  await mockMapData(page)
})

test('desktop exploration connects period, category, map, directory and URL', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  await enter(page)

  await expect(page.locator('.constellation-canvas')).toBeVisible()
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'tang-taizong')
  await page.getByRole('button', { name: '展开时代与领域' }).click()
  await page.getByRole('button', { name: /宋，960—1279/ }).click()
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'su-shi')
  await expect(page).toHaveURL(/period=song&person=su-shi/)

  await page.getByRole('button', { name: /^文学/ }).click()
  await expect(page.locator('.map-result-count')).toContainText('文学')
  await expect.poll(() => page.locator('.map-person-marker').count()).toBeGreaterThanOrEqual(10)

  await page.getByRole('button', { name: /名录/ }).last().click()
  const directory = page.getByRole('dialog', { name: '名人名录' })
  await expect(directory).toBeVisible()
  await directory.getByRole('searchbox', { name: '搜索人物' }).fill('郭守敬')
  await expect(directory.getByRole('status')).toContainText('找到 1 位人物')
  await directory.getByRole('button', { name: /郭守敬/ }).click()
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'guo-shoujing')
  await expect(page).toHaveURL(/period=yuan&person=guo-shoujing/)
  expect(errors).toEqual([])
})

test('all fourteen periods expose a meaningful map sample', async ({ page }) => {
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await enter(page)
  await page.getByRole('button', { name: '展开时代与领域' }).click()
  const timeline = page.getByRole('group', { name: '选择历史时期' })
  const periodButtons = timeline.getByRole('button')
  await expect(periodButtons).toHaveCount(14)
  for (let index = 0; index < 14; index += 1) {
    const button = periodButtons.nth(index)
    const accessibleName = await button.getAttribute('aria-label')
    await button.click()
    await expect(button).toHaveAttribute('aria-current', 'true')
    const expectedCount = Number(accessibleName?.match(/收录 (\d+) 人/)?.[1] ?? 0)
    expect(expectedCount).toBeGreaterThanOrEqual(13)
    await expect(page.locator('.map-person-marker')).toHaveCount(expectedCount)
  }
})

test('expanded constellations stay legible and expose animated relation metadata', async ({ page }) => {
  await enter(page)
  const allMarkers = page.locator('.map-person-marker')
  const visibleLabels = page.locator('.map-person-marker[data-label-visible="true"]')
  await expect(allMarkers).toHaveCount(23)
  await expect.poll(() => visibleLabels.count()).toBeGreaterThan(1)
  expect(await visibleLabels.count()).toBeLessThan(await allMarkers.count())

  const constellation = page.locator('.constellation-canvas')
  await expect(constellation).toHaveAttribute('data-people-count', '23')
  await expect(constellation).toHaveAttribute('data-motion', 'animated')
  expect(Number(await constellation.getAttribute('data-connection-count'))).toBeGreaterThan(0)

  await page.getByRole('button', { name: /名录/ }).last().click()
  const directory = page.getByRole('dialog', { name: '名人名录' })
  await directory.getByRole('searchbox', { name: '搜索人物' }).fill('孙中山')
  await directory.getByRole('button', { name: /孙中山/ }).click()
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'sun-yat-sen')
  await expect(page).toHaveURL(/period=qing&person=sun-yat-sen/)
})

test('map previews, view controls and person trail support guided exploration', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/?period=tang&person=li-bai')
  await expect(page.locator('.map-person-marker').first()).toBeVisible({ timeout: 20_000 })

  const dimensions = await page.evaluate(() => ({
    map: document.querySelector('.map-canvas')?.getBoundingClientRect().height,
    workspace: document.querySelector('.workspace')?.getBoundingClientRect().height,
  }))
  expect(dimensions.map).toBeGreaterThan(0)
  expect(Math.abs((dimensions.map ?? 0) - (dimensions.workspace ?? 0))).toBeLessThanOrEqual(1)

  const marker = page.locator('.map-person-marker:not(.selected)').first()
  const clickedPersonId = await marker.getAttribute('data-person-id')
  await marker.focus()
  const preview = page.locator('.map-person-preview')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('点击聚焦')
  await marker.click()
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', clickedPersonId!)

  const selectedMarker = page.locator('.map-person-marker.selected')
  await selectedMarker.focus()
  await page.keyboard.press('ArrowRight')
  const keyboardTarget = await page.evaluate(() => document.activeElement?.getAttribute('data-person-id'))
  expect(keyboardTarget).toBeTruthy()
  expect(keyboardTarget).not.toBe(clickedPersonId)
  await page.keyboard.press('Enter')
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', keyboardTarget!)

  await page.getByRole('button', { name: '展开地图工具' }).click()
  await page.getByRole('button', { name: /时代全景/ }).click()
  await page.getByRole('button', { name: /聚焦人物/ }).click()
  const beforeNext = await page.locator('.person-panel').getAttribute('data-person-id')
  await page.getByRole('button', { name: '下一位人物' }).click()
  await expect(page.locator('.person-panel')).not.toHaveAttribute('data-person-id', beforeNext!)
  const trail = page.locator('.journey-section')
  await expect(trail).toContainText('李白')
  await trail.getByRole('button', { name: /李白/ }).click()
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'li-bai')
})

test('comparison workspace searches across periods and continues on the map', async ({ page }) => {
  await page.goto('/?period=tang&person=li-bai')
  await page.getByRole('button', { name: '人物对照' }).click()
  const dialog = page.getByRole('dialog', { name: '人物对照' })
  await expect(dialog).toBeVisible()
  const search = dialog.getByRole('searchbox', { name: '搜索对照人物' })
  await expect(search).toBeFocused()
  await search.fill('郭守敬')
  await dialog.getByRole('button', { name: /郭守敬/ }).click()
  await expect(dialog.getByRole('heading', { name: '郭守敬' })).toBeVisible()
  await dialog.getByRole('button', { name: '在星图中查看 郭守敬' }).click()
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'guo-shoujing')
  await expect(page).toHaveURL(/period=yuan&person=guo-shoujing/)
})

test('reduced motion keeps the constellation informative but static', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await enter(page)
  const constellation = page.locator('.constellation-canvas')
  await expect(constellation).toHaveAttribute('data-people-count', '23')
  await expect(constellation).toHaveAttribute('data-motion', 'reduced')
  expect(Number(await constellation.getAttribute('data-connection-count'))).toBeGreaterThan(0)
})

test('URL state restores a selected person and keyboard shortcut opens a trapped directory', async ({ page }) => {
  await page.goto('/?period=ming&person=zheng-he&category=exploration')
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'zheng-he')
  await page.getByRole('button', { name: '展开时代与领域' }).click()
  await expect(page.getByRole('button', { name: /明，1368—1644/ })).toHaveAttribute('aria-current', 'true')
  await page.keyboard.press('Control+K')
  const directory = page.getByRole('dialog', { name: '名人名录' })
  await expect(directory).toBeVisible()
  await expect(directory.getByRole('searchbox', { name: '搜索人物' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(directory).toBeHidden()

  await page.getByRole('button', { name: /清，1644—1912/ }).click()
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'kangxi')
  await page.goBack()
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'zheng-he')
  await page.goForward()
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'kangxi')
})

test('WebGL absence falls back to a complete interactive place list', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null
  })
  await page.goto('/?period=tang&person=li-bai')
  const fallback = page.getByTestId('map-fallback')
  await expect(fallback).toBeVisible()
  await expect(fallback.getByRole('heading', { name: '地图渲染暂不可用' })).toBeVisible()
  await fallback.getByRole('button', { name: /成都.*杜甫/ }).click()
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'du-fu')
})

test('mobile sheet remains readable with no horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile-only layout assertion')
  await enter(page)
  const panel = page.locator('.person-panel')
  await expect(panel).toBeVisible()
  const box = await panel.boundingBox()
  expect(box?.height ?? 9999).toBeLessThanOrEqual(510)
  expect(box?.height ?? 9999).toBeLessThan(844 * 0.5)

  const panelGrab = panel.getByRole('button', { name: '展开人物详情' })
  await panelGrab.click()
  await expect(panel.getByRole('button', { name: '收起人物详情' })).toHaveAttribute('aria-expanded', 'true')
  const expandedBox = await panel.boundingBox()
  expect(expandedBox?.height ?? 0).toBeGreaterThan(box?.height ?? 9999)
  await panel.getByRole('button', { name: '收起人物详情' }).click()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await panel.evaluate((element) => {
    const panelElement = element as HTMLElement
    panelElement.scrollTop = panelElement.scrollHeight
  })
  await expect(panel.getByRole('heading', { name: '来源与进一步阅读' })).toBeVisible()
  await panel.getByRole('button', { name: '关闭人物详情' }).click()
  await expect(panel).toBeHidden()
  await expect(page.getByRole('button', { name: /打开人物卷轴/ })).toBeVisible()
})
