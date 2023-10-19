# Comments Owl for Hacker News

_1. Draw some circles_

![](promo/draw-the-rest-of-the-owl.gif)

_2. Draw the rest of the friendly owl_

Browser extension which makes it easer to follow comment threads on [Hacker News ](https://news.ycombinator.com) across multiple visits, showing which items have new comments, highlighting new comments and collapsing threads without new comments. It also adds the ability to annotate and mute other users, plus other UI and UX tweaks.

## Install

* [Safari Extension](https://apps.apple.com/us/app/comments-owl-for-hacker-news/id6451333500?platform=iphone) - for iPhone, iPad and Mac

  [![Download on the App Store](promo/app-store.png)](https://apps.apple.com/us/app/comments-owl-for-hacker-news/id6451333500?platform=iphone)

* [Chrome Extension](https://chrome.google.com/webstore/detail/kpoggabejgbenjahggloahnnaolmfock) - can also be installed in Edge, Opera, and Brave on desktop, and [Kiwi Browser](https://play.google.com/store/apps/details?id=com.kiwibrowser.browser) on Android
* [Firefox Extension](https://addons.mozilla.org/en-US/firefox/addon/hn-comments-owl/) - can also be installed in [Firefox Beta](#install-in-firefox-beta-on-android) on Android
* [User script version](https://greasyfork.org/en/scripts/18066-comments-owl-for-hacker-news) - requires a [user script manager](https://greasyfork.org/en#home-step-1)

### Install in Firefox Beta on Android

Mozilla Add-ons currently only lets you install a [small, curated list of extensions on Android](https://addons.mozilla.org/en-US/android/), so you'll need to add a Custom Add-on collection which contains Comments Owl for Hacker News by following these steps:

<details>
  <summary>
  View install instructions for Firefox Beta on Android
  </summary>
  <br>
  <ul>
    <li>
      Install <a href="https://play.google.com/store/apps/details?id=org.mozilla.firefox_beta" rel="nofollow">Firefox Beta</a> on your Android device</li>
    <li>
      <a href="https://blog.mozilla.org/addons/2020/09/29/expanded-extension-support-in-firefox-for-android-nightly/" rel="nofollow">Follow these instructions</a> to enable Custom Add-on collections, TL;DR:
      <ul>
        <li>Settings → About Firefox Beta → Tap on the Firefox logo 5 times</li>
      </ul>
    </li>
    <li>
      In "Custom Add-on collection", which is now available under Advanced settings, enter the following details and tap "OK":
      <ul>
        <li>13844640</li>
        <li>Android-Collection</li>
      </ul>
      <br>
      <img src="https://raw.githubusercontent.com/insin/comments-owl-for-hacker-news/master/screenshots/install_custom_collection.png" alt="Screenshot of what the custom collection to install Comments Owl for Hacker News on Firefox Beta should look like when correctly configured">
    </li>
  </ul>
  <p>You'll now be able to install Comments Owl for Hacker News via the Add-ons page.</p>
  <img src="https://raw.githubusercontent.com/insin/comments-owl-for-hacker-news/master/screenshots/install_addons.jpg" alt="Screenshot of the Add-ons page in Firefox Beta setting up the Custom Add-on collection with the details above" style="max-width:100%;">
</details>

## Releases / What's New?

The [Comments Owl for Hacker News Releases page](https://github.com/insin/comments-owl-for-hacker-news/releases) highlights new features, changes and fixes in each version, and shows which version is currently published on each of the browser extension stores.

## Features

### List pages

- Show new comment counts since you last viewed each item - clicking on the "X new" link will  highlight new comments and collapse comment trees which don't contain any new comments
- Prevent accidental flagging and hiding on mobile by making the "flag" and "hide" controls require confirmation, or hiding them

### Item pages

- Highlight new comments and collapse comment trees which don't contain any new comments when you revisit an item's comments - you can configure whether or not this happens automatically when you revisit
- Default comment folding controls are replaced with a Reddit-style left-aligned control, with a slightly larger hit target
- Manually highlight the X most-recent comments using the new "highlight comments" link on an item
- Mute users to hide their comments and replies to them - muted users can be managed on your own profile page
  - Logged out users get a new 'muted' link in the header they can use to manage their muted users
- Add your own notes to other users on their profile page - the first line will be displayed next to their comments
- Toggle display of "reply" links below comments to make more room for comments on the screen
- Increased distance between the upvote and downvote arrows on mobile
- Increase the contrast of submission text

### Navigation

- Hide navigation items you don't use
- Add an "upvoted" link to the header to make it easier to get back to previously visited items
- Improves mobile navigation by display links below other header contents

## Screenshots

### Item list page with new comment counts

![](screenshots/item_list.png)

### Automatic new comment highlighting & collapsing

![](screenshots/auto_highlight_new.png)

### Manual highlighting of recent comments

![](screenshots/highlight_past_comments.png)

### User muting and notes

#### Mute users by hovering over a comment

![](screenshots/mute_user_comment.png)

#### Mute/unmute users and edit notes via their profile page

![](screenshots/mute_user_profile.png)

#### Manage muted users on your own profile page

![](screenshots/muted_users.png)

## Icon Attribution

Icon adapted from "Owl icon" by [Lorc](https://lorcblog.blogspot.com/) from [game-icons.net](https://game-icons.net), [CC 3.0 BY](https://creativecommons.org/licenses/by/3.0/)
