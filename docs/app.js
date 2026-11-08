/**
 * Browse page for the market index.
 *
 * Reads ./index.json (official plugin-market format 1) and renders it. No
 * framework, no build step: the file the market server fetches is the same file
 * this page reads, so the page can never disagree with what DSH installs.
 */

const INDEX_URL = 'https://d-sp-wq.github.io/dsh-market/index.json'

const COPY = {
  zh: {
    search: '搜索插件名、作者、关键词…',
    all: '全部',
    sortIndex: '索引顺序',
    sortRecent: '最近发布',
    sortName: '名称',
    howTitle: '在 DSH 里添加这个索引',
    howSteps: [
      '设置 → 插件，启用「插件市场 / Discover」实验性组合包',
      '在发现页添加下面的索引地址',
      '浏览并一键安装',
    ],
    copyIndex: '复制索引地址',
    copied: '已复制',
    result: (shown, total) => `显示 ${shown} / ${total} 个插件`,
    repo: '仓库',
    homepage: '主页',
    copyInstall: '复制安装规格',
    versions: (count) => `${count} 个版本`,
    updated: '最近发布',
    latest: '默认版本',
    noDescription: '（无描述）',
    foot: (count) => `索引格式 1 · ${count} 个插件 · 每次构建都由官方解析器 @deepseek-ai/dsh-plugin-market-index 校验`,
    lang: 'EN',
  },
  en: {
    search: 'Search name, author, keyword…',
    all: 'All',
    sortIndex: 'Index order',
    sortRecent: 'Recently published',
    sortName: 'Name',
    howTitle: 'Add this index to DSH',
    howSteps: [
      'Settings → Plugins: enable the experimental “Plugin Market / Discover” bundle',
      'Add the index URL below on the Discover tab',
      'Browse and install',
    ],
    copyIndex: 'Copy index URL',
    copied: 'Copied',
    result: (shown, total) => `${shown} of ${total} plugins`,
    repo: 'Repository',
    homepage: 'Homepage',
    copyInstall: 'Copy install spec',
    versions: (count) => `${count} version${count === 1 ? '' : 's'}`,
    updated: 'Published',
    latest: 'Default version',
    noDescription: '(no description)',
    foot: (count) => `Format 1 · ${count} plugins · validated with the official @deepseek-ai/dsh-plugin-market-index parser on every build`,
    lang: '中文',
  },
}

let state = { index: undefined, language: 'zh', query: '', category: 'all', sort: 'index' }

const $ = id => document.getElementById(id)

/** A localized field may be a string or a { language: text } object. */
function text(field, language) {
  if (field === undefined) return undefined
  if (typeof field === 'string') return field
  return field[language] ?? field.en ?? Object.values(field)[0]
}

const formatDate = (seconds, language) => new Date(seconds * 1000).toLocaleDateString(
  language === 'zh' ? 'zh-CN' : 'en-US',
  { year: 'numeric', month: 'short', day: 'numeric' },
)

/** Default version: highest stable release, else highest prerelease. */
function defaultVersion(plugin) {
  const stable = plugin.versions.find(version => !version.version.includes('-'))
  return stable ?? plugin.versions[0]
}

function toast(message) {
  let node = document.querySelector('.toast')
  if (node === null) {
    node = document.createElement('div')
    node.className = 'toast'
    document.body.append(node)
  }
  node.textContent = message
  node.classList.add('show')
  clearTimeout(node.timer)
  node.timer = setTimeout(() => node.classList.remove('show'), 1400)
}

async function copy(textValue, label) {
  try {
    await navigator.clipboard.writeText(textValue)
    toast(label)
  } catch {
    toast(textValue)
  }
}

function renderHeader() {
  const copyText = COPY[state.language]
  const index = state.index
  $('market-title').textContent = text(index.title, state.language)
  $('market-description').textContent = text(index.description, state.language) ?? ''
  $('lang-toggle').textContent = copyText.lang
  $('search').placeholder = copyText.search
  $('sort').options[0].textContent = copyText.sortIndex
  $('sort').options[1].textContent = copyText.sortRecent
  $('sort').options[2].textContent = copyText.sortName
  $('how-title').textContent = copyText.howTitle
  $('how-steps').innerHTML = copyText.howSteps.map(step => `<li>${step}</li>`).join('')
  $('copy-index').textContent = copyText.copyIndex
  $('index-url').textContent = INDEX_URL

  const versions = index.plugins.reduce((sum, plugin) => sum + plugin.versions.length, 0)
  $('stats').innerHTML = [
    `<span><b>${index.plugins.length}</b>插件 / plugins</span>`,
    `<span><b>${versions}</b>版本 / versions</span>`,
    `<span><b>${Object.keys(index.metadata.categories).length}</b>分类 / categories</span>`,
  ].join('')

  $('foot-note').textContent = COPY[state.language].foot(index.plugins.length)
  document.documentElement.lang = state.language === 'zh' ? 'zh-CN' : 'en'
}

function renderCategories() {
  const copyText = COPY[state.language]
  const categories = state.index.metadata.categories
  const pills = [{ id: 'all', title: { zh: copyText.all, en: copyText.all } }, ...Object.entries(categories).map(([id, value]) => ({ id, title: value.title }))]
  $('categories').innerHTML = pills.map(pill => (
    `<button class="pill" type="button" data-category="${pill.id}" aria-pressed="${state.category === pill.id}">${text(pill.title, state.language)}</button>`
  )).join('')
}

