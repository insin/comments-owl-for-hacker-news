import {get, set} from './storage.js'
import './routes.js'

const {HN_ORIGIN, ITEM_LIST_ROUTES} = globalThis.COMMENTS_OWL_ROUTES

const TOGGLE_AI_ITEMS = 'toggle-ai-items'
const TOGGLE_AI_ITEMS_URL_PATTERNS = ITEM_LIST_ROUTES
  .filter(route => !route.userItems)
  .flatMap(({path}) => [`${HN_ORIGIN}/${path}`, `${HN_ORIGIN}/${path}?*`])
const TOGGLE_REPLY_LINKS = 'toggle-reply-links'
// Reserve IDs 1-999 for YouTube CSP rules, including routes removed in updates
const YOUTUBE_CSP_RULE_ID_LIMIT = 1000
const YOUTUBE_CSP_RULE_IDS = ITEM_LIST_ROUTES.map((_, index) => index + 1)

/** @param {string} policy */
function allowYouTubeEmbeds(policy) {
  return policy.split(',').map(policy => {
    let directives = policy.split(';').map(part => part.trim()).filter(Boolean)
    for (let [name, origin] of [
      ['img-src', 'https://i.ytimg.com'],
      ['frame-src', 'https://www.youtube-nocookie.com'],
    ]) {
      let index = directives.findIndex(part => part.split(/\s+/)[0] == name)
      let fallback = name == 'frame-src' && directives.find(part => part.startsWith('child-src '))
      fallback ||= directives.find(part => part.startsWith('default-src '))
      // No directive or fallback means the resource is already unrestricted.
      if (index == -1 && !fallback) continue
      let sources = (index == -1 ? fallback : directives[index]).split(/\s+/).slice(1).filter(source => source != "'none'")
      if (!sources.includes(origin)) sources.push(origin)
      let directive = `${name} ${sources.join(' ')}`
      if (index == -1) directives.push(directive)
      else directives[index] = directive
    }
    return directives.join('; ')
  }).join(', ')
}

async function configureYouTubeCsp() {
  // Use the callback API for Firefox's chrome namespace as well as Chromium.
  let existingRules = await new Promise((resolve, reject) => {
    chrome.declarativeNetRequest.getDynamicRules(rules => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
      else resolve(rules)
    })
  })
  let removeRuleIds = existingRules
    .filter(rule => rule.id > 0 && rule.id < YOUTUBE_CSP_RULE_ID_LIMIT)
    .map(rule => rule.id)
  let {embedYouTubeVideos = true} = await get('embedYouTubeVideos')
  if (!embedYouTubeVideos) {
    await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds})
    return
  }
  // Read the current policy rather than replacing it with a hard-coded copy.
  // The rule only matches main-frame requests, so it doesn't affect this fetch.
  let response = await fetch(`${HN_ORIGIN}/`, {cache: 'no-store'})
  await response.body?.cancel()
  if (!response.ok) throw new Error(`Could not read HN CSP: ${response.status}`)
  let policy = response.headers.get('content-security-policy')
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: policy ? ITEM_LIST_ROUTES.map((route, index) => ({
      id: YOUTUBE_CSP_RULE_IDS[index],
      action: {
        // XXX Firefox doesn't expose Chromium's enums for this
        type: /** @type {chrome.declarativeNetRequest.RuleActionType} */ ('modifyHeaders'),
        responseHeaders: [{
          header: 'content-security-policy',
          operation: /** @type {chrome.declarativeNetRequest.HeaderOperation} */ ('set'),
          value: allowYouTubeEmbeds(policy),
        }],
      },
      condition: {
        urlFilter: `|${HN_ORIGIN}/${route.path}^`,
        resourceTypes: [/** @type {chrome.declarativeNetRequest.ResourceType} */ ('main_frame')],
      },
    })) : [],
  })
}

// Serialize refreshes so disabling embeds also wins over an in-flight fetch
let youtubeCspUpdate = Promise.resolve()
function updateYouTubeCsp() {
  youtubeCspUpdate = youtubeCspUpdate.then(configureYouTubeCsp).catch(error => console.error('Could not configure YouTube embed CSP', error))
}

updateYouTubeCsp()

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason == 'update') {
    await chrome.contextMenus.removeAll()
  }
  let {hideAiItems, hideReplyLinks} = await get(['hideAiItems', 'hideReplyLinks'])
  chrome.contextMenus.create({
    id: TOGGLE_AI_ITEMS,
    contexts: ['page'],
    title: chrome.i18n.getMessage(hideAiItems ? 'showAiItemsMenuItem' : 'hideAiItemsMenuItem'),
    documentUrlPatterns: TOGGLE_AI_ITEMS_URL_PATTERNS,
  })
  chrome.contextMenus.create({
    id: TOGGLE_REPLY_LINKS,
    contexts: ['page'],
    title: chrome.i18n.getMessage(hideReplyLinks ? 'showReplyLinksMenuItem' : 'hideReplyLinksMenuItem'),
    documentUrlPatterns: ['https://news.ycombinator.com/item*'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId == TOGGLE_AI_ITEMS) {
    let {hideAiItems} = await get('hideAiItems')
    await set({hideAiItems: !hideAiItems})
  }
  if (info.menuItemId == TOGGLE_REPLY_LINKS) {
    let {hideReplyLinks} = await get('hideReplyLinks')
    await set({hideReplyLinks: !hideReplyLinks})
  }
})

chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.embedYouTubeVideos) updateYouTubeCsp()
  if (changes.hideAiItems) {
    chrome.contextMenus.update(TOGGLE_AI_ITEMS, {
      title: chrome.i18n.getMessage(changes.hideAiItems.newValue ? 'showAiItemsMenuItem' : 'hideAiItemsMenuItem'),
    })
  }
  if (changes.hideReplyLinks) {
    chrome.contextMenus.update(TOGGLE_REPLY_LINKS, {
      title: chrome.i18n.getMessage(changes.hideReplyLinks.newValue ? 'showReplyLinksMenuItem' : 'hideReplyLinksMenuItem'),
    })
  }
})