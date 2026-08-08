import { expect, test, type Page } from '@playwright/test'

const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+3MxZ5wAAAABJRU5ErkJggg==', 'base64')

async function makeTilesDeterministic(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng })
  })
}

async function enter(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '进入星图' }).click()
  await expect(page.locator('.history-map')).toBeVisible()
  await expect(page.locator('.map-person-marker').first()).toBeVisible({ timeout: 20_000 })
}

test.beforeEach(async ({ page }) => {
  await makeTilesDeterministic(page)
})

test('desktop exploration connects period, category, map, directory and URL', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  await enter(page)

  await expect(page.locator('.constellation-canvas')).toBeVisible()
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'tang-taizong')
  await page.getByRole('button', { name: /宋，960—1279/ }).click()
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'su-shi')
  await expect(page).toHaveURL(/period=song&person=su-shi/)

  await page.getByRole('button', { name: /^文学/ }).click()
  await expect(page.locator('.map-result-count')).toContainText('文学')
  await expect(page.locator('.map-person-marker')).toHaveCount(5)

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
  await enter(page)
  const timeline = page.getByRole('group', { name: '选择历史时期' })
  const periodButtons = timeline.getByRole('button')
  await expect(periodButtons).toHaveCount(14)
  for (let index = 0; index < 14; index += 1) {
    const button = periodButtons.nth(index)
    const accessibleName = await button.getAttribute('aria-label')
    await button.click()
    await expect(button).toHaveAttribute('aria-current', 'true')
    await expect(page.locator('.map-person-marker')).not.toHaveCount(0)
    expect(Number(accessibleName?.match(/收录 (\d+) 人/)?.[1] ?? 0)).toBeGreaterThanOrEqual(4)
  }
})

test('URL state restores a selected person and keyboard shortcut opens a trapped directory', async ({ page }) => {
  await page.goto('/?period=ming&person=zheng-he&category=exploration')
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'zheng-he')
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
