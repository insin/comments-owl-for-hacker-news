const TOGGLE_REPLY_LINKS = 'toggle-reply-links'

let hidingReplyLinks = false

chrome.storage.local.get({hideReplyLinks: false}, ({hideReplyLinks}) => {
  hidingReplyLinks = hideReplyLinks
  chrome.contextMenus.create({
    id: TOGGLE_REPLY_LINKS,
    type: 'checkbox',
    contexts: ['page'],
    checked: hideReplyLinks,
    title: 'Hide reply links',
    documentUrlPatterns: ['https://news.ycombinator.com/item*'],
  })
})

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId == TOGGLE_REPLY_LINKS) {
    hidingReplyLinks = !hidingReplyLinks
    chrome.storage.local.set({hideReplyLinks: hidingReplyLinks})
  }
})

chrome.storage.local.onChanged.addListener((changes) => {
  if ('hideReplyLinks' in changes) {
    hidingReplyLinks = changes['hideReplyLinks'].newValue
    chrome.contextMenus.update(TOGGLE_REPLY_LINKS, {checked: hidingReplyLinks})
  }
})