let form = document.querySelector('form')

function setFormValue(prop, value) {
  if (!form.elements.hasOwnProperty(prop)) {
    return
  }
  let $el = form.elements[prop]
  if ($el.type == 'checkbox') {
    $el.checked = value
  }
  else {
    $el.value = value
  }
}

chrome.storage.local.get((storedConfig) => {
  let config = {
    addUpvotedToHeader: true,
    autoHighlightNew: true,
    enableDebugLogging: false,
    hideReplyLinks: false,
    ...storedConfig,
  }

  for (let [prop, value] of Object.entries(config)) {
    setFormValue(prop, value)
  }

  form.addEventListener('change', ({target}) => {
    let prop = target.name
    let value = target.type == 'checkbox' ? target.checked : target.value
    chrome.storage.local.set({[prop]: value})
  })

  chrome.storage.onChanged.addListener((changes) => {
    for (let prop in changes) {
      config[prop] = changes[prop].newValue
      setFormValue(prop, changes[prop].newValue)
    }
  })
})
