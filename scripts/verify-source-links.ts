import { people } from '../src/data/people'

interface SourceCheck {
  person: string
  url: string
  status: number | null
  error?: string
}

const pending = people.flatMap((person) => person.sources.map((source) => ({ person: person.name, url: source.url })))
const results: SourceCheck[] = []
const concurrency = 4

async function worker() {
  while (pending.length) {
    const source = pending.shift()
    if (!source) return
    try {
      const response = await fetch(source.url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: { 'User-Agent': 'PeopleCloud-source-check/0.1 (https://github.com/huangyingting/PeopleCloud)' },
        signal: AbortSignal.timeout(15_000),
      })
      results.push({ ...source, status: response.status })
    } catch (error) {
      results.push({ ...source, status: null, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()))

const failures = results.filter((result) => result.status === null || result.status >= 400)
if (failures.length) {
  console.error(JSON.stringify({ status: 'failed', checked: results.length, failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'passed',
  checked: results.length,
  people: people.length,
  uniqueUrls: new Set(results.map((result) => result.url)).size,
}, null, 2))
