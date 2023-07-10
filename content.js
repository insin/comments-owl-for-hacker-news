// ==UserScript==
// @name        Comments Owl for Hacker News
// @description Highlight new comments, manage users, and other tweaks for Hacker News
// @namespace   https://github.com/insin/hn-comments-owl/
// @match       https://news.ycombinator.com/*
// @version     42
// ==/UserScript==
let debug = false

const HIGHLIGHT_COLOR = '#ffffde'
const TOGGLE_HIDE = '[–]'
const TOGGLE_SHOW = '[+]'

//#region Config
/** @type {import("./types").Config} */
let config = {
  addUpvotedToHeader: true,
  autoCollapseNotNew: true,
  autoHighlightNew: true,
  hideReplyLinks: false,
  listPageFlagging: 'enable',
}
//#endregion

//#region Storage
class Visit {
  constructor({commentCount, maxCommentId, time}) {
    /** @type {number} */
    this.commentCount = commentCount
    /** @type {number} */
    this.maxCommentId = maxCommentId
    /** @type {Date} */
    this.time = time
  }

  toJSON() {
    return {
      c: this.commentCount,
      m: this.maxCommentId,
      t: this.time.getTime(),
    }
  }
}

Visit.fromJSON = function(obj) {
  return new Visit({
    commentCount: obj.c,
    maxCommentId: obj.m,
    time: new Date(obj.t),
  })
}

function getLastVisit(itemId) {
  let json = localStorage.getItem(itemId)
  if (json == null) return null
  return Visit.fromJSON(JSON.parse(json))
}

function storeVisit(itemId, visit) {
  log('storing visit', visit)
  localStorage.setItem(itemId, JSON.stringify(visit))
}

function getMutedUsers() {
  return new Set(JSON.parse(localStorage.mutedUsers || '[]'))
}

function getUserNotes() {
  return JSON.parse(localStorage.userNotes || '{}')
}

function setMutedUsers(mutedUsers) {
  localStorage.mutedUsers = JSON.stringify(Array.from(mutedUsers))
}

function setUserNotes(userNotes) {
  localStorage.userNotes = JSON.stringify(userNotes)
}
//#endregion

//#region Utility functions
/**
 * @param {string} role
 * @param {...string} css
 */
function addStyle(role, ...css) {
  let $style = document.createElement('style')
  $style.dataset.insertedBy = 'comments-owl-for-hn'
  $style.dataset.role = role
  if (css.length > 0) {
    $style.textContent = css.map(dedent).join('\n')
  }
  document.querySelector('head').appendChild($style)
  return $style
}

const autosizeTextArea = (() => {
  /** @type {Number} */
  let textAreaPadding

  return function autosizeTextarea($textArea) {
    if (textAreaPadding == null) {
      textAreaPadding = Number(getComputedStyle($textArea).paddingTop.replace('px', '')) * 2
    }
    $textArea.style.height = '0px'
    $textArea.style.height = $textArea.scrollHeight + textAreaPadding + 'px'
  }
})()

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

/**
 * @param {string} str
 * @return {string}
 */
function dedent(str) {
  str = str.replace(/^[ \t]*\r?\n/, '')
  let indent = /^[ \t]+/m.exec(str)
  if (indent) str = str.replace(new RegExp('^' + indent[0], 'gm'), '')
  return str.replace(/(\r?\n)[ \t]+$/, '$1')
}

/**
 * Create an element.
 * @param {string} tagName
 * @param {{[key: string]: any}} [attributes]
 * @param {...any} children
 * @returns {HTMLElement}
 */
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
  if (debug) {
    console.log('🦉', ...args)
  }
}

/**
 * @param {number} count
 * @param {string} suffixes
 * @returns {string}
 */
function s(count, suffixes = ',s') {
  if (!suffixes.includes(',')) {
    suffixes = `,${suffixes}`
  }
  return suffixes.split(',')[count === 1 ? 0 : 1]
}

/**
 * @param {HTMLElement} $el
 * @param {boolean} hidden
 */
function toggleDisplay($el, hidden) {
  $el.classList.toggle('noshow', hidden)
  // We need to enforce display setting as the page's own script expands all
  // comments on page load.
  $el.style.display = hidden ? 'none' : ''
}

/**
 * @param {HTMLElement} $el
 * @param {boolean} hidden
 */
