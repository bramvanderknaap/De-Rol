// Zet het gekozen thema vóór het tekenen, zodat de pagina niet eerst in het verkeerde thema verschijnt.
try {
  var t = localStorage.getItem('thema')
  if (t === 'licht' || t === 'donker') document.documentElement.dataset.thema = t
} catch (e) {}
