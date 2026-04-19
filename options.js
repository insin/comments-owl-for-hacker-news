import {DEFAULT_CONFIG} from './settings.js'
import {get, remove, set} from './storage.js'

let $body = document.body
$body.classList.toggle('tab', new URLSearchParams(location.search).get('tab') == 'true')

//#region Theme hooks
/** @type {'chrome' | 'edge' | 'firefox' | 'ios' | 'mac'} */
const browser = (() => {
  let ua = navigator.userAgent.toLowerCase()
  if (ua.includes('firefox')) return 'firefox'
  else if (ua.includes('edg/')) return 'edge'
  else if (ua.includes('safari') && !ua.includes('chrome'))
    return ua.includes('iphone') || ua.includes('ipad') ? 'ios' : 'mac'
  return 'chrome'
})()
let theme = browser
$body.classList.add(`browser-${browser}`, theme)
//#endregion

//#region Localisation
document.title = chrome.i18n.getMessage('extensionName')

for (let translationId of [
  'addActiveToHeader',
  'addUpvotedToHeader',
  'appearanceOptions',
  'autoCollapseNotNew',
  'autoHighlightNew',
  'clickHeaderToCollapse',
  'commentPagesOptions',
  'customCss',
  'darkMode',
  'debug',
  'debugInfo',
  'developerOptions',
  'enableLightTheme',
  'enableLightThemeInfo',
  'enableViewTransitions',
  'hideAiItems',
  'hideCommentsNav',
  'hideCustomItems',
  'hideJobsNav',
  'hidePastNav',
  'hideReplyLinks',
  'hideSubmitNav',
  'listItemTransition',
  'listPagesOptions',
  'makeSubmissionTextReadable',
  'navigationOptions',
  'preventAccidentally',
  'preventAccidentallyInfo',
  'pureBlack',
]) {
  let $el = document.getElementById(translationId)
  if ($el) {
    $el.textContent = chrome.i18n.getMessage(translationId)
  } else {
    console.warn('could not find element for translationId', translationId)
  }
}

for (let translationClass of [
  'regexInfo',
  'resetLink',
  'saveAndApply',
  'siteRegex',
  'titleRegex',
]) {
  let translation = chrome.i18n.getMessage(translationClass)
  let $elements = document.querySelectorAll(`.${translationClass}`)
  for (let $el of $elements) {
    $el.textContent = translation
  }
  if ($elements.length == 0) {
    console.warn('could not find elements for translationClass', translationClass)
  }
}

document.querySelector('#submitTextAreaWithKeyboard').textContent = chrome.i18n.getMessage(
  'submitTextAreaWithKeyboard',
  /^(?:Mac|iPhone|iPad)/.test(navigator.platform) ? '⌘ Return' : 'Ctrl+Enter'
)
//#endregion

//#region Config & variables
/** @type {import("./types").Config} */
let config

// Page elements
let $collapsibleLabels = document.querySelectorAll('section.labelled.collapsible > label[data-collapse-id]')
let $customCss = /** @type {HTMLTextAreaElement} */ (document.querySelector('textarea#customCss'))
let $form = document.querySelector('form')
let $hideAiSiteRegex = /** @type {HTMLTextAreaElement} */ (document.querySelector('textarea#hideAiSiteRegex'))
let $hideAiSiteRegexError = document.querySelector('#hideAiSiteRegexError')
let $hideAiSiteRegexResetLink = document.querySelector('a#hideAiSiteRegexResetLink')
let $hideAiTitleRegex = /** @type {HTMLTextAreaElement} */ (document.querySelector('textarea#hideAiTitleRegex'))
let $hideAiTitleRegexError = document.querySelector('#hideAiTitleRegexError')
let $hideAiTitleRegexResetLink = document.querySelector('a#hideAiTitleRegexResetLink')
let $hideCustomSiteRegex = /** @type {HTMLTextAreaElement} */ (document.querySelector('textarea#hideCustomSiteRegex'))
let $hideCustomSiteRegexError = document.querySelector('#hideCustomSiteRegexError')
let $hideCustomTitleRegex = /** @type {HTMLTextAreaElement} */ (document.querySelector('textarea#hideCustomTitleRegex'))
let $hideCustomTitleRegexError = document.querySelector('#hideCustomTitleRegexError')
let $openInTabLink = /** @type {HTMLAnchorElement} */ (document.querySelector('#openInTabLink'))
let $saveCustomCssButton = document.querySelector('button#saveCustomCss')
//#endregion

//#region Utility functions
function autoResize($textarea) {
  if (!$textarea.offsetParent) return
  if ($textarea._autosizeValue == $textarea.value) return
  if (!$textarea.hasAttribute('data-border-height')) {
    let {borderBottomWidth, borderTopWidth} = getComputedStyle($textarea)
    $textarea.setAttribute('data-border-height', parseFloat(borderBottomWidth) + parseFloat(borderTopWidth))
  }
  $textarea.style.height = 'auto'
  $textarea.style.height = Math.ceil($textarea.scrollHeight) + parseFloat($textarea.getAttribute('data-border-height')) + 'px'
  $textarea._autosizeValue = $textarea.value
}

