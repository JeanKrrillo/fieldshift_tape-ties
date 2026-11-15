// Conexión del robot: no hay emparejamiento simulado. El robot manda sus lecturas a una hoja de Google
// (o por archivo) y se conecta desde la sección Robot. Este módulo solo lleva a esa sección.
(function () {
  "use strict";
  const V2Emparejar = {
    abrirAsistente() {
      if (window.V2.modal) window.V2.closeModal();
      window.V2.setSpace("mapa");
    },
    renderModalContent() { return ""; },
    renderModalHtml() { return ""; },
  };
  window.V2Emparejar = V2Emparejar;
})();
