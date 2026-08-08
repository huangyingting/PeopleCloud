import type { Period } from '../types'

export const periods: Period[] = [
  { id: 'pre-qin', label: '先秦', shortLabel: '先秦', startYear: -770, endYear: -221, dateRange: '前770—前221', note: '诸子争鸣与列国竞合', accent: '#d6b56f', center: [112, 34], zoom: 4.35 },
  { id: 'qin', label: '秦', shortLabel: '秦', startYear: -221, endYear: -206, dateRange: '前221—前206', note: '一统、郡县与制度重塑', accent: '#bd6b4c', center: [109, 34.2], zoom: 4.55 },
  { id: 'han', label: '汉', shortLabel: '汉', startYear: -206, endYear: 220, dateRange: '前206—220', note: '帝国秩序与丝路开拓', accent: '#c48b57', center: [110.5, 34.2], zoom: 4.3 },
  { id: 'three-kingdoms', label: '三国', shortLabel: '三国', startYear: 220, endYear: 280, dateRange: '220—280', note: '群雄、谋略与文学风骨', accent: '#b96355', center: [111, 31.5], zoom: 4.35 },
  { id: 'jin', label: '晋', shortLabel: '晋', startYear: 266, endYear: 420, dateRange: '266—420', note: '门阀、玄学与江左风流', accent: '#9c8e72', center: [115, 31.5], zoom: 4.5 },
  { id: 'southern-northern', label: '南北朝', shortLabel: '南北朝', startYear: 420, endYear: 589, dateRange: '420—589', note: '南北交汇与文明融合', accent: '#8d9d7b', center: [113.5, 34], zoom: 4.25 },
  { id: 'sui', label: '隋', shortLabel: '隋', startYear: 581, endYear: 618, dateRange: '581—618', note: '再统一与工程时代', accent: '#7b9b8e', center: [112, 34], zoom: 4.5 },
  { id: 'tang', label: '唐', shortLabel: '唐', startYear: 618, endYear: 907, dateRange: '618—907', note: '开放帝国与诗歌盛景', accent: '#d49a54', center: [108.9, 34.3], zoom: 4.3 },
  { id: 'five-dynasties', label: '五代十国', shortLabel: '五代', startYear: 907, endYear: 960, dateRange: '907—960', note: '分裂中的制度与文脉', accent: '#89775f', center: [114, 32], zoom: 4.25 },
  { id: 'song', label: '宋', shortLabel: '宋', startYear: 960, endYear: 1279, dateRange: '960—1279', note: '文治、城市与技术跃迁', accent: '#75a49a', center: [115.5, 30.5], zoom: 4.4 },
  { id: 'liao-jin-xixia', label: '辽金西夏', shortLabel: '辽金', startYear: 916, endYear: 1234, dateRange: '916—1234', note: '多政权并立与族群交流', accent: '#9b8365', center: [110, 39], zoom: 4.05 },
  { id: 'yuan', label: '元', shortLabel: '元', startYear: 1271, endYear: 1368, dateRange: '1271—1368', note: '欧亚网络与多元艺术', accent: '#648e9b', center: [116.4, 39.9], zoom: 4.15 },
  { id: 'ming', label: '明', shortLabel: '明', startYear: 1368, endYear: 1644, dateRange: '1368—1644', note: '航海、心学与实学兴起', accent: '#bd5e4b', center: [116, 32], zoom: 4.25 },
  { id: 'qing', label: '清', shortLabel: '清', startYear: 1644, endYear: 1912, dateRange: '1644—1912', note: '帝国晚期与近代转型', accent: '#9a7658', center: [114, 34], zoom: 4.05 },
]

export const periodById = new Map(periods.map((period) => [period.id, period]))
