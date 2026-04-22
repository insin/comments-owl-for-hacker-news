const IS_SAFARI = navigator.userAgent.includes('Safari/') && !/Chrom(e|ium)\//.test(navigator.userAgent)
const MUTED_USERS_KEY = 'mutedUsers'
const TOGGLE_HIDE = '[–]'
const TOGGLE_SHOW = '[+]'
const USER_NOTES_KEY = 'userNotes'

const HN_LOGO_SVG = `
<svg id="hnlogo" xmlns="http://www.w3.org/2000/svg" height="18" viewBox="4 4 188 188" width="18" style="border: 1px solid #fff;">
  <path d="m4 4h188v188h-188z" fill="#f60"/>
  <path d="m73.2521756 45.01 22.7478244 47.39130083 22.7478244-47.39130083h19.56569631l-34.32352071 64.48661468v41.49338532h-15.98v-41.49338532l-34.32352071-64.48661468z" fill="#fff"/>
</svg>
`.trim()

const LOGGED_OUT_USER_PAGE = `
<head op="muted">
  <meta name="referrer" content="origin">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" type="text/css" href="news.css">
  <link rel="icon" href="y18.svg">
  <title>Muted | Comments Owl for Hacker News</title>
</head>
<body>
  <center>
    <table id="hnmain" width="85%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f6f6ef">
      <tbody>
        <tr>
          <td bgcolor="#ff6600">
            <table style="padding: 2px" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tbody>
                <tr>
                  <td style="width: 18px; padding-right: 4px">
                    <a href="https://news.ycombinator.com">
                      <img src="y18.svg" style="border: 1px white solid; display: block" width="18" height="18">
                    </a>
                  </td>
                  <td style="line-height: 12pt; height: 10px">
                    <span class="pagetop"><b class="hnname"><a href="news">Hacker News</a></b>
                      <a href="newest">new</a> | <a href="front">past</a> | <a href="newcomments">comments</a> | <a href="ask">ask</a> | <a href="show">show</a> | <a href="jobs">jobs</a>
                    </span>
                  </td>
                  <td style="text-align: right; padding-right: 4px">
                    <span class="pagetop">
                      <a href="login?goto=news">login</a>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
        <tr style="height: 10px"></tr>
        <tr id="bigbox">
          <td>
            <table border="0">
              <tbody>
                <tr class="athing">
                  <td valign="top">user:</td>
                  <td>
                    <a class="hnuser">anonymous comments owl user</a>
                  </td>
                </tr>
              </tbody>
            </table>
            <br><br>
          </td>
        </tr>
      </tbody>
    </table>
  </center>
</body>
`.trim()

//#region User settings
let debug = localStorage.debug == 'true'
/** @type {import("./types").Config} */
let config
/** @type {import("./types").Config} */
let defaultConfig
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

/** @param {string} itemId */
function getLastVisit(itemId) {
  let parsed = parseStoredJSON(localStorage, itemId)
  return isObject(parsed) ? Visit.fromJSON(parsed) : null
}

/** @returns {Set<string>} */
function getMutedUsers(json = localStorage.getItem(MUTED_USERS_KEY)) {
  let parsed = safeParseJSON(json)
  return new Set(Array.isArray(parsed) ? parsed : [])
}

/** @returns {Record<string, string>} */
function getUserNotes(json = localStorage.getItem(USER_NOTES_KEY)) {
  let parsed =  safeParseJSON(json)
  return isObject(parsed) ? parsed : {}
}

/** @param {Set<string>} mutedUsers */
function storeMutedUsers(mutedUsers) {
  localStorage.setItem(MUTED_USERS_KEY, JSON.stringify(Array.from(mutedUsers)))
}

/** @param {Record<string, string>} userNotes */
function storeUserNotes(userNotes) {
  localStorage.setItem(USER_NOTES_KEY, JSON.stringify(userNotes))
}

/**
 * @param {string} itemId
 * @param {Visit} visit
 */
function storeVisit(itemId, visit) {
  log('storing visit', visit)
  localStorage.setItem(itemId, JSON.stringify(visit))
}
//#endregion

//#region Utility functions
/**
 * @param {string} role
 * @param {...string} css
 */
function addStyle(role, ...css) {
  let $style = document.createElement('style')
  $style.setAttribute('inserted-by', 'comments-owl')
  $style.setAttribute('role', role)
  if (css.length > 0) {
    $style.textContent = css.filter(Boolean).map(dedent).join('\n')
  }
  document.documentElement.appendChild($style)
  return $style
}

