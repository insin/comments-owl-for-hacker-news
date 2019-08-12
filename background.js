const TOGGLE_REPLY_LINKS = 'toggle-reply-links'
const ITEM_URL_PATTERN = 'https://news.ycombinator.com/item*'

let config = {
  addUpvotedToHeader: true,
  autoHighlightNew: true,
  enableDebugLogging: false,
  hideReplyLinks: false,
}

function log(...args) {
  if (config.enableDebugLogging) {
    console.log('WHY‽ background.js', ...args)
  }
}

function createMenuItems() {
  chrome.contextMenus.create({
    id: TOGGLE_REPLY_LINKS,
    type: 'checkbox',
    contexts: ['page'],
    checked: config.hideReplyLinks,
    title: `Hide reply links`,
    onclick: toggleHideReplyLinks,
    targetUrlPatterns: [ITEM_URL_PATTERN],
  })
}

function toggleHideReplyLinks() {
  log(`toggling hideReplyLinks → ${!config.hideReplyLinks}`)
  chrome.storage.local.set({hideReplyLinks: !config.hideReplyLinks})
}

chrome.storage.local.get((storedConfig) => {
  Object.assign(config, storedConfig)
  createMenuItems()
})

chrome.storage.onChanged.addListener((changes) => {
  if ('enableDebugLogging' in changes) {
    config.enableDebugLogging = changes['enableDebugLogging'].newValue
  }
  if ('hideReplyLinks' in changes) {
    config.hideReplyLinks = changes['hideReplyLinks'].newValue
    chrome.contextMenus.update(TOGGLE_REPLY_LINKS, {checked: config.hideReplyLinks})
  }
})