function clearError($input, $error) {
  $input.classList.remove('invalid')
  $error.setAttribute('hidden', '')
  $error.textContent = ''
}

function debounceByKey(func, delay = 400) {
  let timeouts = new Map()

  function debounced(key, ...args) {
    debounced.cancel(key)

    let timeoutId = setTimeout(() => {
      timeouts.delete(key)
      func.apply(this, args)
    }, delay)

    timeouts.set(key, timeoutId)
  }

  debounced.cancel = (key) => {
    let timeoutId = timeouts.get(key)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeouts.delete(key)
    }
  }

  return debounced
}

function showError($input, $error, message) {
  $input.classList.add('invalid')
  $error.removeAttribute('hidden')
  $error.textContent = message
}

function updateCollapsedOptionGroupsDisplay() {
  for (let $label of $collapsibleLabels) {
    $label.parentElement.classList.toggle('collapsed', config.collapsedGroups.includes($label.getAttribute('data-collapse-id')))
  }
}

function updateFormControl($control, value) {
  if ($control.type == 'checkbox') {
    $control.checked = value
  }
  else {
    $control.value = value
  }
}

/** @param {string} source */
function validateRegex(source) {
  try {
    new RegExp(source)
  } catch(e) {
    let message = e.message
    // Chrome errors include the full source
    if (message.includes(source)) {
      message = message.replace(source, '…')
      // Chrome errors have the actual reason at the end
      let reasonIndex = message.lastIndexOf(': ')
      if (reasonIndex != -1) {
        message = message.substring(reasonIndex + 2)
      }
    }
    return message
  }
  return null
}

/** @param {string} value */
function validateRegexInput(value) {
  let lines = value.split('\n')
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    let error = validateRegex(line)
    if (error) return `${error} on line ${i + 1}`
  }
  return null
}
//#endregion

//#region Options page functions
/**
 * @param {{
 *   key: string
 *   $error: Element
 *   $resetLink?: Element
 *   $textarea: HTMLTextAreaElement
 * }} options
 */
function initRegexSetting({key, $error, $resetLink, $textarea}) {
  $textarea.addEventListener('input', () => {
    autoResize($textarea)
    let source = $textarea.value
    // If empty, clear immediately if it was previously set
    if (!source.trim()) {
      setStateDebounced.cancel(key)
      if (config[key]) {
        setState({
          [key]: '',
          [`${key}Error`]: null,
        })
      }
      return
    }
    let error = validateRegexInput(source)
    if (error) {
      setStateDebounced(key, {[key]: source, [`${key}Error`]: error})
      return
    }
    // Immediately clear any error if an invalid regex becomes valid
    if (config[`${key}Error`]) {
      clearError($textarea, $error)
      setStateDebounced.cancel(key)
    }
    setStateDebounced(key, {[key]: source, [`${key}Error`]: null})
  })

  $resetLink?.addEventListener('click', async (e) => {
    e.preventDefault()
    config[key] = DEFAULT_CONFIG[key]
    config[`${key}Error`] = null
    chrome.storage.local.onChanged.removeListener(onStorageChanged)
    try {
      await remove([key, `${key}Error`])
    } finally {
      chrome.storage.local.onChanged.addListener(onStorageChanged)
    }
    updateFormDisplay()
  })
}

/**
 * Store form <input> changes in extension storage.
 */
function onFormChanged(e) {
  // Textareas are handled separately
  if (e.target instanceof HTMLTextAreaElement) return
  let $el = /** @type {HTMLInputElement} */ (e.target)
  let prop = $el.name
  let value = $el.type == 'checkbox' ? $el.checked : $el.value
  setState({[prop]: value})
}

/**
 * @param {{[key: string]: chrome.storage.StorageChange}} changes
 */
function onStorageChanged(changes) {
  for (let prop in changes) {
    config[prop] = changes[prop].newValue
  }
  updateFormDisplay()
}

function onToggleCollapse(e) {
  if (theme == 'ios') return
  let collapsedGroups = config.collapsedGroups.slice()
  let collapseId = e.currentTarget.getAttribute('data-collapse-id')
  let index = collapsedGroups.indexOf(collapseId)
  if (index == -1) {
    collapsedGroups.push(collapseId)
  } else {
    collapsedGroups.splice(index, 1)
  }
  setState({collapsedGroups})
}

function saveCustomCss() {
  let customCss = $customCss.value
  if (config.customCss == customCss) return
  config.customCss = customCss
  storeChanges({customCss})
}

/**
 * Update display based on config.
 */
