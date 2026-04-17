function show(platform, enabled) {
  document.body.classList.add(`platform-${platform}`)
  if (typeof enabled == 'boolean') {
    document.body.classList.toggle('state-on', enabled)
    document.body.classList.toggle('state-off', !enabled)
  }
  else if (platform == 'mac') {
    document.body.classList.add('state-unknown')
  }
}

document.querySelector('button.open-preferences').addEventListener('click', () => {
  webkit.messageHandlers.controller.postMessage('open-preferences')
})

document.querySelector('.ad').addEventListener('click', () =>{
  webkit.messageHandlers.controller.postMessage('open-ad')
})
