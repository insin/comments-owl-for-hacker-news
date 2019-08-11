let config = {
  addUpvotedToHeader: true,
}

config.enableDebugLogging = false

//#region Utility functions
function commentCountKey(itemId) {
  return `${itemId}:cc`
}

function getData(key, defaultValue) {
  let value = localStorage.getItem(key)
  return value != undefined ? value : defaultValue
}

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

/**
 * Each item on an item list page has the following structure:
 *
 * ```html
 * <tr class="athing">…</td> (rank, upvote control, title/link and domain)
 * <tr>
 *   <td>…</td> (spacer)
 *   <td class="subtext">…</td> (item meta info)
 * </tr>
 * <tr class="spacer">…</tr>
 * ```
 *
 * We want to display the number of new comments in the subtext section and
 * provide a link which will automatically highlight new comments and collapse
 * comment trees without new comments.
 *
 * For regular stories, the subtext element contains points, user, age (in
 * a link to the comments page), flag/hide controls and finally the number of
 * comments (in another link to the comments page). We'll look for the latter
 * to detemine the current number of comments and the item id.
 *
 * For job postings, the subtext element only contains age (in
 * a link to the comments page) and a hide control, so we'll try to ignore
 * those.
 */
function itemListPage() {
  log('item list page')

  let commentLinks = document.querySelectorAll('td.subtext > a[href^="item?id="]:last-child')
  log('number of comments/discuss links', commentLinks.length)

  for (let $commentLink of commentLinks) {
    let id = $commentLink.href.split('=').pop()

    let commentCountMatch = /^(\d+)/.exec($commentLink.textContent)
    if (commentCountMatch == null) {
      log(`${id} doesn't have a comment count`)
      continue
    }

    let lastViewedCommentCount = getData(commentCountKey(id), null)
    if (lastViewedCommentCount == null) {
      log(`${id} doesn't have a last viewed comment count`)
      continue
    }

    let commentCount = Number(commentCountMatch[1])
    let lastCommentCount = Number(lastViewedCommentCount)
    if (commentCount <= lastCommentCount) {
      log(`${id} doesn't have any new comments`)
      continue
    }

    $commentLink.insertAdjacentElement('afterend',
      h('span', null,
        ' (',
        h('a', {
            href: `/item?shownew&id=${id}`,
            style: {fontWeight: 'bold'},
          },
          commentCount - lastCommentCount,
          ' new'
        ),
        ')',
      )
    )
  }
}
//#endregion

//#region Main
function main() {
  log('config', config)

  if (config.addUpvotedToHeader) {
    addUpvotedLinkToHeader()
  }

  let page
  let path = location.pathname.slice(1)

  if (/^($|active|ask|best|front|news|newest|noobstories|show|submitted|upvoted)/.test(path) ||
      /^x/.test(path) && !document.title.startsWith('more comments')) {
    page = itemListPage
  }
  if (page) {
    page()
  }
}

chrome.storage.local.get((storedConfig) => {
  Object.assign(config, storedConfig)
  main()
})
//#endregion