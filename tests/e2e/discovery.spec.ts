import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockMapData } from './map-fixtures'

test.beforeEach(async ({ page }) => {
  await mockMapData(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test('saved people survive reload and can be removed from the searchable collection', async ({ page }) => {
  await page.goto('/?period=tang&person=li-bai')
  await page.getByRole('button', { name: '收藏李白', exact: true }).click()
  await expect(page.getByRole('button', { name: '取消收藏李白' })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.getByRole('button', { name: '取消收藏李白' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '打开名人名录' }).click()
  const directory = page.getByRole('dialog', { name: '名人名录' })
  await directory.getByRole('button', { name: /我的收藏/ }).click()
  await directory.getByRole('searchbox', { name: '搜索人物' }).fill('诗仙')
  await expect(directory.getByRole('status')).toContainText('找到 1 位人物')
  await directory.getByRole('button', { name: '取消收藏', exact: true }).click()
  await expect(directory.getByRole('heading', { name: '还没有收藏人物' })).toBeVisible()
  await expect(directory.getByRole('searchbox', { name: '搜索人物' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '收藏李白', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.reload()
  await expect(page.getByRole('button', { name: '收藏李白', exact: true })).toHaveAttribute('aria-pressed', 'false')
})

test('themed readings trap focus, cross periods, preserve the mobile sheet and end explicitly', async ({ page }, testInfo) => {
  await page.goto('/?period=tang&person=li-bai')
  if (testInfo.project.name === 'mobile-chromium') await page.getByRole('button', { name: '展开人物详情' }).click()
  const trigger = page.getByRole('button', { name: '打开主题漫游' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: '主题漫游' })
  await expect(dialog.getByText(/非历史行旅路线/)).toBeVisible()
  const close = dialog.getByRole('button', { name: '关闭主题漫游' })
  await expect(close).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: '从第 4 站 白居易 开始' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await dialog.getByRole('button', { name: /仰观与求证/ }).click()
  const audit = await new AxeBuilder({ page }).include('.journeys-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(audit.violations).toEqual([])
  await dialog.getByRole('button', { name: '从第 2 站 祖冲之 开始' }).click()
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'zu-chongzhi')
  await page.getByRole('button', { name: '漫游下一站' }).click()
  await expect(page.locator('.person-panel')).toHaveAttribute('data-person-id', 'shen-kuo')
  await expect(page).toHaveURL(/period=song&person=shen-kuo/)
  await expect(page.getByRole('button', { name: '漫游下一站' })).toBeFocused()
  if (testInfo.project.name === 'mobile-chromium') {
    await expect(page.getByRole('button', { name: '收起人物详情' })).toHaveAttribute('aria-expanded', 'true')
  }
  await page.getByRole('button', { name: '漫游下一站' }).click()
  await expect(page.getByRole('button', { name: '漫游下一站' })).toBeDisabled()
  await expect(page.getByRole('region', { name: '仰观与求证' })).toContainText('已到终站')
  await page.getByRole('button', { name: '结束主题漫游' }).click()
  await expect(page.getByRole('region', { name: '仰观与求证' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '下一位人物' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('failed storage writes are visible and never claim that a person was saved', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'peoplecloud:saved-people:v1') throw new DOMException('Full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await page.goto('/?period=tang&person=li-bai')
  await page.getByRole('button', { name: '收藏李白', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('收藏更改未保存')
  await expect(page.getByRole('button', { name: '收藏李白', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: '打开名人名录' }).click()
  const directory = page.getByRole('dialog', { name: '名人名录' })
  await expect(directory.getByRole('alert')).toContainText('收藏更改未保存')
  await directory.getByRole('button', { name: /我的收藏/ }).click()
  await expect(directory.getByRole('heading', { name: '还没有收藏人物' })).toBeVisible()
})
