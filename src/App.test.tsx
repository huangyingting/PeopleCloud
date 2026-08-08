import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./components/HistoryMap', () => ({
  default: ({ people, selected, onSelect }: { people: Array<{ id: string; name: string }>; selected: { id: string; name: string }; onSelect: (person: { id: string; name: string }) => void }) => (
    <section aria-label="测试人物地图" data-selected={selected.id}>
      {people.map((person) => <button type="button" key={person.id} onClick={() => onSelect(person)}>{person.name}</button>)}
    </section>
  ),
}))

describe('PeopleCloud application', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'))
  afterEach(cleanup)

  it('enters the experience and keeps period, person and URL synchronized', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { name: /群星落人间/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '进入星图' }))
    expect(await screen.findByRole('button', { name: /唐，618—907/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('complementary', { name: /人物详情/ })).toHaveAttribute('data-person-id', 'tang-taizong')
    expect(window.location.search).toContain('period=tang')

    await user.click(screen.getByRole('button', { name: /宋，960—1279/ }))
    expect(screen.getByRole('complementary', { name: /人物详情/ })).toHaveAttribute('data-person-id', 'su-shi')
    expect(window.location.search).toContain('person=su-shi')
  })

  it('filters by an available field and disables absent fields', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '进入星图' }))
    const filters = screen.getByRole('region', { name: '测试人物地图' }).parentElement!
    await user.click(screen.getByRole('button', { name: /秦，前221—前206/ }))
    const medicine = within(filters).getByRole('button', { name: /医学/ })
    expect(medicine).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /唐，618—907/ }))
    await user.click(within(filters).getByRole('button', { name: /文学/ }))
    expect(screen.getByText(/文学 · \d+ 位人物/)).toBeInTheDocument()
  })

  it('searches the full directory and selects a cross-period person', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '进入星图' }))
    await user.click(screen.getByRole('button', { name: /名录/ }))
    const dialog = screen.getByRole('dialog', { name: '名人名录' })
    const search = within(dialog).getByRole('searchbox', { name: '搜索人物' })
    await user.type(search, '郭守敬')
    expect(within(dialog).getByRole('status')).toHaveTextContent('找到 1 位人物')
    await user.click(within(dialog).getByRole('button', { name: /郭守敬/ }))
    expect(screen.queryByRole('dialog', { name: '名人名录' })).not.toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: /郭守敬人物详情/ })).toBeInTheDocument()
    expect(window.location.search).toContain('period=yuan')
  })

  it('closes dialogs with Escape and restores focus', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '进入星图' }))
    const help = screen.getByRole('button', { name: '查看使用与数据说明' })
    fireEvent.click(help)
    expect(screen.getByRole('dialog', { name: '关于人间星图' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '关于人间星图' })).not.toBeInTheDocument())
    await waitFor(() => expect(help).toHaveFocus())
  })
})
