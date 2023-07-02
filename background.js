const TOGGLE_REPLY_LINKS = 'toggle-reply-links'
const ITEM_URL_PATTERN = 'https://news.ycombinator.com/item*'

/** @type {import("./types").Config} */
let config = {
  addUpvotedToHeader: true,
  autoHighlightNew: true,
  hideReplyLinks: false,
}

function createMenuItems() {
  chrome.contextMenus.create({
    id: TOGGLE_REPLY_LINKS,
    type: 'checkbox',
    contexts: ['page'],
    checked: config.hideReplyLinks,
    title: `Hide reply links`,
    onclick: toggleHideReplyLinks,
    documentUrlPatterns: [ITEM_URL_PATTERN],
  })
}

function toggleHideReplyLinks() {
  chrome.storage.local.set({hideReplyLinks: !config.hideReplyLinks})
}

chrome.storage.local.get((storedConfig) => {
  Object.assign(config, storedConfig)
  createMenuItems()
})

chrome.storage.onChanged.addListener((changes) => {
  if ('hideReplyLinks' in changes) {
    config.hideReplyLinks = changes['hideReplyLinks'].newValue
    chrome.contextMenus.update(TOGGLE_REPLY_LINKS, {checked: config.hideReplyLinks})
  }
})
