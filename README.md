# Comments Owl for Hacker News

![](icons/thumbnail.gif)

A browser extension which draws the rest of the friendly owl for Hacker News comment threads to make them actually followable over time, by automatically highlighting new comments, showing which items have new comments, muting users, and various other UX tweaks.

* [Install Chrome Extension](https://chrome.google.com/webstore/detail/hn-comments-owl/kpoggabejgbenjahggloahnnaolmfock)
* [Install Firefox Add-on](https://addons.mozilla.org/en-US/firefox/addon/hn-comments-owl/)
* [Install as a user script](https://greasyfork.org/en/scripts/18066-hn-comment-trees) (requires a [user script manager](https://greasyfork.org/en#home-step-1))

## Features

- Show new comment counts since your last visit on item list pages
- Highlight new comments and collapse comment trees which don't contain any new comments when you revisit an item's comments
- Manual highlighting of recent comments when new comments can't automatically be highlighted
- User muting: mute a user to hide their comments and replies to them; manage muted users on your own profile page

## Other Tweaks

- Add an "upvoted" link to the header to make it easier to get back to previously visited stories, using upvote as a bookmark (default: on)
- Toggle display of "reply" links below comments to make more room for comments on the screen (default: off)
- Replaces built-in comment folding controls with a Reddit-style left-aligned control, with a slightly larger hit target for folding

## Screenshots

### Item list page with new comment counts

![](screenshots/item_list.png)

### Automatic new comment highlighting & collapsing

![](screenshots/auto_highlight_new.png)

### Mid-thread view of new comment highlighting & collapsing

![](screenshots/new_comment_highlighting.png)

### Manual highlighting of recent comments

![](screenshots/highlight_past_comments.png)

### User muting

| Mute users by hovering over a comment | Mute/unmute users via their profile page | Manage muted users on your own profile page |
|:-------:|:------:|:------:|
| ![](screenshots/mute_user_comment.png) | ![](screenshots/mute_user_profile.png) | ![](screenshots/muted_users.png) |

### Toggling display of reply links

| Firefox | Chrome |
|:-------:|:------:|
| ![](screenshots/toggle_reply_links_firefox.png) | ![](screenshots/toggle_reply_links_chrome.png) |

## Options

| Firefox | Chrome |
|:-------:|:------:|
| ![](screenshots/options_firefox.png) | ![](screenshots/options_chrome.png) |

### Automatically highlight new comments

_Default: enabled_

Always highlight new comments and collapse old comments when you visit an item's comments - if disabled, this will only happen if you use the "X New" link on an item page, otherwise you will have to manually use the checkboxes at the top of the screen to highlight new comments

### Add upvoted link to header

_Default: enabled_

Adds an "upvoted" link to the site's top navigation so you can more easily get back to the comment threads on items you've recently upvoted.

### Hide reply links under comments

_Default: disabled_

Hides reply links in comment threads to allow more vertical space for comments.

This option can also be toggled while viewing an item's comments, using the browser's context menu:

| Firefox | Chrome |
|:-------:|:------:|
| ![](screenshots/toggle_reply_links_context_menu_firefox.png) | ![](screenshots/toggle_reply_links_context_menu_chrome.png) |

## Icon Attribution

Icon adapted from "Owl icon" by [Lorc](https://lorcblog.blogspot.com/) from [game-icons.net](https://game-icons.net), [CC 3.0 BY](https://creativecommons.org/licenses/by/3.0/)
