chrome.storage.local.get((storedConfig) => {
  let config = {
    autoHighlightNew: true,
    addUpvotedToHeader: true,
    enableDebugLogging: false,
    ...storedConfig,
  }

  let form = document.querySelector('form')

  form.addEventListener('change', ({target}) => {
    let prop = target.name
    let value = target.type == 'checkbox' ? target.checked : target.value
    config[prop] = value
    chrome.storage.local.set({[prop]: value})
  })

  for (let [prop, value] of Object.entries(config)) {
    if (!form.elements.hasOwnProperty(prop)) {
      continue
    }
    if (form.elements[prop].type == 'checkbox') {
      form.elements[prop].checked = value
    }
    else {
      form.elements[prop].value = value
    }
  }
})
