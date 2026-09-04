export interface JourneyStop {
  personId: string
  note: string
}

export interface Journey {
  id: string
  title: string
  subtitle: string
  introduction: string
  stops: readonly JourneyStop[]
}

export const journeys: readonly Journey[] = [
  {
    id: 'tang-poetry',
    title: '诗里见大唐',
    subtitle: '文学 · 四种观看人间的方式',
    introduction: '从想象的远游、山水的静观，到乱世见闻与公共关怀。并读四位诗人，看唐诗如何容纳不同的人生经验。',
    stops: [
      { personId: 'li-bai', note: '从李白的奔放想象读起：诗中的山河，也是个体志向与自由精神的展开。' },
      { personId: 'wang-wei', note: '转向王维的山水田园，留意景物、声音与留白如何营造另一种诗意。' },
      { personId: 'du-fu', note: '与杜甫一起把目光投向社会变迁：个人身世与时代经验在诗中相互映照。' },
      { personId: 'bai-juyi', note: '以白居易收束阅读：讽谕与叙事让诗歌走近日常，也回应公共生活。' },
    ],
  },
  {
    id: 'scientific-inquiry',
    title: '仰观与求证',
    subtitle: '科学 · 从仪器到观测',
    introduction: '跨越汉、南北朝、宋与元，读四种探索自然的实践。关注工具、计算与记录，不把古代知识简单等同于现代科学。',
    stops: [
      { personId: 'zhang-heng', note: '由张衡的天文与机械探索起步，思考人们如何借助仪器描述天地。' },
      { personId: 'zu-chongzhi', note: '来到祖冲之的数学与历法世界，看看精密计算如何服务于理解周期与尺度。' },
      { personId: 'shen-kuo', note: '翻开沈括的知识笔记：自然观察、地理见闻和工程经验可以彼此启发。' },
      { personId: 'guo-shoujing', note: '最后看郭守敬的天文测量与水利实践，观察知识如何进入历法与公共工程。' },
    ],
  },
  {
    id: 'ways-of-thinking',
    title: '如何安顿此心',
    subtitle: '思想 · 修养、自由与实践',
    introduction: '将不同时代与学派的回答放在一起：人与社会如何相处，认识如何通向行动？这是一组对读，不是一条单线传承谱系。',
    stops: [
      { personId: 'confucius', note: '先读孔子关于仁、礼与教育的讨论，从日常修养进入个人与公共秩序的关系。' },
      { personId: 'zhuangzi', note: '再读庄子的寓言，换一个角度思考生命自由与认识的边界。' },
      { personId: 'zhu-xi', note: '转到朱熹的典籍注释与书院教育，观察思想如何成为系统性的学习实践。' },
      { personId: 'wang-yangming', note: '以王阳明的知行合一作结，把关于修养的追问带回行动与日常选择。' },
    ],
  },
]
