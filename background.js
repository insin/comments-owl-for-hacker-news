const TOGGLE_REPLY_LINKS = 'toggle-reply-links'

chrome.runtime.onInstalled.addListener(async () => {
  let {hideReplyLinks} = await chrome.storage.local.get('hideReplyLinks')
  chrome.contextMenus.create({
    id: TOGGLE_REPLY_LINKS,
    type: 'checkbox',
    contexts: ['page'],
    checked: Boolean(hideReplyLinks),
    title: 'Hide reply links',
    documentUrlPatterns: ['https://news.ycombinator.com/item*'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId == TOGGLE_REPLY_LINKS) {
    let {hideReplyLinks} = await chrome.storage.local.get('hideReplyLinks')
    chrome.storage.local.set({hideReplyLinks: !hideReplyLinks})
  }
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area == 'local' && 'hideReplyLinks' in changes) {
    chrome.contextMenus.update(TOGGLE_REPLY_LINKS, {
      checked: Boolean(changes['hideReplyLinks'].newValue)
    })
  }
})