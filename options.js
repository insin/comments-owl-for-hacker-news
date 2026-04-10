import {DEFAULT_CONFIG} from './settings.js'
import {get, remove, set} from './storage.js'

let $body = document.body

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
  'addUpvotedToHeader',
  'autoCollapseNotNew',
  'autoHighlightNew',
  'clickHeaderToCollapse',
  'commentPagesOptions',
  'debug',
  'debugInfo',
  'developerOptions',
  'hideAiItems',
  'hideAiSiteRegex',
  'hideAiTitleRegex',
  'hideCommentsNav',
  'hideJobsNav',
  'hidePastNav',
  'hideReplyLinks',
  'hideSubmitNav',
  'listPagesOptions',
  'makeSubmissionTextReadable',
  'navigationOptions',
  'preventAccidentally',
  'preventAccidentallyInfo',
]) {
  let $el = document.getElementById(translationId)
  if ($el) {
    $el.textContent = chrome.i18n.getMessage(translationId)
  } else {
    console.warn('could not find element for translationId', translationId)
  }
}

for (let translationClass of [
  'resetLink',
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
//#endregion

//#region Config & variables
/** @type {import("./types").Config} */
let config

// Page elements
let $collapsibleLabels = document.querySelectorAll('section.labelled.collapsible > label[data-collapse-id]')
let $form = document.querySelector('form')
let $hideAiSiteRegex = /** @type {HTMLTextAreaElement} */ (document.querySelector('textarea#hideAiSiteRegex'))
let $hideAiSiteRegexError = document.querySelector('#hideAiSiteRegexError')
let $hideAiSiteRegexResetLink = document.querySelector('a#hideAiSiteRegexResetLink')
let $hideAiTitleRegex = /** @type {HTMLTextAreaElement} */ (document.querySelector('textarea#hideAiTitleRegex'))
let $hideAiTitleRegexError = document.querySelector('#hideAiTitleRegexError')
let $hideAiTitleRegexResetLink = document.querySelector('a#hideAiTitleRegexResetLink')
//#endregion

//#region Utility functions
function autoResize($textarea) {
  if (!$textarea.offsetParent) return
  if (!$textarea.hasAttribute('data-border-height')) {
    let {borderBottomWidth, borderTopWidth} = getComputedStyle($textarea)
    $textarea.setAttribute('data-border-height', parseFloat(borderBottomWidth) + parseFloat(borderTopWidth))
  }
  $textarea.style.height = 'auto';
  $textarea.style.height = Math.ceil($textarea.scrollHeight) + parseFloat($textarea.getAttribute('data-border-height')) + 'px'
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

function validateRegex(regex) {
  try {
    new RegExp(regex)
  } catch(e) {
    let message = e.message
    // Chrome errors include the full source
    if (message.includes(regex)) {
      message = message.replace(regex, '…')
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
//#endregion

//#region Options page functions
/**
 * @param {{
 *   key: string
 *   $error: Element
 *   $resetLink: Element
 *   $textarea: HTMLTextAreaElement
 * }} options
 */
function initRegexSetting({key, $error, $resetLink, $textarea}) {
  $textarea.addEventListener('input', () => {
    autoResize($textarea)
    let regex = $textarea.value
    // If empty, clear immediately if it was previously set
    if (!regex.trim()) {
      setStateDebounced.cancel(key)
      if (config[key]) {
        setState({
          [key]: '',
          [`${key}Error`]: null,
        })
      }
      return
    }
    let error = validateRegex(regex)
    if (error) {
      setStateDebounced(key, {[key]: regex, [`${key}Error`]: error})
      return
    }
    // Immediately clear any error if an invalid regex becomes valid
    if (config[`${key}Error`]) {
      clearError($textarea, $error)
      setStateDebounced.cancel(key)
    }
    setStateDebounced(key, {[key]: regex, [`${key}Error`]: null})
  })

  $resetLink.addEventListener('click', async (e) => {
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

/**
 * Update display based on config.
 */
function updateDisplay() {
  $body.classList.toggle('hidingAiItems', config.hideAiItems)
  if (config.hideAiItems) {
    requestAnimationFrame(() => {
      autoResize($hideAiSiteRegex)
      autoResize($hideAiTitleRegex)
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
 *   $resetLink: Element
 *   $textarea: HTMLTextAreaElement
 * }} options
 */
function updateRegexSettingDisplay({key, $error, $resetLink, $textarea}) {
  if (config[`${key}Error`]) {
    showError($textarea, $error, config[`${key}Error`])
  } else {
    clearError($hideAiTitleRegex, $hideAiTitleRegexError)
  }
  if (config[key] != DEFAULT_CONFIG[key]) {
    $resetLink.removeAttribute('hidden')
  } else {
    $resetLink.setAttribute('hidden', '')
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

  chrome.storage.local.onChanged.addListener(onStorageChanged)
  updateFormDisplay()
}

main()
//#endregion