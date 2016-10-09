var services = angular.module('started.services', []);
//SERVICIO PARA CONOCER EL ESTADO DE CONEXION DEL DISPOTIVO
services.service('connectionService', ['$rootScope', '$cordovaNetwork', function($rootScope, $cordovaNetwork) {
  document.addEventListener("deviceready", function() {
    // listen for Online event
    $rootScope.$on('$cordovaNetwork:online', function(event, networkState) {
      $rootScope.$broadcast('change-state', {
        state: false
      });
    });
    // listen for Offline event
    $rootScope.$on('$cordovaNetwork:offline', function(event, networkState) {
      $rootScope.$broadcast('change-state', {
        state: true
      });
    });
  }, false);
}]);
//SERVICIO MANAGER DE LAS BASES DE DATOS DE LA APLICACION (LOCAL,REMOTA)
services.service('pouchDBService', ['$rootScope', function($rootScope) {
  var db;
  var remote;
  var remoteActive;
  //INSTANCIA LA BASE DE DATOS LOCAL
  this.init = function() {
    db = new PouchDB('bdLocal');
  };

  this.getDBLocal = function() {
    return db;
  };
  //DEFINE SI LA BASE DE DATOS PRINCIPAL ES LA LOCAL O LA REMOTA
  this.setRemoteActive=function (value) {
    remoteActive=value;
  };
  //SI EL RETORNO ES TRUE LA BASE DE DATOS PRINCIPAL DE LA APLCIACION ES LA REMOTA
  //DE LO CONTRARIO LA BASE DE LA APLCIACION ES LA LOCAL
  this.getRemoteActive=function () {
    return remoteActive;
  };
  //ACTUALIZA LA BASE DE DATOS LOCAL
  this.update = function(user) {
    db.destroy().then(function() {
      db = new PouchDB('bdLocal');
      return db;
    }).then(function(dbaux) {
       var  carrito =user.carritoCompras.lineasTiempo;
        dbaux.replicate.from(remote, {
          live: true,retry:true,continuos:true,
          filter: function(doc) {
            if(doc._id===user._id){
              return doc;
            }
            for (var i = 0; i < carrito.length; i++) {
              if (doc._id == carrito[i].id_timeline) {
                return doc;
              }
            }
          }
        });
    });
  };
//INICIALIZA LA BASE DE DATOS REMOTA
  this.initRemote = function(url) {
    remote = new PouchDB(url);
  };

  this.getDBRemote = function() {
    return remote;
  };
}]);
//FACTORY DATA EN LA CUAL SE ALAMACENAN LOS DATOS DE LA APLICACION
services.factory('data', ['pouchDBService', '$window', '$rootScope','$q', function(pouchDBService, $window, $rootScope,$q) {
  var fact = {};
  var timelines = [];
  var nombreTimeline="";
  var eventos = [];
  var urls = {};
  var usuario = {};
  var id_adquiridas = [];
  var loadingImgs;
  //INICIALIZA EL USUARIO
  fact.initUser = function(user) {
    usuario = user;
    id_adquiridas = usuario.carritoCompras.lineasTiempo;
  };
  fact.getUser = function() {
    return usuario;
  };
  fact.getTimelines=function () {
    return timelines;
  };
  //DEFINE SI UNA LINEA DE TIEMPO HACE PARTE O NO DEL CARRITO DE ADQUIRIDAS DEL USUARIO
  fact.isAquirida = function(id) {
    for (var i = 0; i < id_adquiridas.length; i++) {
      if (id_adquiridas[i].id_timeline === id) {
        return true;
      }
    }
    return false;
  };
  //ACTUALIZA EL CARRITO DE COMPRAS DEL USUARIO
  fact.updateAdquiridas=function (timelinesAdquiridas) {
    id_adquiridas=timelinesAdquiridas;
    for (var i = 0; i < timelines.length; i++) {
      if(fact.isAquirida(timelines[i]._id)){
        timelines[i].isAquirida=true;
      }else {
        timelines[i].isAquirida=false;
      }
    }
  };
  //ACTULIZA EL DOCUMENTO DE UNA LINEA DE TIEMPO
  fact.updateTimeline=function (docTimeline) {
    for (var i = 0; i < timelines.length; i++) {
      if(timelines[i]._id===docTimeline._id){
        timelines[i]=docTimeline;
        break;
      }
    }
  };
  //CLASIFICA LAS LINEAS DE TIEMPO PARA IDENTIFICAR LAS ADQUIRIDAS Y LAS DEMAS
  fact.clasificarTimelines = function(docs, value) {
    var lineasTiempo = {
      adquiridas: [],
      restantes: []
    };

    for (var i = 0; i < docs.length; i++) {
      if (fact.isAquirida(docs[i]._id)) {
        lineasTiempo.adquiridas.push(docs[i]);
      } else {
        lineasTiempo.restantes.push(docs[i]);
      }
    }
    return lineasTiempo;
  };

  fact.addTimeline = function(timeline) {
    timelines.push(timeline);
  };

  fact.getTimeline = function(idTimeline) {
    for (var i = 0; i < timelines.length; i++) {
      if (timelines[i]._id === idTimeline) {
        nombreTimeline=timelines[i].titulo;
        return timelines[i];
      }
    }
    return null;
  };
  fact.getNombreTimeline=function () {
    return nombreTimeline;
  }
  fact.getEvnById=function (id) {
    var data={};
    var evnts = eventos;
    for (var i = 0; i < evnts.length; i++) {
      if(evnts[i].id===id){
        return {evento:evnts[i],pos:i};
      }
    }
  }
  /*LANZA LA PROMESA PARA OBTENER EL ATACHMENT DE LA BASE DE DATOS Y OBTENER LA URL EN DATA 64
  doc._id= id del documento de la liena de tiempo
  attachment=nombre de la imagen ej:rafael.jpg
  bd= base de datos activa en la aplciacion*/
  fact.llenarUrl = function(id,evento,bd) {
    return bd.getAttachment(id, evento.imagenEvento.idImagen).then(function(blob) {
      var url = $window.URL || $window.webkitURL;
      resultado = url.createObjectURL(blob);
      evento.imagen=resultado;
      return;
    },function (error) {
      evento.imagen="img/defauld.jpg";
      return;
    });
  };
  fact.llenarUrlGaleria=function (id,itemGaleria,bd) {
    return bd.getAttachment(id, itemGaleria.idImagen).then(function(blob) {
      var url = $window.URL || $window.webkitURL;
      resultado = url.createObjectURL(blob);
      itemGaleria.imagen=resultado;
      return;
    },function (error) {
      itemGaleria.imagen="img/defauld.jpg";
      return;
    });
  }
  fact.getUrls = function() {
    return urls;
  };

  //GENERA LAS URL DE LAS IMAGENES DE LA APLICACION
  fact.generarUrls = function(timeline,bd) {
    loadingImgs=true;
    var promesas=[];
    var id = timeline._id;
    var evnts = timeline.eventos;
    eventos = evnts;
    //RECORRE LOS EVENTOS DE UNA LIENA DE TIEMPO
    for (var i = 0; i < evnts.length; i++) {
      //LLAMADO A LA PROMESA PARA OBTENER LA IMAGEN DEL EVENTO
      if(evnts[i].imagenEvento.idImagen!==""){
      var promesa=this.llenarUrl(id, evnts[i],bd);
      promesas.push(promesa);
      }else {
        evnts[i].imagen="img/defauld.jpg";
      }
      if(evnts[i].start===undefined||evnts.start===""){
        evnts[i].start=evnts[i].fecha;
      }
      if (evnts[i].galeria !== undefined) {
        for (var j = 0; j < evnts[i].galeria.length; j++) {
          if (evnts[i].galeria[j].idImagen !== "") {
            this.llenarUrlGaleria(timeline._id, evnts[i].galeria[j],bd);
          }
          else {
            evnts[i].galeria[j].imagen="img/defauld.jpg";
          }
        }
      }
    }
    var listaPromesas=$q.all(promesas).then(function () {
      loadingImgs=false;
      $rootScope.$broadcast('eventsLoad');
    });
  };

  //DEVUELVE TODOS LOS EVENTOS DE UNA LINEA DE TIEMPO
  fact.getEventos = function(timeline) {
    return eventos;
  };

  fact.getAllEvents = function() {
    return eventos;
  };
  fact.getStatusCarga=function () {
    return loadingImgs;
  }
  //ELIMINA LOS DATOS ALMACENADOS DE LA APLICACION
  fact.eliminarDatos = function() {
    timelines = [];
    eventos = [];
    urls = {};
    usuario = {};
  };
  return fact;
}]);