function toggleVisibility($el, hidden) {
  $el.classList.toggle('nosee', hidden)
  // We need to enforce visibility setting as the page's own script expands
  // all comments on page load.
  $el.style.visibility = hidden ? 'hidden' : 'visible'
}
//#endregion

//#region Feature: add upvoted link to header
function addUpvotedLinkToHeader() {
  if (window.location.pathname == '/upvoted') return

  let $userLink = document.querySelector('span.pagetop a[href^="user?id"]')
  if (!$userLink) return

  let $pageTop = document.querySelector('span.pagetop')
  $pageTop.insertAdjacentText('beforeend', ' | ')
  $pageTop.appendChild(h('a', {
    href: `/upvoted?id=${$userLink.textContent}`,
  }, 'upvoted'))
}
//#endregion

//#region Feature: improved mobile navigation
function improveMobileNav() {
  addStyle('mobile-nav', `
    .desktopnav {
      display: inline;
    }
    .mobilenav {
      display: none;
    }
    @media only screen and (min-width : 300px) and (max-width : 750px) {
      .desktopnav {
        display: none;
      }
      .mobilenav {
        display: revert;
      }
    }
  `)

  let $pageTop = document.querySelector('span.pagetop')
  // Create a new row for mobile nav
  let $mobileNav = /** @type {HTMLTableCellElement} */ ($pageTop.parentElement.cloneNode(true))
  $mobileNav.querySelector('b')?.remove()
  $mobileNav.colSpan = 3
  $pageTop.closest('tbody').append(h('tr', {className: 'mobilenav'}, $mobileNav))
  // Move everything after b.hnname into a wrapper
  $pageTop.appendChild(h('span', {className: 'desktopnav'}, ...Array.from($pageTop.childNodes).slice(1)))
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
 *           <div style="margin-top:2px; margin-bottom:-10px;">
 *             <div class="comhead"> (meta bar: user, age and folding control)
 *             …
 *             <div class="comment">
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
  addStyle('base', `
    .navs {
      display: none;
    }
    a.togg {
      display: none;
    }
    .toggle {
      cursor: pointer;
      margin-right: 3px;
    }
    .mute {
      display: none;
    }
    tr.comtr:hover .mute {
      display: inline;
    }
    @media only screen and (min-width: 300px) and (max-width: 750px) {
      .comment {
        max-width: unset;
      }
      .toggle {
        display: inline-block;
        transform: scale(1.1,1.1);
      }
    }
  `)

  let $style = addStyle('features')

  function configureCss() {
    $style.textContent = [
      config.hideReplyLinks && `
        div.reply { margin-top: 8px; }
        div.reply p { display: none; }
      `
    ].filter(Boolean).map(dedent).join('\n')
  }

  /** @type {boolean} */
  let autoHighlightNew = config.autoHighlightNew || location.search.includes('?shownew')

  /** @type {boolean} */
  let autoCollapseNotNew = config.autoCollapseNotNew || location.search.includes('?shownew')

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

  /** @type {Visit} */
  let lastVisit

  /** @type {number} */
  let maxCommentId = -1

  /** @type {number} */
  let newCommentCount = 0

  /** @type {Set<string>} */
  let mutedUsers = getMutedUsers()

  /** @type {Record<string, string>} */
  let userNotes = getUserNotes()

  class HNComment {
    /**
     * returns {boolean}
     */
    get isMuted() {
      return mutedUsers.has(this.user)
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
     * @returns {HNComment[]}
     */
    get nonMutedChildComments() {
      if (this._nonMutedChildComments == null) {
        let muteIndent = null
        this._nonMutedChildComments = this.childComments.filter(comment => {
          if (muteIndent != null) {
            if (comment.indent > muteIndent) {
              return false
            }
            muteIndent = null
          }

          if (comment.isMuted) {
            muteIndent = comment.indent
            return false
          }

          return true
        })
      }
      return this._nonMutedChildComments
    }

    /**
     * returns {number}
     */
    get childCommentCount() {
      return this.nonMutedChildComments.length
    }

    /**
     * @param {HTMLElement} $wrapper
     * @param {number} index
     */
    constructor($wrapper, index) {
      /** @type {number} */
      this.indent = Number( /** @type {HTMLImageElement} */ ($wrapper.querySelector('img[src="s.gif"]')).width)

      /** @type {number} */
      this.index = index

      let $user = /** @type {HTMLElement} */ ($wrapper.querySelector('a.hnuser'))
      /** @type {string} */
      this.user = $user?.innerText

      /** @type {HTMLElement} */
      this.$comment = $wrapper.querySelector('div.comment')

      /** @type {HTMLElement} */
      this.$topBar = $wrapper.querySelector('td.default > div')

      /** @type {HTMLElement} */
      this.$voteLinks = $wrapper.querySelector('td.votelinks')

      /** @type {HTMLElement} */
      this.$wrapper = $wrapper

      /** @private @type {HNComment[]} */
      this._childComments = null

      /** @private @type {HNComment[]} */
      this._nonMutedChildComments = null

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

      /** @type {HTMLElement} */
      this.$collapsedChildCount = null

      /** @type {HTMLElement} */
      this.$comhead = this.$topBar.querySelector('span.comhead')

      /** @type {HTMLElement} */
      this.$toggleControl = h('span', {
        className: 'toggle',
        onclick: () => this.toggleCollapsed(),
      }, this.isCollapsed ? TOGGLE_SHOW : TOGGLE_HIDE)

      if (!this.isDeleted) {
        let $permalink = /** @type {HTMLAnchorElement} */ (this.$topBar.querySelector('a[href^=item]'))
        this.id = Number($permalink.href.split('=').pop())
        this.when = $permalink?.textContent.replace('minute', 'min')
      }

      this.initDOM()
    }

    initDOM() {
      // We want to use the comment meta bar for the folding control, so put
      // it back above the deleted comment placeholder.
      if (this.isDeleted) {
        this.$topBar.style.marginBottom = '4px'
      }
      this.$topBar.insertAdjacentText('afterbegin', ' ')
      this.$topBar.insertAdjacentElement('afterbegin', this.$toggleControl)
      this.$comhead.append(...[
        // User note
        userNotes[this.user] && h('span', {className: 'note'},
          ` | note: ${userNotes[this.user].split(/\r?\n/)[0]}`,
        ),
        // Mute control
        h('span', {className: 'mute'}, ' | ', h('a', {
          href: `mute?id=${this.user}`,
          onclick: (e) => {
            e.preventDefault()
            this.mute()
          }
        }, 'mute'))
      ].filter(Boolean))
    }

    mute() {
      if (this.user) {
        mutedUsers.add(this.user)
        setMutedUsers(mutedUsers)
        invalidateMuteCaches()
        hideMutedUsers()
      }
    }

    /**
     * @param {boolean} updateChildren
     */
    updateDisplay(updateChildren = true) {
      // Show/hide this comment, preserving display of the meta bar
      toggleDisplay(this.$comment, this.isCollapsed)
      if (this.$voteLinks) {
        toggleVisibility(this.$voteLinks, this.isCollapsed)
      }
      this.$toggleControl.textContent = this.isCollapsed ? TOGGLE_SHOW : TOGGLE_HIDE

      // Show/hide the number of child comments when collapsed
      if (this.isCollapsed && this.$collapsedChildCount == null) {
        let collapsedCommentCount = [
          this.isDeleted ? '(' : ' | (',
          this.childCommentCount,
          ` child${s(this.childCommentCount, 'ren')})`,
        ].join('')
        this.$collapsedChildCount = h('span', null, collapsedCommentCount)
        this.$comhead.appendChild(this.$collapsedChildCount)
      }
      toggleDisplay(this.$collapsedChildCount, !this.isCollapsed)

      // Completely show/hide any child comments
      if (updateChildren) {
        this.childComments.forEach((child) => {
          if (!child.isMuted) {
            toggleDisplay(child.$wrapper, this.isCollapsed)
          }
        })
      }
    }

    hide() {
      toggleDisplay(this.$wrapper, true)
      this.childComments.forEach((child) => toggleDisplay(child.$wrapper, true))
    }

    /**
     * @param {number} commentId
     * @returns {boolean}
     */
    hasChildCommentsNewerThan(commentId) {
      return this.nonMutedChildComments.some((comment) => comment.isNewerThan(commentId))
    }

    /**
     * @param {number} commentId
     * @returns {boolean}
     */
    isNewerThan(commentId) {
      return this.id > commentId
    }

    /**
     * @param {boolean} isCollapsed
     */
    toggleCollapsed(isCollapsed = !this.isCollapsed) {
      this.isCollapsed = isCollapsed
      this.updateDisplay()
    }

    /**
     * @param {boolean} highlight
     */
    toggleHighlighted(highlight) {
      this.$wrapper.style.backgroundColor = highlight ? HIGHLIGHT_COLOR : 'transparent'
    }
  }

  /**
   * Adds checkboxes to toggle folding and highlighting when there are new
   * comments on a comment page.
   * @param {HTMLElement} $container
   */
  function addNewCommentControls($container) {
    $container.appendChild(
      h('div', null,
        h('p', null,
          `${newCommentCount} new comment${s(newCommentCount)} since ${lastVisit.time.toLocaleString()}`
        ),
        h('div', null,
          checkbox({
            checked: autoHighlightNew,
            onclick: (e) => {
              highlightNewComments(e.target.checked, lastVisit.maxCommentId)
            },
          }, 'highlight new comments'),
          ' ',
          checkbox({
            checked: autoCollapseNotNew,
            onclick: (e) => {
              collapseThreadsWithoutNewComments(e.target.checked, lastVisit.maxCommentId)
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
    let howMany = sortedCommentIds.length - showNewCommentsAfter

    function getButtonLabel() {
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
        howMany = sortedCommentIds.length - showNewCommentsAfter
        $button.value = getButtonLabel()
      },
      style: {margin: 0, verticalAlign: 'middle'},
      type: 'range',
      value: sortedCommentIds.length - 1,
    })

    let $button = /** @type {HTMLInputElement} */ (h('input', {
      onclick() {
        let referenceCommentId = sortedCommentIds[showNewCommentsAfter - 1]
        log(`manually highlighting ${howMany} comments since ${referenceCommentId}`)
        highlightNewComments(true, referenceCommentId)
        collapseThreadsWithoutNewComments(true, referenceCommentId)
        $timeTravelControl.remove()
      },
      type: 'button',
      value: getButtonLabel(),
    }))

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
    let $container = /** @type {HTMLElement} */ (document.querySelector('td.subtext'))
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
   * @param {boolean} collapse
   * @param {number} referenceCommentId
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

  function hideMutedUsers() {
    for (let i = 0; i < comments.length; i++) {
      let comment = comments[i]
      if (comment.isMuted) {
        comment.hide()
        // Skip over child comments
        i += comment.childComments.length
      }
    }
  }

  function invalidateMuteCaches() {
    comments.forEach(comment => comment._nonMutedChildComments = null)
  }

  /**
   * Highlights comments newer than the given comment id.
   * @param {boolean} highlight
   * @param {number} referenceCommentId
   */
  function highlightNewComments(highlight, referenceCommentId) {
    comments.forEach((comment) => {
      if (!comment.isMuted && comment.isNewerThan(referenceCommentId)) {
        comment.toggleHighlighted(highlight)
      }
    })
  }

  function initComments() {
    let commentWrappers = /** @type {NodeListOf<HTMLTableRowElement>} */ (document.querySelectorAll('table.comment-tree tr.athing'))
    log('number of comment wrappers', commentWrappers.length)
    let index = 0
    let lastMaxCommentId = lastVisit != null ? lastVisit.maxCommentId : -1
    for (let $wrapper of commentWrappers) {
      let comment = new HNComment($wrapper, index++)

      comments.push(comment)

      if (comment.id != -1) {
        commentsById[comment.id] = comment
      }

      if (comment.id > maxCommentId) {
        maxCommentId = comment.id
      }

      if (!comment.isMuted && comment.isNewerThan(lastMaxCommentId)) {
        newCommentCount++
      }
    }
    hasNewComments = lastVisit != null && newCommentCount > 0
  }

  // TODO Only store visit data when the item header is present (i.e. not a comment permalink)
  // TODO Only store visit data for commentable items (a reply box / reply links are visible)
  // TODO Clear any existing stored visit if the item is no longer commentable
  function storePageViewData() {
    storeVisit(itemId, new Visit({
      commentCount,
      maxCommentId,
      time: new Date(),
    }))
  }

  lastVisit = getLastVisit(itemId)

  let $commentsLink = document.querySelector('span.subline > a[href^=item]')
  if ($commentsLink && /^\d+/.test($commentsLink.textContent)) {
    commentCount = Number($commentsLink.textContent.split(/\s/).shift())
  } else {
    log('number of comments link not found')
  }

  configureCss()
  initComments()
  comments.filter(comment => comment.isCollapsed).forEach(comment => comment.updateDisplay(false))
  if (hasNewComments && autoHighlightNew) {
    if (autoHighlightNew) {
      highlightNewComments(true, lastVisit.maxCommentId)
    }
    if (autoCollapseNotNew) {
      collapseThreadsWithoutNewComments(true, lastVisit.maxCommentId)
    }
  }
  hideMutedUsers()
  addPageControls()
  storePageViewData()

  log('page view data', {
    autoHighlightNew,
    commentCount,
    hasNewComments,
    itemId,
    lastVisit,
    maxCommentId,
    newCommentCount,
  })

  chrome.storage.onChanged.addListener((changes) => {
    if ('hideReplyLinks' in changes) {
      config.hideReplyLinks = changes['hideReplyLinks'].newValue
      configureCss()
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
 *   <td class="subtext">
 *     <span class="subline">…</span> (item meta info)
 *   </td>
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
  let $style = addStyle('features')

  function configureCss() {
    $style.textContent = [
      // Hide flag links
      config.listPageFlagging == 'disable' && `
        a[href^="flag"], a[href^="flag"] + span {
          display: none;
        }
      `
    ].filter(Boolean).map(dedent).join('\n')
  }

  function confirmFlag(e) {
    if (config.listPageFlagging != 'confirm') return
    let title = e.target.closest('tbody').querySelector('.titleline a')?.textContent || 'this item'
    if (!confirm(`Are you sure you want to flag ${title}?`)) {
      e.preventDefault()
    }
  }

  for (let $flagLink of document.querySelectorAll('span.subline > a[href^="flag"]')) {
    // Wrap the '|' after flag links in an element so they can be hidden
    $flagLink.nextSibling.replaceWith(h('span', null, ' | '))
    $flagLink.addEventListener('click', confirmFlag)
  }

  let commentLinks = /** @type {NodeListOf<HTMLAnchorElement>} */ (document.querySelectorAll('span.subline > a[href^="item?id="]:last-child'))
  log('number of comments/discuss links', commentLinks.length)

  let noCommentsCount = 0
  let noLastVisitCount = 0

  for (let $commentLink of commentLinks) {
    let id = $commentLink.href.split('=').pop()

    let commentCountMatch = /^(\d+)/.exec($commentLink.textContent)
    if (commentCountMatch == null) {
      noCommentsCount++
      continue
    }

    let lastVisit = getLastVisit(id)
    if (lastVisit == null) {
      noLastVisitCount++
      continue
    }

    let commentCount = Number(commentCountMatch[1])
    if (commentCount <= lastVisit.commentCount) {
      log(`${id} doesn't have any new comments`, lastVisit)
      continue
    }

    $commentLink.insertAdjacentElement('afterend',
      h('span', null,
        ' (',
        h('a', {
            href: `/item?shownew&id=${id}`,
            style: {fontWeight: 'bold'},
          },
          commentCount - lastVisit.commentCount,
          ' new'
        ),
        ')',
      )
    )
  }

  if (noCommentsCount > 0) {
    log(`${noCommentsCount} item${s(noCommentsCount, " doesn't,s don't")} have any comments`)
  }
  if (noLastVisitCount > 0) {
    log(`${noLastVisitCount} item${s(noLastVisitCount, " doesn't,s don't")} have a last visit stored`)
  }

  chrome.storage.onChanged.addListener((changes) => {
    if ('listPageFlagging' in changes) {
      config.listPageFlagging = changes['listPageFlagging'].newValue
      configureCss()
    }
  })
}
//#endregion

//#region Feature: mute/unmute users and edit user notes on profile pages
function userProfilePage() {
  log('user profile page')

  let $userLink = /** @type {HTMLAnchorElement} */ (document.querySelector('a.hnuser'))
  if ($userLink == null) {
    log('not a valid user')
    return
  }

  let userId = $userLink.innerText
  let $currentUserLink = /** @type {HTMLAnchorElement} */ (document.querySelector('a#me'))
  let currentUser = $currentUserLink?.innerText ?? ''
  let mutedUsers = getMutedUsers()
  let userNotes = getUserNotes()
  let $tbody = $userLink.closest('table').querySelector('tbody')
  let editingNote = false

  if (userId == currentUser) {
    let first = 0
    mutedUsers.forEach((mutedUserId) => {
      $tbody.appendChild(
        h('tr', null,
          h('td', {valign: 'top'}, first++ == 0 ? 'muted:' : ''),
          h('td', null,
            h('a', {href: `/user?id=${mutedUserId}`}, mutedUserId),
            h('a', {
                href: '#',
                onClick: function(e) {
                  e.preventDefault()
                  if (mutedUsers.has(mutedUserId)) {
                    mutedUsers.delete(mutedUserId)
                    this.firstElementChild.innerText = 'mute'
                  }
                  else {
                    mutedUsers.add(mutedUserId)
                    this.firstElementChild.innerText = 'unmute'
                  }
                  setMutedUsers(mutedUsers)
                }
              },
              ' (', h('u', null, 'unmute'), ')'
            ),
            userNotes[mutedUserId] ? ` - ${userNotes[mutedUserId].split(/\r?\n/)[0]}` : null,
          )
        )
      )
    })
  }
  else {
    $tbody.append(
      h('tr', null,
        h('td'),
        h('td', null,
          h('a', {
              href: '#',
              onClick: function(e) {
                e.preventDefault()
                if (mutedUsers.has(userId)) {
                  mutedUsers.delete(userId)
                  this.firstElementChild.innerText = 'mute'
                }
                else {
                  mutedUsers.add(userId)
                  this.firstElementChild.innerText = 'unmute'
                }
                setMutedUsers(mutedUsers)
              }
            },
            h('u', null, mutedUsers.has(userId) ? 'unmute' : 'mute')
          )
        )
      ),
      h('tr', null,
        h('td', {vAlign: 'top'}, 'notes:'),
        h('td', null,
          userNotes[userId] ? h('div', {style: {whiteSpace: 'pre-line'}}, userNotes[userId] || '') : null,
          h('button', {
            style: {
              marginTop: userNotes[userId] ? '4px' : '0'
            },
            onClick: function(e) {
              e.preventDefault()
              if (!editingNote) {
                let notes = userNotes[userId] || ''
                let $textArea = /** @type {HTMLTextAreaElement} */ (h('textarea', {
                  cols: 60,
                  value: notes,
                  style: {resize: 'none'},
                  onInput() {
                    autosizeTextArea(this)
                  },
                  // Use Ctrl/Cmd + Enter to save
                  onKeydown(e) {
                    if (e.key == 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      this.parentElement.nextElementSibling.click()
                    }
                  }
                }))
                if (this.previousElementSibling) {
                  this.previousElementSibling.replaceWith(h('div', null, $textArea))
                } else {
                  this.insertAdjacentElement('beforebegin', h('div', null, $textArea))
                }
                autosizeTextArea($textArea)
                $textArea.focus()
                $textArea.setSelectionRange(notes.length, notes.length)
                this.innerText = 'save'
                this.style.marginTop = '4px'
              }
              else {
                let notes = this.previousElementSibling.firstElementChild.value
                userNotes[userId] = notes
                setUserNotes(userNotes)
                if (notes) {
                  this.previousElementSibling.replaceWith(
                    h('div', {style: {whiteSpace: 'pre-line'}}, notes)
                  )
                } else {
                  this.previousElementSibling.remove()
                }
                this.innerText = notes ? 'edit' : 'add'
                this.style.marginTop = notes ? '4px' : '0'
              }
              editingNote = !editingNote
            }
          }, userNotes[userId] ? 'edit' : 'add')
        )
      ),
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

  improveMobileNav()

  let path = location.pathname.slice(1)

  if (/^($|active|ask|best|flagged|front|news|newest|noobstories|show|submitted|upvoted)/.test(path)) {
    itemListPage()
  }
  else if (/^item/.test(path)) {
    commentPage()
  }
  else if (/^user/.test(path)) {
    userProfilePage()
  }
}

if (
  typeof GM == 'undefined' &&
  typeof chrome != 'undefined' &&
  typeof chrome.storage != 'undefined'
) {
  chrome.storage.local.get((storedConfig) => {
    Object.assign(config, storedConfig)
    main()
  })
}
else {
  main()
}
//#endregion