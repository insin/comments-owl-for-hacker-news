import {get, set} from './storage.js'
import './routes.js'

const {HN_ORIGIN, ITEM_LIST_ROUTES} = globalThis.COMMENTS_OWL_ROUTES

const TOGGLE_AI_ITEMS = 'toggle-ai-items'
const TOGGLE_AI_ITEMS_URL_PATTERNS = ITEM_LIST_ROUTES
  .filter(route => !route.userItems)
  .flatMap(({path}) => [`${HN_ORIGIN}/${path}`, `${HN_ORIGIN}/${path}?*`])
const TOGGLE_REPLY_LINKS = 'toggle-reply-links'

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