function matches(plugin) {
  if (state.category !== 'all' && plugin.metadata.category !== state.category) return false
  if (state.query === '') return true
  const needle = state.query.toLowerCase()
  const haystack = [
    plugin.name,
    plugin.author ?? '',
    text(plugin.title, state.language) ?? '',
    text(plugin.description, state.language) ?? '',
    ...(plugin.metadata.keywords ?? []),
  ].join(' ').toLowerCase()
  return haystack.includes(needle)
}

function sorted(plugins) {
  if (state.sort === 'name') return [...plugins].sort((a, b) => a.name.localeCompare(b.name))
  if (state.sort === 'recent') {
    return [...plugins].sort((a, b) => defaultVersion(b).publishTimestamp - defaultVersion(a).publishTimestamp)
  }
  return plugins
}

function card(plugin) {
  const copyText = COPY[state.language]
  const latest = defaultVersion(plugin)
  const categoryTitle = state.index.metadata.categories[plugin.metadata.category]?.title
  const labels = (plugin.metadata.labels ?? [])
    .map(id => text(state.index.metadata.labels[id]?.title, state.language))
    .filter(Boolean)
  const installSpec = `${plugin.name}@${latest.version}`
  const description = text(plugin.description, state.language) ?? copyText.noDescription
  const initial = (text(plugin.title, state.language) ?? plugin.name).slice(0, 1).toUpperCase()

  const links = [
    plugin.repository === undefined ? '' : `<a href="${plugin.repository.url}" target="_blank" rel="noreferrer">${copyText.repo}</a>`,
    plugin.homepage === undefined ? '' : `<a href="${plugin.homepage}" target="_blank" rel="noreferrer">${copyText.homepage}</a>`,
  ].filter(Boolean).join(' · ')

  const versionRows = plugin.versions.map(version => (
    `<li><span>${version.version}${version === latest ? ' ★' : ''} · ${formatDate(version.publishTimestamp, state.language)}</span>
     <button type="button" data-copy="${plugin.name}@${version.version}">${copyText.copyInstall}</button></li>`
  )).join('')

  return `
  <article class="card">
    <div class="card-head">
      <div class="avatar">${initial}</div>
      <div>
        <h2>${text(plugin.title, state.language) ?? plugin.name}</h2>
        <div class="pkg">${plugin.name}</div>
      </div>
    </div>
    <p>${description}</p>
    <div class="chips">
      ${categoryTitle === undefined ? '' : `<span class="chip cat">${text(categoryTitle, state.language)}</span>`}
      ${labels.map(label => `<span class="chip">${label}</span>`).join('')}
      <span class="chip">★ ${latest.version}</span>
    </div>
    <div class="card-foot">
      <span>${copyText.updated} ${formatDate(latest.publishTimestamp, state.language)}</span>
      <span>· ${copyText.versions(plugin.versions.length)}</span>
      <span class="spacer"></span>
      ${links}
      <button class="ghost" type="button" data-copy="${installSpec}">${copyText.copyInstall}</button>
      <button class="ghost" type="button" data-toggle="${plugin.name}">▾</button>
    </div>
    <ul class="versions" data-versions="${plugin.name}" hidden>${versionRows}</ul>
  </article>`
}

function render() {
  const plugins = sorted(state.index.plugins.filter(matches))
  $('grid').innerHTML = plugins.map(card).join('')
  $('empty').hidden = plugins.length !== 0
  $('result-line').textContent = COPY[state.language].result(plugins.length, state.index.plugins.length)
}

function bind() {
  $('search').addEventListener('input', event => { state.query = event.target.value.trim(); render() })
  $('sort').addEventListener('change', event => { state.sort = event.target.value; render() })
  $('categories').addEventListener('click', event => {
    const button = event.target.closest('[data-category]')
    if (button === null) return
    state.category = button.dataset.category
    renderCategories()
    render()
  })
  $('copy-index').addEventListener('click', () => copy(INDEX_URL, COPY[state.language].copied))
  $('lang-toggle').addEventListener('click', () => {
    state.language = state.language === 'zh' ? 'en' : 'zh'
    renderHeader(); renderCategories(); render()
  })
  $('grid').addEventListener('click', event => {
    const copyButton = event.target.closest('[data-copy]')
    if (copyButton !== null) {
      copy(copyButton.dataset.copy, COPY[state.language].copied)
      return
    }
    const toggle = event.target.closest('[data-toggle]')
    if (toggle !== null) {
      const list = document.querySelector(`[data-versions="${CSS.escape(toggle.dataset.toggle)}"]`)
      if (list !== null) {
        list.hidden = !list.hidden
        toggle.textContent = list.hidden ? '▾' : '▴'
      }
    }
  })
}

async function main() {
  const response = await fetch('./index.json', { cache: 'no-cache' })
  state.index = await response.json()
  renderHeader()
  renderCategories()
  render()
  bind()
}

main().catch(error => {
  $('result-line').textContent = `索引加载失败：${error.message}`
})
