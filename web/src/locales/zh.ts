import type { NarrationLanguageId } from '@/lib/narration-languages'
import type { VideoStyleId } from '@/lib/video-styles'

export const zh = {
  nav: {
    signIn: '登录',
    signUp: '免费开始',
    goToDashboard: '进入控制台',
    logout: '退出登录',
  },
  home: {
    badge: 'AI 驱动的产品推广视频生成器',
    headline1: '粘贴 URL，',
    headline2: '秒生成推广视频',
    sub: '输入产品网址和介绍资料，AI 分析卖点、生成文案、合成旁白，\n输出专业的可分享产品推广视频。',
    ctaStart: '免费开始使用',
    ctaSignIn: '已有账号登录',
    ctaNote: '免费生成 1 条视频 · 无需信用卡',
    stats: [
      { value: '< 5min', label: '平均生成时长' },
      { value: '100%', label: 'AI 自动分镜' },
      { value: '无限制', label: '分享链接永久有效' },
    ] as { value: string; label: string }[],
    featuresTitle: '自动化产品推广视频生成',
    featuresSub: '三步生成专业产品介绍视频',
    features: [
      { title: 'AI 智能分析', desc: 'OpenAI 兼容接口分析公开页面和介绍资料，提炼产品卖点' },
      { title: '自动生成分镜', desc: '生成 Hook、功能亮点、价值主张和 CTA 场景' },
      { title: '一键分享', desc: 'HyperFrames 合成专属视频，带章节导航的分享页' },
    ] as { title: string; desc: string }[],
    pricingTitle: '价格简单，随生成规模升级',
    pricingSub: 'Free 适合验证流程；Starter 解锁音色、语速和常用风格；Pro 支持团队持续产出与分镜级控制。',
    pricingCta: '开始生成',
    pricingFeatured: '推荐',
    pricingPlans: [
      {
        name: 'Free',
        price: '$0',
        period: '永久',
        quota: '1 条视频',
        description: '适合快速体验核心流程，AI 自动匹配视频风格，并使用默认旁白生成公开视频分享页。',
        features: ['每月 1 条免费视频', '智能匹配视频风格', '默认旁白与标准语速', 'AI 分镜与公开视频分享页'],
      },
      {
        name: 'Starter',
        price: '$19.9',
        period: '/ 月',
        quota: '10 条视频 / 月',
        description: '适合稳定制作产品推广视频，解锁整条视频音色、旁白语速控制和常用视频风格。',
        features: ['每月 10 条视频', '整条视频旁白音色选择', '旁白语速调节', '可选智能匹配、Clean SaaS、Bold Launch、Warm Editorial 风格'],
        highlighted: true,
      },
      {
        name: 'Pro',
        price: '$59.9',
        period: '/ 月',
        quota: '无限视频',
        description: '适合团队持续生产营销素材，解锁完整风格库、完整音色库、分镜人物声音和自定义音频。',
        features: ['不限视频生成次数', '完整视频风格库', '完整音色库与分镜级人物声音', '分镜自定义音频上传与优先生成'],
      },
    ] as {
      name: string
      price: string
      period: string
      quota: string
      description: string
      features: string[]
      highlighted?: boolean
    }[],
    ctaTitle: '开始生成你的第一条推广视频',
    ctaSub: '免费注册，1 条视频无需信用卡',
    ctaBtn: '立即免费开始',
    footer: '© 2025 Showrunner · All rights reserved',
  },
  legal: {
    lastUpdatedLabel: '最后更新',
    lastUpdated: '2026 年 6 月 17 日',
    footer: '© 2026 Showrunner',
    links: {
      terms: '使用条款',
      privacy: '隐私政策',
      refund: '退款政策',
    },
    terms: {
      title: '使用条款',
      metaDescription: '适用于访问和使用 Showrunner 的条款。',
      intro: [
        '本使用条款（“条款”）适用于你访问和使用 Showrunner 的网站、视频生成工具、托管分享页以及相关服务（统称为“服务”）。访问或使用服务即表示你同意受本条款约束。',
      ] as string[],
      sections: [
        {
          title: '1. 服务使用',
          paragraphs: [
            'Showrunner 帮助用户基于产品 URL、补充说明、AI 生成脚本、旁白和渲染场景生成产品推广视频。你只能在遵守适用法律和本条款的前提下使用服务。你需要对你的账号、凭据、输入内容以及账号下发生的活动负责。',
          ],
        },
        {
          title: '2. 客户内容',
          paragraphs: [
            '你保留对提交到服务中的产品 URL、brief、文本、截图、素材和其他内容（“客户内容”）的所有权。你授予 Showrunner 为提供和改进服务所必需的权利，包括处理、转换、托管和展示客户内容。你声明你拥有提交客户内容以及使用生成视频所需的权利。',
          ],
        },
        {
          title: '3. AI 生成输出',
          paragraphs: [
            '服务可能使用 AI 系统分析网站、撰写脚本、创建分镜、生成旁白并渲染视频。AI 输出可能不准确或不完整。你有责任在发布或依赖生成视频前进行审核和确认。',
          ],
        },
        {
          title: '4. 付款与订阅',
          paragraphs: [
            '付费套餐按订阅方式预先计费。付款由 Paddle.com Market Ltd（“Paddle”）处理，Paddle 是 Showrunner 的 merchant of record，负责付款处理、开票、税费计算和退款。你可以随时取消订阅；付费功能通常会保留到当前计费周期结束。可退款的情形将依据 Paddle 条款和我们的退款政策处理。',
          ],
        },
        {
          title: '5. 可接受使用',
          paragraphs: [
            '你同意不会滥用服务，包括但不限于破坏平台运行、绕过安全控制、抓取私有或未经授权的内容、侵犯第三方权利、提交违法材料，或将服务用于欺诈、有害或误导性目的。',
          ],
        },
        {
          title: '6. 服务可用性',
          paragraphs: [
            '我们会努力保持服务稳定，但不保证服务始终不中断、无错误或随时可用。随着产品演进，功能、额度、模型、声音和渲染行为可能发生变化。',
          ],
        },
        {
          title: '7. 免责声明与责任限制',
          paragraphs: [
            '服务按“现状”和“可用”基础提供，不作任何明示或默示保证。在法律允许的最大范围内，Showrunner 不对你使用服务产生的任何间接、偶然、特殊、后果性或惩罚性损害承担责任。',
          ],
        },
        {
          title: '8. 条款变更',
          paragraphs: [
            '我们可能会不时更新本条款。如发生重大变更，我们会通过更新上述日期或其他合理方式通知你。变更生效后继续使用服务，即表示你接受更新后的条款。',
          ],
        },
        {
          title: '9. 联系我们',
          paragraphs: [
            '如果你对本条款有任何问题，请通过 showrunner@cuylerchen.uk 联系我们。',
          ],
        },
      ] as { title: string; paragraphs: string[]; items?: string[] }[],
    },
    privacy: {
      title: '隐私政策',
      metaDescription: 'Showrunner 如何收集、使用和保护信息。',
      intro: [
        '本隐私政策说明 Showrunner（“我们”）在你使用我们的网站、视频生成工具、托管分享页和相关服务（“服务”）时如何收集、使用、披露和保护信息。',
      ] as string[],
      sections: [
        {
          title: '1. 我们收集的信息',
          paragraphs: ['我们可能收集以下类别的信息：'],
          items: [
            '账号信息，例如邮箱地址和认证信息。',
            '你提交的产品 URL、提示词、brief、受众说明、品牌语气、CTA 文案和其他内容。',
            '生成的脚本、分镜、音频、渲染视频、分享链接和相关元数据。',
            '使用信息，例如视频生成次数、套餐额度、功能使用、日志和时间戳。',
            '通过 Paddle 处理的账单和订阅信息。',
            '技术信息，例如 IP 地址、浏览器类型、设备信息、Cookie 和会话数据。',
          ],
        },
        {
          title: '2. 信息使用方式',
          paragraphs: ['我们使用信息用于：'],
          items: [
            '提供、运行、保护和维护服务。',
            '分析产品页面、生成脚本、创建旁白、渲染视频并托管分享页。',
            '管理账号、认证、订阅、套餐额度和客户支持。',
            '改进产品质量、可靠性和安全性。',
            '就服务更新、账单、安全和支持请求与你沟通。',
            '遵守法律义务并执行我们的协议。',
          ],
        },
        {
          title: '3. 服务提供商与共享',
          paragraphs: [
            '我们不会出售你的个人数据。我们可能与帮助我们运营服务的可信服务提供商共享信息，包括托管服务商、数据库服务商、AI 模型提供商、文本转语音或渲染服务、分析或日志工具，以及用于账单和订阅管理的 Paddle。这些提供商只能在向我们提供服务所需范围内使用信息。',
          ],
        },
        {
          title: '4. 付款处理',
          paragraphs: [
            '付款由 Paddle 处理。作为 merchant of record，Paddle 可能会收集账单详情、付款方式信息、税务信息和交易记录。我们会接收管理 Showrunner 账号所需的订阅状态、套餐、客户和交易信息。',
          ],
        },
        {
          title: '5. Cookie 与会话',
          paragraphs: [
            '我们使用 Cookie 和类似技术来保持登录状态、记住偏好、保护会话并了解基础使用情况。你可以通过浏览器设置控制 Cookie，但禁用 Cookie 后部分功能可能无法正常工作。',
          ],
        },
        {
          title: '6. 数据安全',
          paragraphs: [
            '我们采用合理的技术和组织措施保护你的信息。但任何传输或存储方式都不可能完全安全，因此我们无法保证绝对安全。',
          ],
        },
        {
          title: '7. 数据保留',
          paragraphs: [
            '我们会在提供服务、维护业务记录、遵守法律义务、解决争议和执行协议所需期间保留信息。你可以联系我们请求删除账号或部分个人数据。',
          ],
        },
        {
          title: '8. 你的权利',
          paragraphs: [
            '根据你所在司法辖区，你可能拥有访问、更正、删除、导出个人数据或反对某些处理活动的权利。你可以通过下方邮箱联系我们行使这些权利。',
          ],
        },
        {
          title: '9. 儿童隐私',
          paragraphs: [
            '服务不面向 13 岁以下儿童，我们不会在知情情况下收集 13 岁以下儿童的个人信息。',
          ],
        },
        {
          title: '10. 政策变更',
          paragraphs: [
            '我们可能会不时更新本隐私政策。如发生重大变更，我们会通过更新上述日期或其他合理方式通知你。',
          ],
        },
        {
          title: '11. 联系我们',
          paragraphs: [
            '如果你对本隐私政策有任何问题，请通过 showrunner@cuylerchen.uk 联系我们。',
          ],
        },
      ] as { title: string; paragraphs: string[]; items?: string[] }[],
    },
    refund: {
      title: '退款政策',
      metaDescription: 'Showrunner 订阅的退款和取消政策。',
      intro: [
        '本退款政策说明 Showrunner 付费订阅的退款处理方式。所有付款均由 Paddle.com Market Ltd（“Paddle”）处理，Paddle 是 Showrunner 的 merchant of record。',
      ] as string[],
      sections: [
        {
          title: '1. Merchant of Record',
          paragraphs: [
            'Showrunner 订阅通过 Paddle 销售。Paddle 负责处理通过我们结账流程完成购买的付款处理、开票、税费计算和退款。你的购买和任何退款也受 Paddle Invoiced Consumer Terms 约束，地址为 https://www.paddle.com/legal/invoiced-consumer-terms。',
          ],
        },
        {
          title: '2. 14 天退款窗口',
          paragraphs: [
            '消费者可以在交易完成后 14 天内取消购买并申请退款，但需遵守 Paddle 条款和适用法律。对于订阅，该 14 天期限通常从初次订阅扣款日期开始计算；如适用，也可能从续订周期的首次扣款日期开始计算。',
          ],
        },
        {
          title: '3. 14 天后的退款',
          paragraphs: [
            '14 天期限过后，退款不作保证。超出该窗口的退款请求将由 Paddle 根据 Paddle 政策、我们的条款和适用法律逐案处理。',
          ],
        },
        {
          title: '4. 订阅与取消',
          paragraphs: [
            '订阅会自动续订，直到取消。你可以随时取消订阅。取消后，付费访问权限通常会保留到当前计费周期结束，未来续订将停止。除 Paddle 条款或适用法律要求外，取消订阅不会自动产生对已扣款项的退款。',
          ],
        },
        {
          title: '5. 数字服务使用',
          paragraphs: [
            'Showrunner 提供数字服务，包括 AI 生成脚本、旁白、渲染视频和托管分享页。如果数字服务已经被访问、生成、下载或消耗，退款资格可能会受到限制，具体以 Paddle 条款和适用消费者保护法律为准。',
          ],
        },
        {
          title: '6. 如何申请退款',
          paragraphs: ['如果你认为自己符合退款条件，可以：'],
          items: [
            '使用 Paddle 购买确认邮件中的链接管理订单，并直接向 Paddle 提交退款请求；或',
            '将订单详情发送至 showrunner@cuylerchen.uk，我们会协助你转交或处理请求。',
          ],
        },
        {
          title: '7. 你的法定权利',
          paragraphs: [
            '本退款政策不限制你在适用消费者保护法律下享有的任何权利，包括与产品或服务不符合描述、存在缺陷或不适合特定用途相关的权利。',
          ],
        },
        {
          title: '8. 政策变更',
          paragraphs: [
            '我们可能会不时更新本退款政策。如发生重大变更，我们会通过更新上述日期或其他合理方式通知你。',
          ],
        },
      ] as { title: string; paragraphs: string[]; items?: string[] }[],
    },
  },
  dashboard: {
    title: '视频工作台',
    subtitle: '粘贴产品 URL，AI 自动生成可分享的产品推广视频',
    demosCount: (n: number) => `${n} 条视频`,
    myDemos: '我的视频',
    noDemo: '还没有推广视频',
    noDemoSub: '去创建第一条推广视频',
    navCreate: '创建视频',
    navMyTours: '我的视频',
    toursTitle: '我的视频',
    toursEmpty: '还没有推广视频',
    toursEmptySub: '回到工作台创建第一条推广视频',
    toursEmptyBtn: '去创建',
    pageOf: (cur: number, total: number) => `第 ${cur} 页，共 ${total} 页`,
    prevPage: '上一页',
    nextPage: '下一页',
    viewAllTours: '查看所有视频',
  },
  createForm: {
    title: '创建营销视频',
    urlLabel: '产品 URL',
    urlPlaceholder: 'https://app.yourproduct.com',
    descLabel: '补充上下文',
    descOptional: '（可选）',
    descPlaceholder: '可选上下文：发布角度、限制条件或受众说明',
    audienceLabel: '目标受众',
    audiencePlaceholder: '目标受众，例如销售团队',
    keyPointsLabel: '关键卖点',
    keyPointsPlaceholder: '希望强调的卖点或收益',
    brandToneLabel: '品牌语气',
    brandTonePlaceholder: '品牌语气，例如自信、温暖、技术感',
    ctaTextLabel: 'CTA 文案',
    ctaTextPlaceholder: 'CTA 文案，例如预约演示',
    ctaUrlLabel: 'CTA 链接',
    ctaUrlPlaceholder: 'CTA 链接',
    narrationLanguageLabel: '旁白语言',
    narrationLanguageHint: '控制 AI 生成旁白脚本的语言。Auto 会根据输入内容判断，无法判断时使用英语。',
    narrationLanguages: {
      auto: 'Auto（自动判断）',
      en: 'English',
      zh: '中文（普通话）',
      ko: '한국어',
      ja: '日本語',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
      pt: 'Português',
      it: 'Italiano',
    } satisfies Record<NarrationLanguageId, string>,
    ttsVoiceLabel: '旁白声音',
    ttsStarterLocked: 'Starter 解锁',
    ttsProLocked: 'Pro 解锁',
    ttsFreeHint: 'Free 使用默认旁白声音。升级 Starter 可选择更多预设音色。',
    ttsStarterHint: 'Starter 可为整条视频选择一个旁白声音。Pro 可为每个分镜设置不同人物声音。',
    ttsProHint: 'Pro 可为整条视频选择默认声音，也可在分镜确认页为每个场景设置不同人物声音。',
    ttsSpeedLabel: '旁白语速',
    ttsSpeedSlow: '偏慢 · 90%',
    ttsSpeedNormal: '标准 · 100%',
    ttsSpeedFast: '偏快 · 110%',
    ttsSpeedHint: 'Starter 和 Pro 可调整整条视频的旁白语速。',
    ttsSpeedLockedHint: 'Free 使用标准语速。升级 Starter 可调整旁白语速。',
    videoStyleLabel: '视频风格',
    videoStyleStarterLocked: 'Starter 解锁',
    videoStyleProLocked: 'Pro 解锁',
    videoStyleFreeHint: 'Free 自动匹配视频风格。升级 Starter 可手动选择部分风格。',
    videoStyleStarterHint: 'Starter 可选择常用视频风格。Pro 解锁全部风格。',
    videoStyleProHint: 'Pro 可选择全部视频风格。',
    videoStyles: {
      auto: {
        label: '智能匹配',
        description: '根据产品类别、品牌色和内容自动匹配风格。',
      },
      clean_saas: {
        label: 'Clean SaaS',
        description: '清晰克制，适合 SaaS、B2B 和工具产品。',
      },
      bold_launch: {
        label: 'Bold Launch',
        description: '高对比、强发布感，适合新品和推广活动。',
      },
      warm_editorial: {
        label: 'Warm Editorial',
        description: '更有叙事感，适合电商、服务和内容产品。',
      },
      technical_dark: {
        label: 'Technical Dark',
        description: '深色技术感，适合开发者和技术产品。',
      },
      premium_minimal: {
        label: 'Premium Minimal',
        description: '高级、留白、克制的品牌表达。',
      },
      creator_social: {
        label: 'Creator Social',
        description: '节奏更快，适合社媒传播和创作者产品。',
      },
    } satisfies Record<VideoStyleId, { label: string; description: string }>,
    ttsVoices: {
      default: {
        label: '默认旁白',
        description: '平衡、通用的产品视频旁白。',
      },
      professional_female: {
        label: '专业女声',
        description: '清晰、克制，适合 SaaS 产品讲解。',
      },
      warm_male: {
        label: '温暖男声',
        description: '自然友好，适合创始人视角说明。',
      },
      energetic_female: {
        label: '活力女声',
        description: '更明亮，适合发布和推广视频。',
      },
      founder_male: {
        label: '创始人男声',
        description: '自信、专家感，适合观点型场景。',
      },
    } as Record<string, { label: string; description: string }>,
    hint: '填写产品 URL 和可选 brief，Showrunner 自动生成脚本并渲染视频。',
    submitBtn: '生成推广视频',
    loadingBtn: 'AI 解析中...',
    errorDefault: '创建失败，请重试',
    errorNetwork: '网络错误，请重试',
    created: '已创建',
    tryLabel: '试试：',
    successMsg: '推广视频已开始生成，正跳转到列表...',
    steps: ['AI 分析资料', '生成视频分镜', '合成 AI 旁白', '渲染推广视频'] as string[],
  },
  demoCard: {
    view: '查看',
    reviewSteps: '确认分镜',
    handle: '处理',
  },
  loginSession: {
    title: '配置登录状态',
    description: '生成需要登录的产品视频时，需要先在远程浏览器中完成登录，系统将保存登录状态供后续分析使用。',
    hasSession: '✓ 已有保存的登录状态',
    hasSessionNote: '（可重新启动浏览器更新）',
    startBtn: '启动远程浏览器',
    starting: '正在启动远程浏览器...',
    privacyNote: '浏览器运行在服务器上，登录凭据不会被记录',
    navPlaceholder: 'https://...',
    navBtn: '跳转',
    imgAlt: '远程浏览器',
    hint: '点击图像操控浏览器 · 完成登录后点击「保存登录状态」',
    saveBtn: '保存登录状态',
    saving: '保存中...',
    cancel: '取消',
    configured: '已配置登录状态（点击更新）',
    notConfigured: '配置登录状态（产品需要登录时）',
  },
  ctaPanel: {
    description: '视频结束时显示行动按钮（CTA）',
    urlLabel: '跳转链接',
    textLabel: '按钮文字',
    textPlaceholder: '立即体验（留空使用默认）',
    cancel: '取消',
    save: '保存',
  },
  sessionPanel: {
    description: '为需要登录的产品设置访问凭证',
    hasSession: '登录凭证已保存（旧录制流程兼容）',
    step1: '在您的浏览器中打开产品网站并完成登录',
    step2note: '脚本会自动将 Cookie 复制到剪贴板并弹出确认提示。',
    step3: '将复制的内容粘贴到下方：',
    formatError: '格式错误：请确保粘贴的是完整的 JSON 数组',
    saveError: '保存失败',
    copyBtn: '复制',
    copied: '已复制',
    clearBtn: '清除凭证',
    clearing: '清除中...',
    cancel: '取消',
    saveBtn: '保存凭证',
  },
  sharePage: {
    shareLabel: '分享这个营销视频',
    copyLink: '复制链接',
    copied: '已复制',
    downloadVideo: '下载视频',
    loading: '加载中...',
    notFound: '分享页不存在',
    notFoundDesc: '推广视频可能尚未生成完成，或链接已失效',
    backHome: '返回首页',
    defaultTitle: '产品营销视频',
    ctaDefault: '了解更多',
    replay: '重新播放',
    chapters: '场景',
    stepsCount: (n: number) => `${n} 个场景`,
    footerBefore: '由',
    footerAfter: '生成',
  },
  demoDetail: {
    loading: '加载中...',
    notFound: '视频不存在',
    errorTitle: '⚠ 生成中断',
    statusParsing: 'AI 正在分析资料并规划分镜...',
    statusRecording: '正在生成视频，完成后自动跳转...',
    statusProcessing: '正在合成视频，即将完成...',
	    stepsHeader: (n: number) => `分镜 (${n})`,
	    saveEdits: '保存修改',
	    moveSceneUp: '上移分镜',
	    moveSceneDown: '下移分镜',
	    deleteScene: '删除分镜',
	    narrationPlaceholder: '旁白文案（英文朗读）',
    sceneVoiceLabel: '人物声音',
    inheritVideoVoice: '沿用整条视频声音',
    sceneVoiceLocked: 'Pro 可为每个分镜设置不同人物声音并上传自定义音频。当前套餐会沿用整条视频的旁白声音。',
    customAudioLabel: '自定义音频',
    customAudioUpload: '上传音频',
    customAudioUploading: '上传中...',
    customAudioRemove: '移除',
    customAudioUsing: (name: string) => `使用 ${name}`,
    customAudioError: '音频处理失败，请重试',
    retry: '重试',
    skip: '跳过',
    visualScreenshot: '截图',
    visualCta: 'CTA',
    visualTemplate: '模板',
    startBtn: '▶  确认分镜，生成视频',
    startingBtn: '正在生成视频...',
    loginConfigured: '🔐 已配置登录状态（点击更新）',
    loginNotConfigured: '🔐 配置登录状态（产品需要登录时）',
  },
  status: {
    pending: '待处理',
    parsing: 'AI 解析中',
    review: '待确认',
    recording: '生成中',
    paused: '已中断',
    processing: '合成中',
    completed: '已完成',
    failed: '失败',
  },
  subscriptionPanel: {
    label: '当前套餐',
    description: 'Starter 可选整条视频音色；Pro 支持分镜人物声音与无限生成。',
    unlimited: '无限制',
    starter: '升级 Starter',
    pro: '升级 Pro',
	    loading: '打开中...',
	    error: '无法打开 Paddle 结账，请稍后重试',
	    portalError: '无法打开订阅管理，请稍后重试',
	    manageBilling: '管理订阅',
	    cancelBilling: '取消订阅',
	    upgradePlans: {
      starter: {
        name: 'Starter',
        price: '$19.9',
        period: '/ 月',
        quota: '10 条视频 / 月',
      },
      pro: {
        name: 'Pro',
        price: '$59.9',
        period: '/ 月',
        quota: '无限视频',
      },
    } as Record<'starter' | 'pro', { name: string; price: string; period: string; quota: string }>,
    planName: {
      free: 'Free',
      starter: 'Starter',
      pro: 'Pro',
    } as Record<'free' | 'starter' | 'pro', string>,
    statusName: {
      active: '生效中',
      cancelled: '已取消',
      expired: '已过期',
    } as Record<'active' | 'cancelled' | 'expired', string>,
  },
  auth: {
    signIn: {
      title: '欢迎回来',
      subtitle: '登录你的 Showrunner 账号',
      google: '使用 Google 账号登录',
      github: '使用 GitHub 账号登录',
      orEmail: '或使用邮箱登录',
      emailLabel: '邮箱地址',
      passLabel: '密码',
      passPh: '••••••••',
      submitBtn: '登录',
      loadingBtn: '登录中...',
      errorDefault: '登录失败',
      errorNetwork: '网络错误，请重试',
      noAccount: '没有账号？',
      signUpLink: '免费注册',
    },
    signUp: {
      title: '创建账号',
      subtitle: '免费开始 · 无需信用卡',
      google: '使用 Google 账号注册',
      github: '使用 GitHub 账号注册',
      orEmail: '或使用邮箱注册',
      emailLabel: '邮箱地址',
      passLabel: '密码',
      passPh: '至少 8 位',
      submitBtn: '创建账号',
      loadingBtn: '注册中...',
      terms: '注册即同意 Showrunner 使用条款',
      termsBefore: '注册即同意',
      termsLink: 'Showrunner 使用条款',
      hasAccount: '已有账号？',
      signInLink: '登录',
      errorDefault: '注册失败',
      errorNetwork: '网络错误，请重试',
    },
    oauthErrors: {
      oauth_denied: '授权被取消，请重试',
      oauth_state_mismatch: '安全验证失败，请重试',
      oauth_token_failed: 'OAuth 令牌获取失败，请重试',
      oauth_profile_failed: '获取账号信息失败，请重试',
      oauth_no_email: '无法获取邮箱地址，请确保已授权邮箱访问',
      oauth_not_configured: 'OAuth 登录尚未配置，请使用邮箱登录。',
    },
  },
}
