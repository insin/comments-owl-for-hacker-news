// Avoids async import() so document_start can enable view transitions in time
var COMMENTS_OWL_ROUTES = (() => {
  const HN_ORIGIN = 'https://news.ycombinator.com'

  /** @type {Array<{path: string, userItems?: boolean, comments?: {key: string, value: string}}>} */
  const ITEM_LIST_ROUTES = [
    {path: ''},
    {path: 'active'},
    {path: 'ask'},
    {path: 'asknew'},
    {path: 'best'},
    {path: 'classic'},
    {path: 'from'},
    {path: 'front'},
    {path: 'hidden', userItems: true},
    {path: 'invited'},
    {path: 'launches'},
    {path: 'news'},
    {path: 'newest'},
    {path: 'noobstories'},
    {path: 'over'},
    {path: 'pool'},
    {path: 'show'},
    {path: 'shownew'},
    {path: 'submitted', userItems: true},
    {path: 'upvoted', userItems: true},
    {path: 'vouched', userItems: true},
    {path: 'flagged', userItems: true, comments: {key: 'kind', value: 'comment'}},
    {path: 'favorites', userItems: true, comments: {key: 'comments', value: 't'}},
  ]

  /**
   * @param {string} pathname
   * @param {string} [search]
   */
  function isItemListPage(pathname, search = '') {
    let route = ITEM_LIST_ROUTES.find(route => pathname == `/${route.path}`)
    if (!route) return false
    return !route.comments || new URLSearchParams(search).get(route.comments.key) != route.comments.value
  }

  /** @param {string} pathname */
  function isUserItemListPage(pathname) {
    return ITEM_LIST_ROUTES.some(route => pathname == `/${route.path}` && route.userItems)
  }

  return {HN_ORIGIN, ITEM_LIST_ROUTES, isItemListPage, isUserItemListPage}
})()

// Expose globally as a side-effect when imported as a module
globalThis.COMMENTS_OWL_ROUTES = COMMENTS_OWL_ROUTES