const autosizeTextArea = (() => {
  /** @type {Number} */
  let textAreaPadding

  return function autosizeTextArea($textArea) {
    if (!$textArea.offsetParent) return
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

function createRegExp(source) {
  let lines = source.split('\n')
  let parts = []
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    parts.push(`(?:${line})`)
  }
  return new RegExp(parts.join('|'), 'i')
}

/** @param {string} str */
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
      if (prop.indexOf('on') == 0) {
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

function isObject(maybeObj) {
  return maybeObj != null && Object.getPrototypeOf(maybeObj) === Object.prototype
}

function log(...args) {
  if (debug) {
    if (loading) {
      console.log(Date.now() - startMs, '🦉', ...args)
    } else {
      console.log('🦉', ...args)
    }
  }
}

/**
 * @param {Storage} storage
 * @param {string} key
 */
function parseStoredJSON(storage, key) {
  return safeParseJSON(storage.getItem(key))
}

/**
 * @param {number} count
 * @param {string} suffixes
 */
function s(count, suffixes = ',s') {
  if (!suffixes.includes(',')) {
    suffixes = `,${suffixes}`
  }
  return suffixes.split(',')[count == 1 ? 0 : 1]
}

/** @param {string | null} json */
function safeParseJSON(json) {
  if (json) {
    try {
      return JSON.parse(json)
    } catch {}
  }
  return null
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

function warn(...args) {
  if (debug) {
    if (loading) {
      console.log(Date.now() - startMs, '❗', ...args)
    } else {
      console.log('❗', ...args)
    }
  }
}
//#endregion

//#region Page handlers
//#region Item page
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
function itemPage() {
  if (document.body.childElementCount == 0 &&
      document.body.textContent.includes('No such item')) {
    warn('invalid item')
    document.documentElement.setAttribute('unstyled', '')
    return
  }

  //#region CSS
  addStyle('comments-static', `
    /* Remove 1px gap between comments */
    .comment-tree {
      border-collapse: collapse;
    }
    /* Hide built-in toggles */
    a.togg {
      display: none;
    }
    .toggle {
      cursor: pointer;
      background: transparent;
      border: 0;
      padding: 0;
      color: inherit;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      transition: color .15s ease;
    }
    /* Only show mute control at mobile widths */
    .mute {
      display: none;
    }
    /* Don't show notes on collapsed comments */
    td.votelinks.nosee + td .note {
      display: none;
    }
    #timeTravel {
      margin-top: 1em;
      vertical-align: middle;
    }
    #timeTravelRange {
      width: 100%;
    }
    #timeTravelButton {
      font-family: inherit;
      margin-right: 1em;
    }

    @media only screen and (min-width: 300px) and (max-width: 750px) {
      td.votelinks:not(.nosee) + td .mute {
        display: inline;
      }
      /* Allow comments to go full-width */
      .comment {
        max-width: unset;
      }
      /* Increase distance between upvote and downvote */
      a[id^="down_"] {
        margin-top: 16px;
      }
      /* Increase hit-target */
      .toggle {
        font-size: 14px;
      }
      #highlightControls label {
        display: block;
      }
      #highlightControls label + label {
        margin-top: .5rem;
      }
      #timeTravelRange {
        width: calc(100% - 32px);
      }
    }
  `)

  let $style = addStyle('comments-dynamic')

  function configureCss() {
    $style.textContent = [
      config.clickHeaderToCollapse && `
        /* Make comments full width so the comment header can always be clicked */
        .comment-tree,
        .comment-tree td.default {
          width: 100%;
        }
        .comhead-wrap {
          /* Negative margin gets removed from the click target in some browsers */
          margin-bottom: .5em !important;
          /* Hide the <br> the negative margin was adjusting for */
          + br {
            display: none;
          }
          /* Indicate when clicking will activate the toggle */
          &:hover .toggle {
            color: var(--link);
          }
        }
        .comhead:hover .toggle {
          color: inherit;
        }
        .comhead .toggle:hover {
          color: var(--link);
        }
      `,
      config.hideReplyLinks && `
        div.reply {
          margin-top: 8px;
        }
        div.reply p, #submission-reply {
          display: none;
        }
      `,
      config.makeSubmissionTextReadable && `
        div.toptext {
          color: var(--text-primary);
          a:link {
            text-decoration: underline;
          }
        }
      `,
    ].filter(Boolean).map(dedent).join('\n')
  }

  configureCss()
  //#endregion

  //#region State
  let autoCollapseNotNew = config.autoCollapseNotNew || location.search.includes('?shownew')
  let autoHighlightNew = config.autoHighlightNew || location.search.includes('?shownew')
  /** @type {HNComment[]} */
  let comments = []
  /** @type {Record<string, HNComment>} */
  let commentsById = {}
  let commentCount = 0
  /** @type {FocusedComment} */
  let focusedComment
  let hasNewComments = false
  let itemId = /id=(\d+)/.exec(location.search)[1]
  /** @type {Visit} */
  let lastVisit
  /** @type {number} */
  let maxCommentId
  let mutedCommentCount = 0
  /** @type {Set<string>} */
  let mutedUsers = getMutedUsers()
  let newCommentCount = 0
  let replyToMutedCommentCount = 0
  /** @type {Record<string, string>} */
  let userNotes = getUserNotes()

  /** @type {Element} */
  let $submission
  /**
   * Submission element containing either the comment count or "discuss"
   * @type {Element}
   */
  let $submissionCommentCount
  //#endregion

  //#region Classes
  class HNComment {
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
      this.$note = h('span', {className: 'note'})
      this.updateNote()

      /** @type {HTMLElement} */
      this.$topBar = $wrapper.querySelector('td.default > div')

      /** @type {HTMLElement} */
      this.$voteLinks = $wrapper.querySelector('td.votelinks')

      /** @type {HTMLElement} */
      this.$wrapper = $wrapper

      /** @type {HNComment[]} */
      this._childComments = null

      /** @type {HNComment[]} */
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

      /** @type {boolean} */
      this.isHighlighted = false

      /**
       * Comments whose text has been removed but are still displayed may have
       * their text replaced with [flagged], [dead] or similar - we'll take any
       * word in square brackets as indication of this.
       * e.g. https://news.ycombinator.com/item?id=1942859 has a [deleted] comment
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
      this.$childCount = null

      /** @type {HTMLElement} */
      this.$comhead = this.$topBar.querySelector('span.comhead')

      /** @type {HTMLElement} */
      this.$toggleControl = h('button', {
        className: 'toggle',
        onclick: () => this.toggleCollapsed(),
      }, this.isCollapsed ? TOGGLE_SHOW : TOGGLE_HIDE)

      if (!this.isDeleted) {
        let $permalink = /** @type {HTMLAnchorElement} */ (this.$topBar.querySelector('a[href^=item]'))
        this.id = Number($permalink.href.split('=').pop())
        this.when = $permalink?.textContent.replace('minute', 'min')
      }

      this.$comhead?.parentElement.classList.add('comhead-wrap')
      this.$comhead?.parentElement.addEventListener('click', (e) => {
        if (!config.clickHeaderToCollapse) return
        if (e.target !== e.currentTarget) return
        this.toggleCollapsed()
      })
    }

    get isMuted() {
      return mutedUsers.has(this.user)
    }

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

    get collapsedChildrenText() {
      return this.childCommentCount == 0 ? '' : [
        this.isDeleted ? '(' : ' | (',
        this.childCommentCount,
        ` child${s(this.childCommentCount, 'ren')})`,
      ].join('')
    }

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

    get childCommentCount() {
      return this.nonMutedChildComments.length
    }

    addControls() {
      this.$comhead.insertAdjacentText('afterbegin', ' ')
      this.$comhead.insertAdjacentElement('afterbegin', this.$toggleControl)
      this.$comhead.append(this.$note)
      if (this.user && this.user != currentUser) {
        this.$comhead.append(
          h('span', {className: 'mute'}, ' | ', h('a', {
            href: `mute?id=${this.user}`,
            onclick: (e) => {
              e.preventDefault()
              if (confirm(`Are you sure you want to mute "${this.user}"?`)) {
                muteUser(this.user)
              }
            }
          }, 'mute'))
        )
      }
    }

    updateDisplay({excludeChildren = false} = {}) {
      // Show/hide this comment, preserving display of the meta bar
      toggleDisplay(this.$comment, this.isCollapsed)
      if (this.$voteLinks) {
        toggleVisibility(this.$voteLinks, this.isCollapsed)
      }
      this.$toggleControl.textContent = this.isCollapsed ? TOGGLE_SHOW : TOGGLE_HIDE

      // Show/hide the number of child comments when collapsed
      if (this.childCommentCount > 0) {
        if (this.isCollapsed && this.$childCount == null) {
          this.$childCount = h('span', null, this.collapsedChildrenText)
          this.$comhead.appendChild(this.$childCount)
        }
        toggleDisplay(this.$childCount, !this.isCollapsed)
      }

      if (!excludeChildren) {
        for (let i = 0; i < this.nonMutedChildComments.length; i++) {
          let child = this.nonMutedChildComments[i]
          toggleDisplay(child.$wrapper, this.isCollapsed)
          if (child.isCollapsed) {
            i += child.childComments.length
          }
        }
      }
    }

    updateNote() {
      this.$note.textContent = userNotes[this.user] ? ` | nb: ${userNotes[this.user].split(/\r?\n/)[0]}` : ''
    }

    /**
     * Completely hides this comment and its replies.
     */
    hide() {
      toggleDisplay(this.$wrapper, true)
      this.childComments.forEach((child) => toggleDisplay(child.$wrapper, true))
    }

    /** @param {number} commentId */
    hasChildCommentsNewerThan(commentId) {
      return this.nonMutedChildComments.some((comment) => comment.isNewerThan(commentId))
    }

    /** @param {number} commentId */
    isNewerThan(commentId) {
      return this.id > commentId
    }

    /** @param {boolean} isCollapsed */
    toggleCollapsed(isCollapsed = !this.isCollapsed) {
      this.isCollapsed = isCollapsed
      this.updateDisplay()
    }

    /**
     * @param {boolean} highlight
     */
    toggleHighlighted(highlight) {
      this.$wrapper.classList.toggle('new', highlight)
      this.isHighlighted = highlight
    }
  }

  class FocusedComment {
    /**  @param {HTMLElement} $wrapper */
    constructor($wrapper) {
      let $user = /** @type {HTMLElement} */ ($wrapper.querySelector('a.hnuser'))
      /** @type {string} */
      this.user = $user?.innerText

      /** @type {HTMLElement} */
      this.$note = h('span', {className: 'note'})
      this.updateNote()

      let $comhead = $wrapper.querySelector('td.default > div span.comhead')
      if ($comhead) {
        $comhead.append(this.$note)
      }
    }

    updateNote() {
      this.$note.textContent = userNotes[this.user] ? ` | nb: ${userNotes[this.user].split(/\r?\n/)[0]}` : ''
    }
  }
  //#endregion

  //#region Functions
  function addHighlightRecentCommentsControl($container) {
    let $highlightComments = h('span', null, ' | ', h('a', {
      href: '#',
      onClick(e) {
        e.preventDefault()
        addTimeTravelCommentControls($container)
      },
    }, 'highlight recent'))

    $container.querySelector('.subline')?.append($highlightComments)
  }

  /**
   * Adds checkboxes to toggle folding and highlighting when there are new
   * comments on a comment page.
   * @param {HTMLElement} $container
   */
  function addNewCommentControls($container) {
    $container.appendChild(
      h('div', {id: 'new-comments-controls'},
        h('p', null,
          `${newCommentCount} new comment${s(newCommentCount)} since ${lastVisit.time.toLocaleString()}`
        ),
        h('div', {id: 'highlightControls'},
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
   * Adds the appropriate page controls depending on whether or not there are
   * new comments or any comments at all.
   */
  function addSubmissionPageControls() {
    let $container = /** @type {HTMLElement} */ (document.querySelector('td.subtext'))
    if (!$container) {
      warn('no container found for submission controls')
      return
    }
    if (hasNewComments) {
      addNewCommentControls($container)
    }
    if (commentCount > 1) {
      addHighlightRecentCommentsControl($container)
    }
  }

  /**
   * Adds a range control and button to show the last X new comments.
   */
  function addTimeTravelCommentControls($container) {
    if (document.querySelector('#timeTravel')) return

    let sortedCommentIds = []
    for (let i = 0; i < comments.length; i++) {
      let comment = comments[i]
      if (comment.isMuted) {
        // Skip muted comments and their replies as they're always hidden
        i += comment.childComments.length
        continue
      }
      sortedCommentIds.push(comment.id)
    }
    sortedCommentIds.sort()

    let showNewCommentsAfter = Math.max(0, sortedCommentIds.length - 1)
    let howMany = sortedCommentIds.length - showNewCommentsAfter

    function getRangeDescription() {
      let fromWhen = commentsById[sortedCommentIds[showNewCommentsAfter]].when
      // Older comments display `on ${date}` instead of a relative time
      if (fromWhen.startsWith(' on')) {
        fromWhen = fromWhen.replace(' on', 'since')
      } else {
        fromWhen = `from ${fromWhen}`
      }
      return `${howMany} ${fromWhen}`
    }

    let $description = h('span', null, getRangeDescription())

    let $range = h('input', {
      id: 'timeTravelRange',
      max: sortedCommentIds.length - 1,
      min: 1,
      oninput(e) {
        showNewCommentsAfter = Number(e.target.value)
        howMany = sortedCommentIds.length - showNewCommentsAfter
        $description.textContent = getRangeDescription()
      },
      type: 'range',
      value: sortedCommentIds.length - 1,
    })

    let $button = /** @type {HTMLInputElement} */ (h('input', {
      id: 'timeTravelButton',
      onclick() {
        let referenceCommentId = sortedCommentIds[showNewCommentsAfter - 1]
        log(`highlighting ${howMany} comment${s(howMany)} since ${referenceCommentId}`)
        highlightNewComments(true, referenceCommentId)
        collapseThreadsWithoutNewComments(true, referenceCommentId)
        $timeTravelControl.remove()
        document.querySelector('#new-comments-controls')?.remove()
      },
      type: 'button',
      value: 'highlight recent',
    }))

    let $timeTravelControl = h('div', {
      id: 'timeTravel',
    }, h('div', null, $range), $button, $description)

    $container.appendChild($timeTravelControl)
  }

  /**
   * Toggles collapsing threads which don't have any comments newer than the
   * given comment id.
   * @param {boolean} collapse
   * @param {number} referenceCommentId
   */
  function collapseThreadsWithoutNewComments(collapse, referenceCommentId) {
    for (let i = 0; i < comments.length; i++) {
      let comment = comments[i]
      if (comment.isMuted) {
        // Skip muted comments and their replies as they're always hidden
        i += comment.childComments.length
        continue
      }
      let shouldToggleCollapse = !comment.isNewerThan(referenceCommentId) &&
                                 !comment.hasChildCommentsNewerThan(referenceCommentId)
      if (shouldToggleCollapse) {
        comment.toggleCollapsed(collapse)
        // Skip replies as we've already checked them
        i += comment.childComments.length
      }
      else if (comment.isCollapsed) {
        // Expand comments which are collapsed but should no longer be
        comment.toggleCollapsed(false)
      }
    }
  }

  function hideMutedUsers() {
    for (let i = 0; i < comments.length; i++) {
      let comment = comments[i]
      if (comment.isMuted) {
        comment.hide()
        // Skip replies as hide() already hid them
        i += comment.childComments.length
      }
    }
  }

  function toggleHideSubmissionCommentForm() {
    if (!$submission) return
    let $form = document.querySelector('form[action="comment"]')
    if (!$form) return
    let $cell = $form.closest('td')
    if (!$cell) return
    let $reply = $cell.querySelector('#submission-reply')
    if (config.hideSubmissionCommentForm) {
      if (!$reply) {
         $reply = h('font', {id: 'submission-reply', size: '1'},
          h('u', null,
            h('a', {href: '#', onclick(e) {
              e.preventDefault()
              $form.removeAttribute('hidden')
              $reply.remove()
            }},
              'reply'
            )
          )
        )
        $cell.append($reply)
      }
      $form.setAttribute('hidden', '')
    } else {
      if ($reply) {
        $reply.remove()
      }
      $form.removeAttribute('hidden')
    }
  }

  /**
   * Toggles highlighting comments newer than the given comment id.
   * @param {boolean} highlight
   * @param {number} referenceCommentId
   */
  function highlightNewComments(highlight, referenceCommentId) {
    for (let i = 0; i < comments.length; i++) {
      let comment = comments[i]
      if (comment.isMuted) {
        // Skip muted comments and their replies as they're always hidden
        i += comment.childComments.length
        continue
      }
      let shouldHighlight = comment.isNewerThan(referenceCommentId)
      if (shouldHighlight) {
        comment.toggleHighlighted(highlight)
      }
      else if (comment.isHighlighted) {
        // Un-highlight comments which are highlighted but should no longer be
        comment.toggleHighlighted(false)
      }
    }
  }

  function muteUser(user) {
    mutedUsers = getMutedUsers()
    mutedUsers.add(user)
    storeMutedUsers(mutedUsers)
    updateMutedUsersDisplay()
  }

  function processCommentThread() {
    let commentWrappers = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.comment-tree tr.athing'))
    log(commentWrappers.length, `comment element${s(commentWrappers.length)}`)

    let commentIndex = 0
    for (let $wrapper of commentWrappers) {
      let comment = new HNComment($wrapper, commentIndex++)
      comments.push(comment)
      if (!comment.isMuted && !comment.isDeleted) {
        commentsById[comment.id] = comment
      }
    }

    let lastVisitMaxCommentId = lastVisit?.maxCommentId ?? Infinity
    for (let i = 0; i < comments.length; i++) {
      let comment = comments[i]

      if (comment.isMuted) {
        mutedCommentCount++
        for (let j = i + 1; j <= i + comment.childComments.length; j++) {
          if (comments[j].isMuted) {
            mutedCommentCount++
          } else {
            replyToMutedCommentCount++
          }
        }
        // Skip child comments as we've already accounted for them
        i += comment.childComments.length
        // Don't consider muted comments or their replies when counting new
        // comments, or add controls to them, as they'll all be hidden.
        continue
      }

      if (!comment.isDeleted && comment.isNewerThan(lastVisitMaxCommentId)) {
        newCommentCount++
      }

      comment.addControls()
    }

    // Update display of any comments which were already collapsed by HN's own
    // functionality, e.g. deleted comments
    for (let comment of comments) {
      if (comment.isCollapsed) {
        comment.updateDisplay({excludeChildren: true})
      }
    }

    hideMutedUsers()

    maxCommentId = comments.map(comment => comment.id).sort().pop()
    hasNewComments = lastVisit != null && newCommentCount > 0

    // New comment highlighting for submission pages with a comment count
    if ($submissionCommentCount) {
      if (/^\d+/.test($submissionCommentCount.textContent)) {
        commentCount = Number($submissionCommentCount.textContent.split(/\s/).shift())
      } else {
        commentCount = 0
      }
      if (hasNewComments && (autoHighlightNew || autoCollapseNotNew)) {
        if (autoHighlightNew) {
          highlightNewComments(true, lastVisit.maxCommentId)
        }
        if (autoCollapseNotNew) {
          collapseThreadsWithoutNewComments(true, lastVisit.maxCommentId)
        }
      }
      if (commentCount > 0) {
        // TODO Clear If the item is no longer accepting comments (and every comment is older than 45 days?)
        storeVisit(itemId, new Visit({
          commentCount,
          maxCommentId,
          time: new Date(),
        }))
      }
      log('submission page info', {
        itemId,
        commentCount,
        lastVisit,
        maxCommentId,
        newCommentCount,
        hasNewComments,
        mutedCommentCount,
        replyToMutedCommentCount,
      })
    }

    // Always try to add submission controls
    addSubmissionPageControls()
  }

  function updateMutedUsersDisplay() {
    // Invalidate non-muted child caches and update child counts on any
    // comments which have been collapsed.
    for (let i = 0; i < comments.length; i++) {
      let comment = comments[i]

      if (comment.isMuted) {
        i += comment.childComments.length
        continue
      }

      comment._nonMutedChildComments = null
      if (comment.$childCount) {
        comment.$childCount.textContent = comment.collapsedChildrenText
      }
    }

    hideMutedUsers()
  }

  function updateUserNotes(username) {
    if (focusedComment && focusedComment.user == username) {
      focusedComment.updateNote()
    }
    for (let comment of comments) {
      if (comment.user == username) {
        comment.updateNote()
      }
    }
  }
  //#endregion

  //#region Main
  userHovercards({
    onNotesChanged: (username) => {
      userNotes = getUserNotes()
      updateUserNotes(username)
    },
    onMutesChanged: () => {
      mutedUsers = getMutedUsers()
      updateMutedUsersDisplay()
    },
  })

  // Figure out which type of item page we're on
  $submission = document.querySelector('.fatitem tr.submission')
  if ($submission) {
    log('processing submission page')
    toggleHideSubmissionCommentForm()
    $submissionCommentCount = document.querySelector('td.subtext .subline > a[href^=item]')
    if ($submissionCommentCount) {
      lastVisit = getLastVisit(itemId)
    } else {
      log('submission not commentable')
    }
  } else {
    log('processing comment thread')
    let $focusedComment = /** @type {HTMLElement} */ (document.querySelector('.fatitem tr.athing'))
    if ($focusedComment) {
      focusedComment = new FocusedComment($focusedComment)
    }
  }

  processCommentThread()

  chrome.storage.local.onChanged.addListener((changes) => {
    if (changes.clickHeaderToCollapse) {
      config.clickHeaderToCollapse = changes.clickHeaderToCollapse.newValue
      configureCss()
    }
    if (changes.hideReplyLinks) {
      config.hideReplyLinks = changes.hideReplyLinks.newValue
      configureCss()
    }
    if (changes.hideSubmissionCommentForm) {
      config.hideSubmissionCommentForm = changes.hideSubmissionCommentForm.newValue
      toggleHideSubmissionCommentForm()
    }
    if (changes.makeSubmissionTextReadable) {
      config.makeSubmissionTextReadable = changes.makeSubmissionTextReadable.newValue
      configureCss()
    }
  })
  //#endregion
}
//#endregion

//#region Item list page
/**
 * Each item on an item list page has the following structure:
 *
 * ```html
 * <tr id="12345678" class="athing submission">
 *   <td class="title">
 *     <span class="rank">1.</span>
 *   </td>
 *   <td class="votelinks">…</td>
 *   <td class="title">
 *     <span class="titleline">
 *       <a>Example item title</a>
 *       <span class="sitebit">
 *         <a href="from?site=example.com">
 *           (<span class="sitestr">example.com</span>)
 *         </a>
 *       </span>
 *     </span>
 *   </td>
 * </tr>
 * <tr>
 *   <td colspan="2"></td>
 *   <td class="subtext">
 *     <span class="subline">…</span> (item meta info)
 *   </td>
 * </tr>
 * <tr class="spacer"></tr>
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
  log('processing item list page')

  //#region CSS
  addStyle('list-static', `
    tr.submission.hidden {
      display: none;
      & + tr {
        display: none;
      }
      & + tr + tr.spacer {
        display: none;
      }
    }
  `)
  //#endregion

  //#region Functions
  function confirmFlag(e) {
    if (!config.preventAccidentally) return
    let title = e.target.closest('tr').previousElementSibling.querySelector('.titleline a')?.textContent || 'this item'
    if (!confirm(`Are you sure you want to flag "${title}"?`)) {
      e.stopPropagation()
      e.stopImmediatePropagation()
      e.preventDefault()
      return false
    }
  }

  function confirmHide(e) {
    if (!config.preventAccidentally) return
    let title = e.target.closest('tr').previousElementSibling.querySelector('.titleline a')?.textContent || 'this item'
    if (!confirm(`Are you sure you want to hide "${title}"?`)) {
      e.stopPropagation()
      e.stopImmediatePropagation()
      e.preventDefault()
      return false
    }
  }

  function toggleItemVisibility() {
    if (!['/', '/active', '/ask', '/front', '/newest', '/news', '/show', '/shownew'].includes(location.pathname)) return

    let aiTitleRe
    if (config.hideAiTitleRegexError || !config.hideAiTitleRegex) {
      warn('falling back to default AI title regex')
      aiTitleRe = createRegExp(defaultConfig.hideAiTitleRegex)
    } else {
      aiTitleRe = createRegExp(config.hideAiTitleRegex)
    }
    let aiSiteRE
      if (config.hideAiSiteRegexError || !config.hideAiSiteRegex) {
      warn('falling back to default AI site regex')
      aiSiteRE = createRegExp(defaultConfig.hideAiSiteRegex)
    } else {
      aiSiteRE = createRegExp(config.hideAiSiteRegex)
    }
    let customTitleRe
    if (config.hideCustomTitleRegex && !config.hideCustomTitleRegexError) {
      customTitleRe = createRegExp(config.hideCustomTitleRegex)
      if (customTitleRe.source == '(?:)') customTitleRe = null
    }
    let customSiteRe
    if (config.hideCustomSiteRegex && !config.hideCustomSiteRegexError) {
      customSiteRe = createRegExp(config.hideCustomSiteRegex)
      if (customSiteRe.source == '(?:)') customSiteRe = null
    }

    let aiCount = 0
    let aiMatches = []
    let customCount = 0
    let customMatches = []
    let totalCount = 0

    for (let $submission of document.querySelectorAll('tr.submission')) {
      let isAi = false
      let isCustom = false
      let $link = $submission.querySelector('.titleline > a')
      let $site = $submission.querySelector('.sitebit > a')

      if (config.hideAiItems) {
        if (debug) {
          let match = $link?.textContent.match(aiTitleRe)
          if (match) {
            aiMatches.push(`[title] "${match[0]}" → ${$link.textContent}`)
          }
        }
        isAi = aiTitleRe.test($link?.textContent)
        if (!isAi) {
          if (debug) {
            let match = $site?.textContent.match(aiSiteRE)
            if (match) {
              aiMatches.push(`[site] ${$site.textContent} → ${$link.textContent}`)
            }
          }
          isAi = aiSiteRE.test($site?.textContent)
        }
        if (isAi) {
          aiCount++
        }
      }

      if (!isAi && config.hideCustomItems) {
        if (customTitleRe) {
          if (debug) {
            let match = $link?.textContent.match(customTitleRe)
            if (match) {
              customMatches.push(`[title] "${match[0]}" → ${$link.textContent}`)
            }
          }
          isCustom = customTitleRe.test($link?.textContent)
        }
        if (!isCustom && customSiteRe) {
          if (debug) {
            let match = $site?.textContent.match(customSiteRe)
            if (match) {
              customMatches.push(`[site] ${$site.textContent} → ${$link.textContent}`)
            }
          }
          isCustom = customSiteRe.test($site?.textContent)
        }
        if (isCustom) {
          customCount++
        }
      }

      totalCount++
      $submission.classList.toggle('hidden', isAi || isCustom)
    }

    if (config.hideAiItems) {
      log(`${aiCount} "AI" item${s(aiCount)} hidden${
        aiCount > 0 ? ` (${Math.round(aiCount / totalCount * 100)}%)` : ''
      }${
        aiMatches.length > 0 ? `\n${aiMatches.join('\n')}` : ''
      }`)
    }
    if (config.hideCustomItems && (customTitleRe || customSiteRe)) {
      log(`${customCount} custom item${s(customCount)} hidden${
        customCount > 0 ? ` (${Math.round(customCount / totalCount * 100)}%)` : ''
      }${
        customMatches.length > 0 ? `\n${customMatches.join('\n')}` : ''
      }`)
    }

    // Adjust item numbers
    let rank = null
    for (let $submission of document.querySelectorAll('tr.submission')) {
      let $rank = $submission.querySelector('.rank')
      if (rank == null) {
        rank = parseInt($rank.textContent)
      }
      if (!$submission.classList.contains('hidden')) {
        $rank.textContent = `${rank++}.`
      }
    }
  }

  function storeSubmissionIds() {
    let submissionIds = [...document.querySelectorAll('tr.submission')].map($submission => $submission.id)
    sessionStorage.submissionIds = JSON.stringify(submissionIds)
    configureViewTransitionCss()
  }
  //#endregion

  //#region Main
  if (config.enableViewTransitions && config.listItemTransition) {
    storeSubmissionIds()
  }

  if (location.pathname != '/flagged') {
    for (let $flagLink of document.querySelectorAll('span.subline > a[href^="flag"]')) {
      $flagLink.addEventListener('click', confirmFlag, true)
    }
  }

  if (location.pathname != '/hidden') {
    for (let $hideLink of document.querySelectorAll('span.subline > a[href^="hide"]')) {
      $hideLink.addEventListener('click', confirmHide, true)
    }
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
            href: `item?shownew&id=${id}`,
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

  if (config.hideAiItems || config.hideCustomItems) {
    toggleItemVisibility()
  }

  chrome.storage.local.onChanged.addListener((changes) => {
    // Store submissions if transitioning them is turned on
    if (changes.enableViewTransitions && changes.enableViewTransitions.newValue && config.listItemTransition ||
        changes.listItemTransition && changes.listItemTransition.newValue && config.enableViewTransitions) {
      storeSubmissionIds()
    }
    if (changes.preventAccidentally) {
      config.preventAccidentally = changes.preventAccidentally.newValue
    }
    let hasHideAiChanges = false
    for (let [configProp, change] of Object.entries(changes)) {
      if (['hideAiItems', 'hideAiTitleRegex', 'hideAiTitleRegexError', 'hideAiSiteRegex', 'hideAiSiteRegexError'].includes(configProp)) {
        // Reset regexes to the default when they're removed
        config[configProp] = change.newValue === undefined ? defaultConfig[configProp] : change.newValue
        hasHideAiChanges = true
      }
    }
    let hasHideCustomChanges = false
    for (let [configProp, change] of Object.entries(changes)) {
      if (['hideCustomItems', 'hideCustomTitleRegex', 'hideCustomTitleRegexError', 'hideCustomSiteRegex', 'hideCustomSiteRegexError'].includes(configProp)) {
        config[configProp] = change.newValue
        hasHideCustomChanges = true
      }
    }
    if (hasHideAiChanges || hasHideCustomChanges) {
      toggleItemVisibility()
    }
  })
  //#endregion
}
//#endregion

//#region Profile page
let $profileStyle

/**
 * This is reused for user hovercards by pointing it at their DOM instead.
 * @param {{
 *   $context?: Document | HTMLElement
 *   textAreaProps?: any
 *   onMutesChanged?: () => void
 *   onNotesChanged?: () => void
 * }} options
 */
function userProfilePage({$context = document, textAreaProps = {cols: 60}, onMutesChanged, onNotesChanged} = {}) {
  let $userLink = /** @type {HTMLAnchorElement} */ ($context.querySelector('a.hnuser'))
  if ($userLink == null) {
    warn('invalid user')
    document.documentElement.setAttribute('unstyled', '')
    return
  }

  let userId = $userLink.innerText
  let mutedUsers = getMutedUsers()
  let userNotes = getUserNotes()
  let $table = $userLink.closest('table')

  let isCurrentUser = userId == currentUser || location.pathname.startsWith('/muted')

  // Don't add anything if the current user looks at their own hovercard
  if (isCurrentUser && $context !== document) return

  if (isCurrentUser) {
    //#region Logged-in user's profile
    let $mutedUsers = createMutedUsers()

    function createMutedUsers() {
      if (mutedUsers.size == 0) {
        return h('tbody', null,
          h('tr', null,
            h('td', {valign: 'top'}, 'muted:'),
            h('td', null, 'No muted users.')
          )
        )
      }

      let first = 0
      return h('tbody', null,
        ...Array.from(mutedUsers).map((mutedUserId) => h('tr', null,
          h('td', {valign: 'top'}, first++ == 0 ? 'muted:' : ''),
          h('td', null,
            h('a', {href: `user?id=${mutedUserId}`}, mutedUserId),
            h('a', {
                href: '#',
                onClick: function(e) {
                  e.preventDefault()
                  mutedUsers = getMutedUsers()
                  mutedUsers.delete(mutedUserId)
                  storeMutedUsers(mutedUsers)
                  replaceMutedUsers()
                }
              },
              ' (', h('u', null, 'unmute'), ')'
            ),
            userNotes[mutedUserId] ? ` - ${userNotes[mutedUserId].split(/\r?\n/)[0]}` : null,
          ),
        ))
      )
    }

    function replaceMutedUsers() {
      let $newMutedUsers = createMutedUsers()
      $mutedUsers.replaceWith($newMutedUsers)
      $mutedUsers = $newMutedUsers
    }

    $table.append($mutedUsers)

    window.addEventListener('storage', (e) => {
      if (e.storageArea !== localStorage ||
          e.newValue == null ||
          e.key != MUTED_USERS_KEY && e.key != USER_NOTES_KEY) {
        return
      }

      if (e.key == MUTED_USERS_KEY) {
        mutedUsers = getMutedUsers(e.newValue)
      }
      else if (e.key == USER_NOTES_KEY) {
        userNotes = getUserNotes(e.newValue)
      }

      replaceMutedUsers()
    })
    //#endregion
  }
  else {
    //#region Other user profile
    if (!$profileStyle) {
      $profileStyle = addStyle('profile-static', `
        .saved {
          color: var(--text-primary);
          opacity: 0;
        }
        .saved.show {
          animation: flash 2s forwards;
        }
        @keyframes flash {
          from {
            opacity: 0;
          }
          15% {
            opacity: 1;
            animation-timing-function: ease-in;
          }
          75% {
            opacity: 1;
          }
          to {
            opacity: 0;
            animation-timing-function: ease-out;
          }
        }
        .notes {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 3px;
        }
      `)
    }

    function getMutedStatusText() {
      return mutedUsers.has(userId) ? 'unmute' : 'mute'
    }

    function getUserNote() {
      return userNotes[userId] || ''
    }

    function userHasNote() {
      return userNotes.hasOwnProperty(userId)
    }

    function saveNotes() {
      userNotes = getUserNotes()
      let note = $textArea.value.trim()

      // Don't save initial blanks or duplicates
      if (userNotes[userId] == note || note == '' && !userHasNote()) return

      userNotes[userId] = $textArea.value.trim()
      storeUserNotes(userNotes)
      onNotesChanged?.()

      if ($saved.classList.contains('show')) {
        $saved.classList.remove('show')
        $saved.offsetHeight
      }
      $saved.classList.add('show')
    }

    let {style: textAreaStyle, ...textAreaRest} = textAreaProps
    let $textArea = /** @type {HTMLTextAreaElement} */ (h('textarea', {
      ...textAreaRest,
      value: userNotes[userId] || '',
      className: 'notes',
      style: {resize: 'none', ...textAreaStyle},
      onInput() {
        autosizeTextArea(this)
      },
      onKeydown(e) {
        // Save on Use Ctrl+Enter / Cmd+Return
        if (e.key == 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          saveNotes()
        }
      },
      onBlur() {
        saveNotes()
      },
      rows: 1,
    }))

    let $muted = h('u', null, getMutedStatusText())
    let $saved = h('span', {className: 'saved'}, 'saved')

    $table.querySelector('tbody').append(
      h('tr', null,
        h('td'),
        h('td', null,
          h('a', {
              href: `mute?id=${userId}`,
              onClick: function(e) {
                e.preventDefault()
                if (mutedUsers.has(userId)) {
                  mutedUsers = getMutedUsers()
                  mutedUsers.delete(userId)
                  this.firstElementChild.innerText = 'mute'
                }
                else {
                  mutedUsers = getMutedUsers()
                  mutedUsers.add(userId)
                  this.firstElementChild.innerText = 'unmute'
                }
                storeMutedUsers(mutedUsers)
                onMutesChanged?.()
              }
            },
            $muted
          )
        )
      ),
      h('tr', null,
        h('td', {vAlign: 'top'}, 'notes:'),
        h('td', {className: 'notes'}, $textArea, $saved),
      ),
    )

    autosizeTextArea($textArea)

    window.addEventListener('storage', (e) => {
      if (e.storageArea !== localStorage || e.newValue == null) return

      if (e.key == MUTED_USERS_KEY) {
        mutedUsers = getMutedUsers(e.newValue)
        if ($muted.textContent != getMutedStatusText()) {
          $muted.textContent = getMutedStatusText()
        }
      }
      else if (e.key == USER_NOTES_KEY) {
        userNotes = getUserNotes(e.newValue)
        if (userHasNote() && $textArea.value.trim() != getUserNote()) {
          $textArea.value = getUserNote()
        }
      }
    })
    //#endregion
  }
}
//#endregion
//#endregion

//#region Global functionality
//#region CSS view transitions
const VIEW_TRANSITION_CONFIG_KEYS = [
  'enableViewTransitions',
  'listItemTransition',
]

/** @type {HTMLStyleElement} */
let $viewTransitionStyle

/** @param {{enableViewTransitions?: boolean, listItemTransition?: boolean}} [options] */
function configureViewTransitionCss({
  enableViewTransitions = localStorage.enableViewTransitions == 'true',
  listItemTransition = localStorage.listItemTransition == 'true',
} = {}) {
  if (!enableViewTransitions) {
    if ($viewTransitionStyle) {
      $viewTransitionStyle.remove()
      $viewTransitionStyle = null
    }
    return
  }
  /** @type {string[]} */
  let submissionIds = []
  if (listItemTransition) {
    let parsed = parseStoredJSON(sessionStorage, 'submissionIds')
    submissionIds = Array.isArray(parsed) ? parsed : []
  }
  let css = dedent(`
    @view-transition {
      navigation: auto;
    }
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation-duration: 150ms;
    }
    ${submissionIds.map(id => `.submission[id="${id}"] {
      .votelinks {
        view-transition-name: item-${id}-votelinks;
      }
      .votelinks + .title {
        view-transition-name: item-${id}-title;
      }
      & + tr .subline {
        view-transition-name: item-${id}-subline;
      }
    }`).join('\n')}
  `)
  if (!$viewTransitionStyle) {
    $viewTransitionStyle = addStyle('view-transitions', css)
  } else {
    $viewTransitionStyle.textContent = css
  }
}
//#endregion

//#region Custom CSS
/** @type {HTMLStyleElement} */
let $customCssStyle

/** @param {string} [customCss] */
function configureCustomCss(customCss = localStorage.customCss ?? '') {
  if (!customCss) {
    if ($customCssStyle) {
      $customCssStyle.remove()
      $customCssStyle = null
    }
    return
  }
  if (!$customCssStyle) {
    $customCssStyle = addStyle('custom-css', customCss)
  }
  else if ($customCssStyle.textContent != customCss) {
    $customCssStyle.textContent = customCss
  }
}
//#endregion

//#region Navigation
let NAV_CONFIG_KEYS = [
  'addActiveToHeader',
  'addUpvotedToHeader',
  'hideCommentsNav',
  'hideJobsNav',
  'hidePastNav',
  'hideSubmitNav',
]

let navEnhanced = false

/** @type {HTMLStyleElement} */
let $navStyle

function configureNavCss({
  hidePastNav = localStorage.hidePastNav == 'true',
  hideCommentsNav = localStorage.hideCommentsNav == 'true',
  hideJobsNav = localStorage.hideJobsNav == 'true',
  hideSubmitNav = localStorage.hideSubmitNav == 'true',
  addActiveToHeader = localStorage.addActiveToHeader == 'true',
  addUpvotedToHeader = localStorage.addUpvotedToHeader == 'true',
} = {}) {
  let hideNavSelectors = [
    hidePastNav && 'span.past-sep, span.past-sep + a',
    hideCommentsNav && 'span.comments-sep, span.comments-sep + a',
    hideJobsNav && 'span.jobs-sep, span.jobs-sep + a',
    hideSubmitNav && 'span.submit-sep, span.submit-sep + a',
    !addActiveToHeader && 'span.active-sep, span.active-sep + a',
    !addUpvotedToHeader && 'span.upvoted-sep, span.upvoted-sep + a',
  ].filter(Boolean)
  let css = dedent(`
    ${hideNavSelectors.join(',\n')} {
      display: none;
    }
  `)
  if (!$navStyle) {
    $navStyle = addStyle('nav-dynamic', css)
  } else {
    $navStyle.textContent = css
  }
}

function tweakNav() {
  if (navEnhanced) return

  let $pageTop = document.querySelector('span.pagetop')
  if (!$pageTop) {
    if (!loading) {
      warn('.pagetop not found')
    }
    return
  }

  if (loading) {
    log('navigation enhanced')
  }
  navEnhanced = true

  if ($pageTop.querySelector(':scope > b:only-child')) {
    log(`/${path} has no navigation items`)
    return
  }

  // Add a 'muted' link next to 'login' for logged-out users
  let $loginLink = document.querySelector('span.pagetop a[href^="login"]')
  if ($loginLink) {
    $loginLink.parentElement.append(
      h('a', {href: `muted`}, 'muted'),
      ' | ',
      $loginLink,
    )
  }

  let $active
  let $lastNavLink = $pageTop.querySelector(':scope > a:last-of-type')

  // Add /active if we're not on it
  if ($lastNavLink && !location.pathname.startsWith('/active')) {
    $active = h('a', {href: 'active'}, 'active')
    $lastNavLink.insertAdjacentElement('afterend', $active)
    $lastNavLink.insertAdjacentElement('afterend', h('span', {className: 'active-sep'}, ' | '))
  }

  // Add /upvoted if we're not on it and the user is logged in
  if ($lastNavLink && !location.pathname.startsWith('/upvoted')) {
    let $userLink = document.querySelector('a#me')
    if ($userLink) {
      let $upvoted = h('a', {href: `upvoted?id=${$userLink.textContent}`}, 'upvoted')
      let $separator = h('span', {className: 'upvoted-sep'}, ' | ')
      if (location.pathname.startsWith('/active')) {
        // Add after the "active" page title so positioning is consistent
        $pageTop.append($separator, $upvoted)
      } else {
        let $target = $active || $lastNavLink
        $target.insertAdjacentElement('afterend', $upvoted)
        $target.insertAdjacentElement('afterend', $separator)
      }
    }
  }

  // Wrap separators in elements so they can be used to hide items
  for (let $node of $pageTop.childNodes) {
    if ($node.nodeType == Node.TEXT_NODE && $node.nodeValue == ' | ') {
      $node.replaceWith(h('span', {
        className: `${$node.nextSibling?.nodeName == 'FONT' ? 'page-title' : $node.nextSibling?.textContent}-sep`,
      }, ' | '))
    }
  }

  // Create a new row for mobile nav
  let $mobileNav = /** @type {HTMLTableCellElement} */ ($pageTop.parentElement.cloneNode(true))
  $mobileNav.querySelector('b.hnname')?.remove()
  $mobileNav.colSpan = 3
  $pageTop.closest('tbody').append(h('tr', {className: 'mobilenav'}, $mobileNav))

  // Move everything after b.hnname into a desktop nav wrapper
  $pageTop.appendChild(h('span', {className: 'desktopnav'}, ...Array.from($pageTop.childNodes).slice(1)))
}
//#endregion

//#region <textarea> keyboard submit
function submitFirstTextAreaWithKeyboard() {
  let $textArea = /** @type {HTMLTextAreaElement} */ (document.querySelector('form textarea'))
  if (!$textArea) return

  /** @param {KeyboardEvent} e */
  function onKeyDown(e) {
    if (e.isComposing) return
    if (e.key == 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      log('submitting form from textarea')
      $textArea.form.requestSubmit()
    }
  }

  function updateEventHandlers() {
    log(`${config.submitTextAreaWithKeyboard ? 'en' : 'dis'}abling <textarea> keyboard submission`)
    $textArea[config.submitTextAreaWithKeyboard ? 'addEventListener' : 'removeEventListener']('keydown', onKeyDown)
  }

  if (config.submitTextAreaWithKeyboard) {
    updateEventHandlers()
  }

  chrome.storage.local.onChanged.addListener((changes) => {
    if (changes.submitTextAreaWithKeyboard) {
      config.submitTextAreaWithKeyboard = changes.submitTextAreaWithKeyboard.newValue
      updateEventHandlers()
    }
  })
}
//#endregion

//#region Theming
const THEME_CONFIG_KEYS = [
  'darkMode',
  'pureBlack',
]

let footerAnnotated = false
let headerAnnotated = false
let logoReplaced = false

function setActiveSize() {
  let desktop = window.innerWidth > 750
  document.documentElement.toggleAttribute('desktop', desktop)
  document.documentElement.toggleAttribute('mobile', !desktop)
}

/** @param {{darkMode?: boolean, pureBlack?: boolean}} [options] */
function setActiveTheme({
  darkMode = localStorage.darkMode == 'true',
  pureBlack = localStorage.pureBlack == 'true',
} = {}) {
  document.documentElement.toggleAttribute('dark', darkMode)
  document.documentElement.toggleAttribute('light', !darkMode)
  document.documentElement.toggleAttribute('pure-black', darkMode && pureBlack)
}

/**
 * We need to add ids to these ASAP to reduce flash of initial state.
 */
function tagHeaderAndFooter() {
  if (headerAnnotated && footerAnnotated) return

  let annotated = []

  if (!headerAnnotated) {
    let $pageTop = document.querySelector('span.pagetop')
    if ($pageTop) {
      let $header = $pageTop.closest('td[bgcolor]')
      if ($header) {
        $header.id = 'header'
        $header.toggleAttribute('default', $header.getAttribute('bgcolor') == '#ff6600')
        headerAnnotated = true
        annotated.push('header')
      }
    }
  }

  if (!footerAnnotated) {
    let $footer = document.querySelector('#bigbox ~ tr td[bgcolor]:empty:not([id])')
    if ($footer) {
      $footer.id = 'footer'
      $footer.toggleAttribute('default', $footer.getAttribute('bgcolor') == '#ff6600')
      footerAnnotated = true
      annotated.push('footer')
    }
  }

  if (annotated.length > 0) {
    log(`${annotated.join(' and ')} annotated`)
  }
}
//#endregion

//#region User hovercards
/**
 * @param {{
 *   onMutesChanged?: () => void
 *   onNotesChanged?: (username: string) => void
 * }} [options]
 */
function userHovercards({onMutesChanged, onNotesChanged} = {}) {
  const CLOSE_DELAY_MS = 400
  const FADE_MS = 120
  const NOTE_TEXT_AREA_PROPS = {style: {width: '100%', maxHeight: '12em', overflowY: 'auto'}}
  const OPEN_DELAY_MS = 800
  const PREFETCH_DELAY_MS = 100

  //#region CSS
  addStyle('hovercard-static', `
    .hovercard {
      background: var(--hovercard-bg);
      border: 1px solid var(--hovercard-border);
      box-shadow: var(--hovercard-shadow);
      inset: auto;
      margin: 8px 0;
      max-height: min(70vh, 500px);
      overflow: auto;
      padding: 4px 8px;
      position-anchor: --username-anchor;
      position-area: bottom span-right;
      position-try-fallbacks: top span-right, bottom span-left, top span-left;
      position: fixed;
      transition: opacity ${FADE_MS}ms ease;
      width: 300px;
      a:link {
        color: var(--link);
      }
      td {
        color: var(--text-secondary);
      }
    }
    .hovercard-anchor {
      anchor-name: --username-anchor;
    }
  `)
  //#endregion

  //#region State
  /** @type {ReturnType<typeof setTimeout>} */
  let hideTimer
  /** @type {ReturnType<typeof setTimeout>} */
  let prefetchTimer
  /** @type {Map<string, import("./types").UserProfile>} */
  let profileData = new Map()
    /** @type {Map<string, Promise<import("./types").UserProfile>>} */
  let profileRequests = new Map()
  /** @type {ReturnType<typeof setTimeout>} */
  let showTimer
  /** @type {HTMLAnchorElement} */
  let $activeUser
  //#endregion

  //#region Functions
  function clearActiveUser() {
    if ($activeUser) {
      $activeUser.classList.remove('hovercard-anchor')
      $activeUser = null
    }
  }

  /**
   * @param {string} username
   * @param {string} href
   * @returns {Promise<import("./types").UserProfile>}
   */
  async function fetchUserProfile(username, href) {
    let res = await fetch(href, {credentials: 'same-origin'})
    if (!res.ok) throw new Error(`Failed to fetch profile for ${username}`)

    let html = await res.text()
    let doc = new DOMParser().parseFromString(html, 'text/html')
    let profile = {
      username,
      green: false,
      created: '',
      karma: '',
    }

    for (let $row of doc.querySelectorAll('#bigbox tr')) {
      let $cells = $row.querySelectorAll('td')
      let label = $cells[0]?.textContent
      if (!label) break
      if (label == 'user:') profile.green = Boolean($cells[1]?.querySelector('font[color="#3c963c"]'))
      if (label == 'created:') profile.created = $cells[1]?.textContent ?? ''
      if (label == 'karma:') profile.karma = $cells[1]?.textContent ?? ''
    }

    return profile
  }

  /** @param {HTMLAnchorElement} $user */
  function getUserProfile($user) {
    let username = $user.textContent
    if (profileData.has(username)) {
      return Promise.resolve(profileData.get(username))
    }

    if (profileRequests.has(username)) {
      return profileRequests.get(username)
    }

    let promise = (async () => {
      try {
        let profile = await fetchUserProfile(username, $user.href)
        profileData.set(username, profile)
        return profile
      } finally {
        profileRequests.delete(username)
      }
    })()

    profileRequests.set(username, promise)
    return promise
  }

  function scheduleHideHovercard({force = false} = {}) {
    clearTimeout(hideTimer)

    hideTimer = setTimeout(() => {
      if (!force) {
        // Don't hide if the notes are focused
        if ($hovercard.contains(document.activeElement) && document.activeElement.tagName == 'TEXTAREA') return
      }
      hideHovercard()
    }, CLOSE_DELAY_MS)
  }

  function hideHovercard({immediate = false} = {}) {
    if (!$hovercard.matches(':popover-open')) return

    if (immediate) {
      $hovercard.hidePopover()
      clearActiveUser()
      return
    }

    $hovercard.style.opacity = '0'
    setTimeout(() => {
      $hovercard.hidePopover()
      clearActiveUser()
    }, FADE_MS)
  }

  /** @param {import("./types").UserProfile} profile */
  function renderHovercardContents(profile) {
    $hovercard.replaceChildren(
      h('table', {border: '0', style: {width: '100%'}},
        h('col', {style: {width: '1px'}}),
        h('tbody', null,
          h('tr', null,
            h('td', {valign: 'top'}, 'user:'),
            h('td', null, h('a', {className: 'hnuser'},
              profile.green ? h('font', {color: '#3c963c'}, profile.username) : profile.username),
            ),
          ),
          h('tr', null,
            h('td', {valign: 'top'}, 'created:'),
            h('td', null, profile.created),
          ),
          h('tr', null,
            h('td', {valign: 'top'}, 'karma:'),
            h('td', null, profile.karma),
          ),
          h('tr', null,
            h('td'),
            h('td', null,
              h('a', {href: `threads?id=${profile.username}`},
                h('u', null, 'comments'),
              ),
            ),
          ),
        ),
      )
    )
  }

  /** @param {HTMLAnchorElement} $user */
  function setActiveUser($user) {
    if ($activeUser && $activeUser !== $user) {
      $activeUser.classList.remove('hovercard-anchor')
    }
    $activeUser = $user
    $activeUser.classList.add('hovercard-anchor')
  }

  /** @param {HTMLAnchorElement} $user */
  function showHovercard($user) {
    if ($hovercard.matches(':popover-open')) {
      // Don't hide or re-show if the user mouses over the active user link
      if ($activeUser === $user) {
        clearTimeout(hideTimer)
        return
      }
      // Hide if another user's notes are focused
      if ($hovercard.contains(document.activeElement) && document.activeElement.tagName == 'TEXTAREA') {
        scheduleHideHovercard({force: true})
      }
    }

    let username = $user.textContent
    let userProfilePageOptions = {
      $context: $hovercard,
      onMutesChanged: () => {
        if (onMutesChanged) hideHovercard({immediate: true})
        onMutesChanged?.()
      },
      onNotesChanged: () => {
        onNotesChanged?.(username)
      },
      textAreaProps: NOTE_TEXT_AREA_PROPS,
    }

    clearTimeout(prefetchTimer)
    clearTimeout(showTimer)

    if (!profileRequests.has(username) && !profileData.has(username)) {
      prefetchTimer = setTimeout(() => {
        getUserProfile($user)
      }, PREFETCH_DELAY_MS)
    }

    showTimer = setTimeout(async () => {
      setActiveUser($user)
      $hovercard.style.opacity = '0'
      let profile = profileData.get(username)
      renderHovercardContents(profile ?? {username, green: false, created: '···', karma: '···'})
      $hovercard.showPopover()
      userProfilePage(userProfilePageOptions)
      requestAnimationFrame(() => {
        $hovercard.style.opacity = '1'
      })

      if (!profile) {
        try {
          profile = await getUserProfile($user)
          if ($activeUser !== $user) return
          renderHovercardContents(profile)
          userProfilePage(userProfilePageOptions)
        } catch (error) {
          warn('Error getting user profile:', error)
        }
      }
    }, OPEN_DELAY_MS)
  }
  //#endregion

  //#region Main
  let $hovercard = h('div', {
    className: 'hovercard',
    popover: 'auto',
  })
  $hovercard.addEventListener('mouseenter', () => {
    clearTimeout(hideTimer)
  })
  $hovercard.addEventListener('mouseleave', () => {
    scheduleHideHovercard()
  })
  document.body.appendChild($hovercard)
  document.addEventListener('mouseover', (e) => {
    if (!(e.target instanceof HTMLElement && e.target.closest('a.hnuser') && !$hovercard.contains(e.target))) return
    showHovercard(e.target.closest('a.hnuser'))
  })
  document.addEventListener('mouseout', (e) => {
    if (!(e.target instanceof HTMLElement && e.target.closest('a.hnuser') && !$hovercard.contains(e.target))) return
    clearTimeout(prefetchTimer)
    clearTimeout(showTimer)
    scheduleHideHovercard()
  })
  window.addEventListener('pagehide', () => {
    clearTimeout(hideTimer)
    clearTimeout(prefetchTimer)
    clearTimeout(showTimer)
    hideHovercard({immediate: true})
  })
  //#endregion
}
//#endregion
//#endregion

//#region Main
/** @type {Array<[string[], (config: Partial<import("./types").Config>) => void]>} */
const LOCAL_STORAGE_SYNC_CONFIG = [
  [THEME_CONFIG_KEYS, setActiveTheme],
  [VIEW_TRANSITION_CONFIG_KEYS, configureViewTransitionCss],
  [NAV_CONFIG_KEYS, configureNavCss],
]

/** @type {string} */
let currentUser
/** @type {MutationObserver} */
let documentLoadingObserver
let loading = document.readyState == 'loading'
let path = location.pathname.slice(1)
let startMs = Date.now()

function isItemListPage() {
  return (
    /^($|active|ask|best($|\?)|flagged|front|hidden|invited|launches|news|newest|noobstories|pool|show|shownew|submitted|upvoted)/.test(path) ||
    /^favorites/.test(path) && !location.search.includes('&comments=t')
  )
}

function isItemPage() {
  return /^item/.test(path)
}

function isUserProfilePage() {
  return /^(user|muted)/.test(path)
}

//#region document_start
function onDocumentStart({restart = false} = {}) {
  if (restart) {
    $viewTransitionStyle = null
    $customCssStyle = null
    $navStyle = null
  }

  // @view-transition CSS needs to be applied immediately for pages to be eligible
  configureViewTransitionCss()
  configureCustomCss()
  configureNavCss()
  setActiveSize()
  setActiveTheme()

  if (!headerAnnotated || !logoReplaced || !navEnhanced) {
    documentLoadingObserver = new MutationObserver(() => {
      // Tag header td[bgcolor] for styling
      if (!headerAnnotated) {
        tagHeaderAndFooter()
      }
      // Replace HN's <img src="y18.svg"> with an inline version which can be styled
      if (!logoReplaced) {
        let $homeLink = document.querySelector('a[href="https://news.ycombinator.com"]')
        if ($homeLink) {
          $homeLink.innerHTML = HN_LOGO_SVG
          logoReplaced = true
        }
      }
      // Tweak the nav bar when it loads
      tweakNav()
      // Stop observing if we've done everything we can
      if (headerAnnotated && logoReplaced && navEnhanced && documentLoadingObserver) {
        documentLoadingObserver.disconnect()
        documentLoadingObserver = null
      }
    })
    documentLoadingObserver.observe(document.documentElement, {childList: true, subtree: true})
  }
}
//#endregion

//#region DOMContentLoaded
function onDOMContentLoaded() {
  if (documentLoadingObserver) {
    documentLoadingObserver.disconnect()
    documentLoadingObserver = null
  }

  let $currentUserLink = /** @type {HTMLAnchorElement} */ (document.querySelector('a#me'))
  currentUser = $currentUserLink?.innerText ?? ''

  if (path == 'forgot' || path == 'x' || document.querySelector('input[type="submit"][value="create account"]')) {
    log('auth page')
    document.documentElement.setAttribute('unstyled', '')
    // XXX This doesn't work
    if (IS_SAFARI) {
      log('trying to prevent Safari zooming in on auth page inputs')
      addStyle('login-safari', `input[type="text"], input[type="password"] { font-size: 16px; }`)
    }
    return
  }

  if (path == 'muted') {
    log('creating /muted page for logged-out users')
    document.documentElement.innerHTML = LOGGED_OUT_USER_PAGE
    // Safari on macOS has a default dark background in dark mode
    if (IS_SAFARI) {
      addStyle('muted-safari', 'html { background-color: var(--bg-color); }')
    }
    onDocumentStart({restart: true})
  }

  if (document.querySelector('body > pre:only-child')) {
    log('error page')
    document.documentElement.setAttribute('unstyled', '')
    return
  }

  tagHeaderAndFooter()
  tweakNav()
  submitFirstTextAreaWithKeyboard()

  if (isItemListPage()) {
    itemListPage()
  }
  else if (isItemPage()) {
    itemPage()
  }
  else if (isUserProfilePage()) {
    log('user profile page')
    userProfilePage()
  }
}
//#endregion

//#region main()
function main() {
  onDocumentStart()

  window.addEventListener('resize', setActiveSize)

  // Sync config changes which are needed at document_start to localStorage
  chrome.storage.local.onChanged.addListener((changes) => {
    if (changes.debug) {
      debug = changes.debug.newValue
      localStorage.debug = debug
    }
    if (changes.customCss) {
      if (config) {
        config.customCss = changes.customCss.newValue
      }
      if (localStorage.customCss != changes.customCss.newValue) {
        localStorage.customCss = changes.customCss.newValue
        configureCustomCss(changes.customCss.newValue)
      }
    }
    for (let [keys, fn] of LOCAL_STORAGE_SYNC_CONFIG) {
      for (let key of keys) {
        if (!changes[key]) continue
        let {newValue} = changes[key]
        if (config) config[key] = newValue
        if (localStorage.getItem(key) != String(newValue)) {
          localStorage.setItem(key, newValue)
          fn({[key]: newValue})
        }
      }
    }
  })

  chrome.storage.local.get(async (storedConfig) => {
    let settings = await import(chrome.runtime.getURL('settings.js'))
    defaultConfig = settings.DEFAULT_CONFIG
    config = {...defaultConfig, ...storedConfig}
    debug = config.debug
    log('effective config', config)

    // Sync effective config with localStorage and apply any differences
    if (localStorage.debug != String(debug)) {
      localStorage.debug = debug
    }
    if (localStorage.customCss != config.customCss) {
      localStorage.customCss = config.customCss
      configureCustomCss(config.customCss)
    }
    for (let [keys, fn] of LOCAL_STORAGE_SYNC_CONFIG) {
      if (keys.some(key => localStorage.getItem(key) != String(config[key]))) {
        for (let key of keys) localStorage.setItem(key, config[key])
        fn(config)
      }
    }

    if (document.readyState == 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        log('DOMContentLoaded')
        loading = false
        onDOMContentLoaded()
      })
    } else {
      onDOMContentLoaded()
    }
  })
}

if (!path.endsWith('.html')) {
  log('starting')
  main()
}
//#endregion
//#endregion