function updateDisplay() {
  $body.classList.toggle('darkMode', config.darkMode)
  $body.classList.toggle('hidingAiItems', config.hideAiItems)
  $body.classList.toggle('hidingCustomItems', config.hideCustomItems)
  if (!config.collapsedGroups.includes('list')) {
    if (config.hideAiItems) {
      requestAnimationFrame(() => {
        autoResize($hideAiSiteRegex)
        autoResize($hideAiTitleRegex)
      })
    }
    if (config.hideCustomItems) {
      requestAnimationFrame(() => {
        autoResize($hideCustomSiteRegex)
        autoResize($hideCustomTitleRegex)
      })
    }
  }
  if (!config.collapsedGroups.includes('developer')) {
    requestAnimationFrame(() => {
      autoResize($customCss)
    })
  }
  updateCollapsedOptionGroupsDisplay()
  updateRegexSettingDisplay({
    $error: $hideAiSiteRegexError,
    $resetLink: $hideAiSiteRegexResetLink,
    $textarea: $hideAiSiteRegex,
    key: 'hideAiSiteRegex',
  })
  updateRegexSettingDisplay({
    $error: $hideAiTitleRegexError,
    $resetLink: $hideAiTitleRegexResetLink,
    $textarea: $hideAiTitleRegex,
    key: 'hideAiTitleRegex',
  })
  updateRegexSettingDisplay({
    $error: $hideCustomSiteRegexError,
    $textarea: $hideCustomSiteRegex,
    key: 'hideCustomSiteRegex',
  })
  updateRegexSettingDisplay({
    $error: $hideCustomTitleRegexError,
    $textarea: $hideCustomTitleRegex,
    key: 'hideCustomTitleRegex',
  })
}

/**
 * Update form controls and display based on config.
 */
function updateFormDisplay() {
  for (let key of Object.keys(config)) {
    if (key in $form.elements) {
      updateFormControl($form.elements[key], config[key])
    }
  }
  updateDisplay()
}

/**
 * Update config, persist the changes, then update the UI.
 * @param {Partial<import('./types').Config>} changes
 * @param {() => void} [updateFn]
 */
function setState(changes, updateFn = updateDisplay) {
  Object.assign(config, changes)
  storeChanges(changes)
  updateFn?.()
}

let setStateDebounced = debounceByKey(setState)

/**
 * @param {Partial<import('./types').Config>} changes
 */
async function storeChanges(changes) {
  chrome.storage.local.onChanged.removeListener(onStorageChanged)
  try {
    await set(changes)
  } finally {
    chrome.storage.local.onChanged.addListener(onStorageChanged)
  }
}

/**
 * @param {{
 *   key: string
 *   $error: Element
 *   $resetLink?: Element
 *   $textarea: HTMLTextAreaElement
 * }} options
 */
function updateRegexSettingDisplay({key, $error, $resetLink, $textarea}) {
  if (config[`${key}Error`]) {
    showError($textarea, $error, config[`${key}Error`])
  } else {
    clearError($textarea, $error)
  }
  if ($resetLink) {
    if (config[key] != DEFAULT_CONFIG[key]) {
      $resetLink.removeAttribute('hidden')
    } else {
      $resetLink.setAttribute('hidden', '')
    }
  }
}
//#endregion

//#region Main
async function main() {
  let storedConfig = await(get())
  config = {...DEFAULT_CONFIG, ...storedConfig}

  for (let $label of $collapsibleLabels) {
    $label.addEventListener('click', onToggleCollapse)
  }
  $customCss.addEventListener('input', () => autoResize($customCss))
  $customCss.addEventListener('keydown', (e) => {
    if (e.isComposing) return
    if (e.key == 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      saveCustomCss()
    }
  })
  $form.addEventListener('change', onFormChanged)
  initRegexSetting({
    key: 'hideAiSiteRegex',
    $error: $hideAiSiteRegexError,
    $resetLink: $hideAiSiteRegexResetLink,
    $textarea: $hideAiSiteRegex,
  })
  initRegexSetting({
    key: 'hideAiTitleRegex',
    $error: $hideAiTitleRegexError,
    $resetLink: $hideAiTitleRegexResetLink,
    $textarea: $hideAiTitleRegex,
  })
  initRegexSetting({
    key: 'hideCustomSiteRegex',
    $error: $hideCustomSiteRegexError,
    $textarea: $hideCustomSiteRegex,
  })
  initRegexSetting({
    key: 'hideCustomTitleRegex',
    $error: $hideCustomTitleRegexError,
    $textarea: $hideCustomTitleRegex,
  })
  $openInTabLink.addEventListener('click', (e) => {
    e.preventDefault()
    chrome.tabs.create({
      url: `${chrome.runtime.getURL('options.html')}?tab=true${$openInTabLink.hash}`,
      active: true,
    })
    window.close()
  })
  $saveCustomCssButton.addEventListener('click', saveCustomCss)

  chrome.storage.local.onChanged.addListener(onStorageChanged)
  updateFormDisplay()
}

main()
//#endregion