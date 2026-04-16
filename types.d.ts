export type Config = {
  addActiveToHeader: boolean
  addUpvotedToHeader: boolean
  autoCollapseNotNew: boolean
  autoHighlightNew: boolean
  clickHeaderToCollapse: boolean
  collapsedGroups: string[]
  debug: boolean
  hideAiItems: boolean
  hideAiSiteRegex: string
  hideAiSiteRegexError?: string | null
  hideAiTitleRegex: string
  hideAiTitleRegexError?: string | null
  hideCommentsNav: boolean
  hideJobsNav: boolean
  hidePastNav: boolean
  hideReplyLinks: boolean
  hideSubmitNav: boolean
  makeSubmissionTextReadable: boolean
  preventAccidentally: boolean
  submitTextAreaWithKeyboard: boolean
}

export type UserProfile = {
  username: string
  green: boolean
  created: string
  karma: string
}