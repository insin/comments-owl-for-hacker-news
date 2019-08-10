let config = {
  addUpvotedToHeader: true,
}

config.enableDebugLogging = false

//#region Utility functions
function h(tagName, attributes, ...children) {
  let $el = document.createElement(tagName)

  if (attributes) {
    for (let [prop, value] of Object.entries(attributes)) {
      if (prop.indexOf('on') === 0) {
        $el.addEventListener(prop.slice(2).toLowerCase(), value)
      }
      else if (prop.toLowerCase() == 'style') {
        for (let [styleProp, styleValue] of Object.entries(value)) {
          $el.style[styleProp] = styleValue
        }
      }
      else {
        $el[prop] = value
      }
    }
  }

  for (let child of children) {
    if (child == null || child === false) {
      continue
    }
    if (child instanceof Node) {
      $el.appendChild(child)
    }
    else {
      $el.appendChild(t(child))
    }
  }

  return $el
}

function log(...args) {
  if (config.enableDebugLogging) {
    console.log('WHY‽', ...args)
  }
}

function t(text) {
  return document.createTextNode(String(text))
}
//#endregion

//#region Disruptive innovations
function addUpvotedLinkToHeader() {
  if (window.location.pathname == '/upvoted') {
    return
  }

  let $userLink = document.querySelector('span.pagetop a[href^="user?id"]')
  if (!$userLink) {
    return
  }

  let $pageTop = document.querySelector('span.pagetop')
  $pageTop.appendChild(t(' | '))
  $pageTop.appendChild(h('a', {
    href: `/upvoted?id=${$userLink.textContent}`,
  }, 'upvoted'))
}
//#endregion

//#region Main
function main() {
  log('config', config)

  if (config.addUpvotedToHeader) {
    addUpvotedLinkToHeader()
  }
}

chrome.storage.local.get((storedConfig) => {
  Object.assign(config, storedConfig)
  main()
})
//#endregion