const HIGHLIGHT_COLOR = '#ffffde'
const TOGGLE_HIDE = '[–]'
const TOGGLE_SHOW = '[+]'

let config = {
  addUpvotedToHeader: true,
  autoHighlightNew: true,
  hideReplyLinks: false,
}

config.enableDebugLogging = false

//#region Storage
function commentCountKey(itemId) {
  return `${itemId}:cc`
}

function getData(key, defaultValue) {
  let value = localStorage.getItem(key)
  return value != undefined ? value : defaultValue
}

function lastVisitKey(itemId) {
  return `${itemId}:lv`
}

function maxCommentIdKey(itemId) {
  return `${itemId}:mc`
}

function storeData(key, value) {
  localStorage.setItem(key, value)
}
//#endregion

//#region Utility functions
function addStyle(css = '') {
  let $style = document.createElement('style')
  if (css) {
    $style.textContent = css
  }
  document.querySelector('head').appendChild($style)
  return $style
}

function checkbox(attributes, label) {
  return h('label', null,
    h('input', {
      style: {verticalAlign: 'middle'},
      type: 'checkbox',
      ...attributes,
    }),
    ' ',
    label,
  )
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
      $el.insertAdjacentText('beforeend', String(child))
    }
  }

  return $el
}

function log(...args) {
  if (config.enableDebugLogging) {
    console.log('WHY‽', ...args)
  }
}

function s(count, suffixes = ',s') {
  if (!suffixes.includes(',')) {
    suffixes = `,${suffixes}`
  }
  return suffixes.split(',')[count === 1 ? 0 : 1]
}

function toggleDisplay($el, hidden) {
  $el.classList.toggle('noshow', hidden)
}

function toggleVisibility($el, hidden) {
  $el.classList.toggle('nosee', hidden)
}
//#endregion

//#region Feature: add upvoted link to header
function addUpvotedLinkToHeader() {
  if (window.location.pathname == '/upvoted') {
    return
  }

  let $userLink = document.querySelector('span.pagetop a[href^="user?id"]')
  if (!$userLink) {
    return
  }

  let $pageTop = document.querySelector('span.pagetop')
  $pageTop.insertAdjacentText('beforeend', ' | ')
  $pageTop.appendChild(h('a', {
    href: `/upvoted?id=${$userLink.textContent}`,
  }, 'upvoted'))
}
//#endregion

//#region Feature: new comment highlighting on comment pages
/**
 * Each comment on a comment page has the following structure:
 *
 * ```html
 * <tr class="athing"> (wrapper)
 *   <td>
 *     <table>
 *       <tr>
 *         <td class="ind">
 *           <img src="s.gif" height="1" width="123"> (indentation)
 *         </td>
 *         <td class="votelinks">…</td> (vote up/down controls)
 *         <td class="default">
 *           <div> (meta bar: user, age and folding control)
 *           …
 *           <div class="comment">
 *             <span class="comtext"> (text and reply link)
 * ```
 *
 * We want to be able to collapse comment trees which don't contain new comments
 * and highlight new comments, so for each wrapper we'll create a `HNComment`
 * object to manage this.
 *
 * Comments are rendered as a flat list of table rows, so we'll use the width of
 * the indentation spacer to determine which comments are descendants of a given
 * comment.
 *
 * Since we have to reimplement our own comment folding, we'll hide the built-in
 * folding controls and create new ones in a better position (on the left), with
 * a larger hitbox (larger font and an en dash [–] instead of a hyphen [-]).
 *
 * On each comment page view, we store the current comment count, the max
 * comment id on the page and the current time as the last visit time.
 */
