import {get, set} from './storage.js'

const TOGGLE_AI_ITEMS = 'toggle-ai-items'
const TOGGLE_CUSTOM_ITEMS = 'toggle-custom-items'
const TOGGLE_REPLY_LINKS = 'toggle-reply-links'

const ITEM_PAGE_URL_PATTERNS = [
  'https://news.ycombinator.com/',
  'https://news.ycombinator.com/?*',
  'https://news.ycombinator.com/ask*',
  'https://news.ycombinator.com/front*',
  'https://news.ycombinator.com/newest*',
  'https://news.ycombinator.com/news*',
  'https://news.ycombinator.com/show*',
  'https://news.ycombinator.com/shownew*',
]

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason == 'update') {
    await chrome.contextMenus.removeAll()
  }
  let {hideAiItems, hideCustomItems, hideReplyLinks} = await get(['hideAiItems', 'hideCustomItems', 'hideReplyLinks'])
  chrome.contextMenus.create({
    id: TOGGLE_AI_ITEMS,
    contexts: ['page'],
    title: chrome.i18n.getMessage(hideAiItems ? 'showAiItemsMenuItem' : 'hideAiItemsMenuItem'),
    documentUrlPatterns: ITEM_PAGE_URL_PATTERNS,
  })
  chrome.contextMenus.create({
    id: TOGGLE_CUSTOM_ITEMS,
    contexts: ['page'],
    title: chrome.i18n.getMessage(hideCustomItems ? 'showCustomItemsMenuItem' : 'hideCustomItemsMenuItem'),
    documentUrlPatterns: ITEM_PAGE_URL_PATTERNS,
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
  if (info.menuItemId == TOGGLE_CUSTOM_ITEMS) {
    let {hideCustomItems} = await get('hideCustomItems')
    await set({hideCustomItems: !hideCustomItems})
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
  if (changes.hideCustomItems) {
    chrome.contextMenus.update(TOGGLE_CUSTOM_ITEMS, {
      title: chrome.i18n.getMessage(changes.hideCustomItems.newValue ? 'showCustomItemsMenuItem' : 'hideCustomItemsMenuItem'),
    })
  }
  if (changes.hideReplyLinks) {
    chrome.contextMenus.update(TOGGLE_REPLY_LINKS, {
      title: chrome.i18n.getMessage(changes.hideReplyLinks.newValue ? 'showReplyLinksMenuItem' : 'hideReplyLinksMenuItem'),
    })
  }
})