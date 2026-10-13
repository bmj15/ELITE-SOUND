// public_html/js/api.js
// Incluído em todas as páginas, antes dos outros scripts.
// O site é servido pelo próprio backend, por isso a API está em /api na mesma origem.
// Envia automaticamente o token de sessão em todas as chamadas à API.
(function () {
  const originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input.url;
    const token = localStorage.getItem('token');
    if (token && /^\/api(\/|\?|$)/.test(url)) {
      init = init || {};
      const headers = new Headers(init.headers || {});
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      init = Object.assign({}, init, { headers });
    }
    return originalFetch(input, init);
  };
})();
