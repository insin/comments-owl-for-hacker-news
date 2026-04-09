export type Config = {
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
  listPageFlagging: 'enabled' | 'disabled' | 'confirm'
  listPageHiding: 'enabled' | 'disabled' | 'confirm'
  makeSubmissionTextReadable: boolean
}