function commentPage() {
  log('comment page')

  /** @type {boolean} */
  let autoHighlightNew = config.autoHighlightNew || location.search.includes('?shownew')

  /** @type {number} */
  let commentCount = 0

  /** @type {HNComment[]} */
  let comments = []

  /** @type {Object.<string, HNComment>} */
  let commentsById = {}

  /** @type {boolean} */
  let hasNewComments = false

  /** @type {string} */
  let itemId = /id=(\d+)/.exec(location.search)[1]

  /** @type {number} */
  let lastMaxCommentId = -1

  /** @type {Date} */
  let lastVisit = null

  /** @type {number} */
  let maxCommentId = -1

  /** @type {number} */
  let newCommentCount = 0

  class HNComment {
    /**
     * @param $wrapper {Element}
     * @param index {number}
     */
    constructor($wrapper, index) {
      /** @type {number} */
      this.indent = Number($wrapper.querySelector('img[src="s.gif"]').width)

      /** @type {number} */
      this.index = index

      /** @type {Element} */
      this.$comment = $wrapper.querySelector('div.comment')

      /** @type {Element} */
      this.$topBar = $wrapper.querySelector('td.default > div')

      /** @type {Element} */
      this.$vote = $wrapper.querySelector('td[valign="top"] > center')

      /** @type {Element} */
      this.$wrapper = $wrapper

      /** @private @type {HNComment[]} */
      this._childComments = null

      /**
       * The comment's id.
       * Will be `-1` for deleted comments.
       * @type {number}
       */
      this.id = -1

      /**
       * Some flagged comments are collapsed by default.
       * @type {boolean}
       */
      this.isCollapsed = $wrapper.classList.contains('coll')

      /**
       * Comments whose text has been removed but are still displayed may have
       * their text replaced with [flagged], [dead] or similar - we'll take any
       * word in square brackets as indication of this.
       * @type {boolean}
       */
      this.isDeleted = /^\s*\[\w+]\s*$/.test(this.$comment.firstChild.nodeValue)

      /**
       * The displayed age of the comment; `${n} minutes/hours/days ago`, or
       * `on ${date}` for older comments.
       * Will be blank for deleted comments.
       * @type {string}
       */
      this.when = ''

      /** @type {Element} */
      this.$collapsedChildCount = null

      /** @type {Element} */
      this.$comhead = this.$topBar.querySelector('span.comhead')

      /** @type {Element} */
      this.$toggleControl = h('span', {
        onclick: () => this.toggleCollapsed(),
        style: {cursor: 'pointer'},
      }, this.isCollapsed ? TOGGLE_SHOW : TOGGLE_HIDE)

      if (!this.isDeleted) {
        let $permalink = this.$topBar.querySelector('a[href^=item]')
        this.id = Number($permalink.href.split('=').pop())
        this.when = $permalink.textContent
      }

      this.initDOM()
    }

    initDOM() {
      // We want to use the comment meta bar for the folding control, so put
      // it back above the deleted comment placeholder.
      if (this.isDeleted) {
        this.$topBar.style.marginBottom = '4px'
      }
      if (this.isCollapsed) {
        this._updateDisplay(false)
      }
      this.$topBar.insertAdjacentText('afterbegin', ' ')
      this.$topBar.insertAdjacentElement('afterbegin', this.$toggleControl)
    }

    /**
     * @private
     * @param updateChildren {boolean=}
     */
    _updateDisplay(updateChildren = true) {
      // Show/hide this comment, preserving display of the meta bar
      toggleDisplay(this.$comment, this.isCollapsed)
      if (this.$vote) {
        toggleVisibility(this.$vote, this.isCollapsed)
      }
      this.$toggleControl.textContent = this.isCollapsed ? TOGGLE_SHOW : TOGGLE_HIDE

      // Show/hide the number of child comments when collapsed
      if (this.isCollapsed && this.$collapsedChildCount == null) {
        let collapsedCommentCount = [
          this.isDeleted ? '(' : ' | (',
          this.childComments.length,
          ` child${s(this.childComments.length, 'ren')})`,
        ].join('')
        this.$collapsedChildCount = h('span', null, collapsedCommentCount)
        this.$comhead.appendChild(this.$collapsedChildCount)
      }
      toggleDisplay(this.$collapsedChildCount, !this.isCollapsed)

      // Completely show/hide any child comments
      if (updateChildren) {
        this.childComments.forEach((child) => toggleDisplay(child.$wrapper, this.isCollapsed))
      }
    }

    /**
     * @returns {HNComment[]}
     */
    get childComments() {
      if (this._childComments == null) {
        this._childComments = []
        for (let i = this.index + 1; i < comments.length; i++) {
          if (comments[i].indent <= this.indent) {
            break
          }
          this._childComments.push(comments[i])
        }
      }
      return this._childComments
    }

    /**
     * @param commentId {number}
     * @returns {boolean}
     */
    hasChildCommentsNewerThan(commentId) {
      return this.childComments.some((comment) => comment.isNewerThan(commentId))
    }

    /**
     * @param commentId {number}
     * @returns {boolean}
     */
    isNewerThan(commentId) {
      return this.id > commentId
    }

    /**
     * @param isCollapsed {boolean=}
     */
    toggleCollapsed(isCollapsed = !this.isCollapsed) {
      this.isCollapsed = isCollapsed
      this._updateDisplay()
    }

    /**
     * @param highlight {boolean}
     */
    toggleHighlighted(highlight) {
      this.$wrapper.style.backgroundColor = highlight ? HIGHLIGHT_COLOR : 'transparent'
    }
  }

  /**
   * Adds checkboxes to toggle folding and highlighting when there are new
   * comments on a comment page.
   * @param $container {Element}
   */
  function addNewCommentControls($container) {
    $container.appendChild(
      h('div', null,
        h('p', null,
          `${newCommentCount} new comment${s(newCommentCount)} since ${lastVisit.toLocaleString()}`
        ),
        h('div', null,
          checkbox({
            checked: autoHighlightNew,
            onclick: (e) => {
              highlightNewComments(e.target.checked, lastMaxCommentId)
            },
          }, 'highlight new comments'),
          ' ',
          checkbox({
            checked: autoHighlightNew,
            onclick: (e) => {
              collapseThreadsWithoutNewComments(e.target.checked, lastMaxCommentId)
            },
          }, 'collapse threads without new comments'),
        ),
      )
    )
  }

  /**
   * Adds a range control and button to show the last X new comments.
   */
  function addTimeTravelCommentControls($container) {
    let sortedCommentIds = comments.map((comment) => comment.id)
      .filter(id => id !== -1)
      .sort((a, b) => a - b)

    let showNewCommentsAfter = Math.max(0, sortedCommentIds.length - 1)

    function getButtonLabel() {
      let howMany = sortedCommentIds.length - showNewCommentsAfter
      let fromWhen = commentsById[sortedCommentIds[showNewCommentsAfter]].when
      // Older comments display `on ${date}` instead of a relative time
      if (fromWhen.startsWith(' on')) {
        fromWhen = fromWhen.replace(' on', 'since')
      }
      else {
        fromWhen = `from ${fromWhen}`
      }
      return `highlight ${howMany} comment${s(howMany)} ${fromWhen}`
    }

    let $range = h('input', {
      max: sortedCommentIds.length - 1,
      min: 1,
      oninput(e) {
        showNewCommentsAfter = Number(e.target.value)
        $button.value = getButtonLabel()
      },
      style: {margin: 0, verticalAlign: 'middle'},
      type: 'range',
      value: sortedCommentIds.length - 1,
    })

    let $button = h('input', {
      onclick() {
        let referenceCommentId = sortedCommentIds[showNewCommentsAfter - 1]
        highlightNewComments(true, referenceCommentId)
        collapseThreadsWithoutNewComments(true, referenceCommentId)
        $timeTravelControl.remove()
      },
      type: 'button',
      value: getButtonLabel(),
    })

    let $timeTravelControl = h('div', {
      style: {marginTop: '1em'},
    }, $range, ' ', $button)

    $container.appendChild($timeTravelControl)
  }

  /**
   * Adds the appropriate page controls depending on whether or not there are
   * new comments or any comments at all.
   */
  function addPageControls() {
    let $container = document.querySelector('td.subtext')
    if (!$container) {
      log('no container found for page controls')
      return
    }

    if (hasNewComments) {
      addNewCommentControls($container)
    }
    else if (commentCount > 1) {
      addTimeTravelCommentControls($container)
    }
  }

  /**
   * Collapses threads which don't have any comments newer than the given
   * comment id.
   * @param collapse {boolean}
   * @param referenceCommentId {number}
   */
  function collapseThreadsWithoutNewComments(collapse, referenceCommentId) {
    for (let i = 0; i < comments.length; i++) {
      let comment = comments[i]
      if (!comment.isNewerThan(referenceCommentId) &&
          !comment.hasChildCommentsNewerThan(referenceCommentId)) {
        comment.toggleCollapsed(collapse)
        // Skip over child comments
        i += comment.childComments.length
      }
    }
  }

  function hideBuiltInCommentFoldingControls() {
    addStyle('a.togg { display: none; }')
  }

  let toggleHideReplyLinks = (function() {
    let $style = addStyle()
    return () => {
      $style.textContent = config.hideReplyLinks ? `
        div.reply { margin-top: 8px; }
        div.reply p { display: none; }
      ` : ''
    }
  })()

  /**
   * Highlights comments newer than the given comment id.
   * @param highlight {boolean}
   * @param referenceCommentId {number}
   */
  function highlightNewComments(highlight, referenceCommentId) {
    comments.forEach((comment) => {
      if (comment.isNewerThan(referenceCommentId)) {
        comment.toggleHighlighted(highlight)
      }
    })
  }

  function initComments() {
    let commentWrappers = document.querySelectorAll('table.comment-tree tr.athing')
    log('number of comment wrappers', commentWrappers.length)
    let index = 0
    for (let $wrapper of commentWrappers) {
      let comment = new HNComment($wrapper, index++)
      if (comment.id > maxCommentId) {
        maxCommentId = comment.id
      }
      if (comment.isNewerThan(lastMaxCommentId)) {
        newCommentCount++
      }
      comments.push(comment)
      if (comment.id != -1) {
        commentsById[comment.id] = comment
      }
    }
    hasNewComments = lastVisit != null && newCommentCount > 0
  }

  function storePageViewData() {
    if (maxCommentId > lastMaxCommentId) {
      storeData(maxCommentIdKey(itemId), maxCommentId)
    }
    storeData(lastVisitKey(itemId), new Date().getTime())
    if (commentCount) {
      storeData(commentCountKey(itemId), commentCount)
    }
  }

  lastMaxCommentId = Number(getData(maxCommentIdKey(itemId), '0'))
  let lastVisitTime = getData(lastVisitKey(itemId), null)
  if (lastVisitTime != null) {
    lastVisit = new Date(Number(lastVisitTime))
  }

  let $commentsLink = document.querySelector('td.subtext > a[href^=item]')
  if ($commentsLink && /^\d+/.test($commentsLink.textContent)) {
    commentCount = Number($commentsLink.textContent.split(/\s/).shift())
  }

  hideBuiltInCommentFoldingControls()
  toggleHideReplyLinks()
  initComments()
  if (hasNewComments && autoHighlightNew) {
    highlightNewComments(true, lastMaxCommentId)
    collapseThreadsWithoutNewComments(true, lastMaxCommentId)
  }
  addPageControls()
  storePageViewData()

  log('page view data', {
    autoHighlightNew,
    commentCount,
    itemId,
    lastMaxCommentId,
    lastVisit,
    maxCommentId,
    newCommentCount,
  })

  chrome.storage.onChanged.addListener((changes) => {
    if ('hideReplyLinks' in changes) {
      config.hideReplyLinks = changes['hideReplyLinks'].newValue
      toggleHideReplyLinks()
    }
  })
}
//#endregion

//#region Feature: new comment indicators on link pages
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
 * Using the comment count stored when you visit a comment page, we'll display
 * the number of new comments in the subtext section and provide a link which
 * will automatically highlight new comments and collapse comment trees without
 * new comments.
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

  if (/^($|active|ask|best|front|news|newest|noobstories|show|submitted|upvoted)/.test(path)) {
    page = itemListPage
  }
  else if (/^item/.test(path)) {
    page = commentPage
  }

  if (page) {
    page()
  }
}

chrome.storage.local.get((storedConfig) => {
  Object.assign(config, storedConfig)
  main()
})

chrome.storage.onChanged.addListener((changes) => {
  if ('enableDebugLogging' in changes) {
    config.enableDebugLogging = changes['enableDebugLogging'].newValue
  }
})
//#endregion