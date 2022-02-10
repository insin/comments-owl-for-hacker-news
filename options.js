let form = document.querySelector('form')

function setFormValue(prop, value) {
  if (!form.elements.hasOwnProperty(prop)) return

  let $el = /** @type {HTMLInputElement} */ (form.elements[prop])
  if ($el.type == 'checkbox') {
    $el.checked = value
  } else {
    $el.value = value
  }
}

/** @type {import("./types").Config} */
let defaultConfig = {
  addUpvotedToHeader: true,
  autoHighlightNew: true,
  hideReplyLinks: false,
}

/** @type {import("./types").Config} */
let optionsConfig

chrome.storage.local.get((storedConfig) => {
  optionsConfig = {...defaultConfig, ...storedConfig}

  for (let [prop, value] of Object.entries(optionsConfig)) {
    setFormValue(prop, value)
  }

  form.addEventListener('change', (e) => {
    let target = /** @type {HTMLInputElement} */ (e.target)
    let prop = target.name
    let value = target.type == 'checkbox' ? target.checked : target.value
    chrome.storage.local.set({[prop]: value})
  })

  chrome.storage.onChanged.addListener((changes) => {
    for (let prop in changes) {
      optionsConfig[prop] = changes[prop].newValue
      setFormValue(prop, changes[prop].newValue)
    }
  })
})
