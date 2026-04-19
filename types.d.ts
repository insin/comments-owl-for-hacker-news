export type Config = {
  addActiveToHeader: boolean
  addUpvotedToHeader: boolean
  autoCollapseNotNew: boolean
  autoHighlightNew: boolean
  clickHeaderToCollapse: boolean
  collapsedGroups: string[]
  customCss: string
  darkMode: boolean
  debug: boolean
  enableLightTheme: boolean
  enableViewTransitions: boolean
  hideAiItems: boolean
  hideAiSiteRegex: string
  hideAiSiteRegexError?: string | null
  hideAiTitleRegex: string
  hideAiTitleRegexError?: string | null
  hideCommentsNav: boolean
  hideCustomItems: boolean
  hideCustomSiteRegex: string
  hideCustomSiteRegexError?: string | null
  hideCustomTitleRegex: string
  hideCustomTitleRegexError?: string | null
  hideJobsNav: boolean
  hidePastNav: boolean
  hideReplyLinks: boolean
  hideSubmitNav: boolean
  listItemTransition: boolean
  makeSubmissionTextReadable: boolean
  preventAccidentally: boolean
  pureBlack: boolean
  submitTextAreaWithKeyboard: boolean
}

export type UserProfile = {
  username: string
  green: boolean
  created: string
  karma: string
}