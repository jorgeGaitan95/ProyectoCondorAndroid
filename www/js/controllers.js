var controllers = angular.module('started.controllers', []);
controllers.controller('appCtrl', ['data', 'pouchDBService', '$scope', '$state', '$ionicHistory', '$rootScope', function(data, pouchDBService, $scope, $state, $ionicHistory, $rootScope) {
  $scope.actualizar = false;
  $scope.user = data.getUser();
  $scope.reload = function() {
      $rootScope.$broadcast('reload-timeline');
      $scope.actualizar = false;
      $state.go('app.store');
  };
  $scope.logOut = function() {
    data.eliminarDatos();
    $scope.user = {};
    $ionicHistory.clearCache().then(function() {
      $state.go('login');
    });
  };
  if ($scope.user.username !== undefined) {
    pouchDBService.update($scope.user);
  }
  //maneja los cambios en la base de datos remota(cloudant)
  pouchDBService.getDBRemote().changes({
    since: 'now',
    live: true,
    include_docs: true
  }).on("change", function(change) {
    var doc = change.doc;
    if (doc._id === $scope.user._id) {
      var usuario = $scope.user;
      if (usuario.carritoCompras.lineasTiempo !== doc.carritoCompras.lineasTiempo) {
        data.updateAdquiridas(doc.carritoCompras.lineasTiempo);
        $rootScope.$broadcast('change-items', {
          state: true,
          doc: doc,
          changeCarAdquiridas:true
        });
      }
    }
    if (doc.tipo === 'LineaTiempo') {
      if (data.isAquirida(doc._id)) {
        $scope.actualizar = true;
        $scope.$digest();
        $rootScope.$broadcast('change-items', {
          state: true,
          doc: doc
        });
      }
    }
  });
}]);
//controlador de la vista LOGIN
controllers.controller('loginCtrl', ['$scope', 'pouchDBService', 'data', '$state', '$ionicPopup','$ionicLoading', '$rootScope', function($scope, pouchDBService, data, $state, $ionicPopup,$ionicLoading, $rootScope) {

  $scope.loginData = {};
  $scope.sinConexion = false;
  //escuchador en los cambios de conexion (offline , online)
  $scope.$on('change-state', function(event, args) {
    $scope.sinConexion = args.state;
    $scope.$digest();
  });
  $scope.doLogin = function() {
    //el dispositivo del usurio tiene CONEXIÓN a intenet
    $ionicLoading.show({
      template: '<p class="item-icon-left">Autenticando ...<ion-spinner icon="lines"/></p>'
    });
    if ($scope.sinConexion === false) {
      pouchDBService.getDBRemote().query('lineas/lineasUser', {
        key: [$scope.loginData.username],
        include_docs: true
      }).
      then(function(result) {
        var doc = result.rows[0].doc;
        if (doc.contraseña === $scope.loginData.password) {
          data.initUser(doc);
          pouchDBService.setRemoteActive(true);
          $state.go('app.store');
        } else {
          $ionicLoading.hide();
          $ionicPopup.alert({
            title: 'Error de Autenticacion!',
            template: 'la contraseña ingresada es incorrecta.'
          });
        }
      }).catch(function(err) {
        if(err.code==='ETIMEDOUT'){
          $ionicPopup.alert({
            title: 'Error de Autenticacion!',
            template: 'Problemas con la conexion a internet'
          });
        }
        else if(err.message==="Cannot read property 'doc' of undefined"){
          $ionicPopup.alert({
            title: 'Error de Autenticacion!',
            template: 'el usuario ingresado no se encuentra registrado'
          });
        }else{
          $ionicPopup.alert({
            title: 'Error de Autenticacion!',
            template: 'Existen problemas para iniciar sesion'
          });
        }
        $ionicLoading.hide();
      });
    }else {
      var username = $scope.loginData.username;
      pouchDBService.getDBLocal().query(function(doc) {
        if (doc.tipo == 'user') {
          emit(doc.username, doc);
        }
      }, {
        key: username,
        include_docs: true
      }).then(function(result) {
        var doc = result.rows[0].doc;
        if (doc.contraseña === $scope.loginData.password) {
          data.initUser(doc);
          $scope.loginData = {};
          pouchDBService.setRemoteActive(false);
          $state.go('app.store');
        } else {
          $ionicLoading.hide();
          $ionicPopup.alert({
            title: 'Error de Autenticacion!',
            template: 'la contraseña ingresada es incorrecta.'
          });
        }
      }).catch(function(err) {
        $ionicLoading.hide();
        $ionicPopup.alert({
          title: 'Error de Autenticacion!',
          template: 'el usuario ingresado no se encuentra registrado'
        });
      });
    }
  };
}]);
//controlador de la vista Detalles
controllers.controller('detallesCtrl', ['$scope', 'pouchDBService', '$stateParams', 'data', '$state', '$location', function($scope, pouchDBService, $stateParams, data, $state, $location) {
  //define la base de datos de la aplicacion deacuerdo al modo de ingreso a la aplicacion (offline, online)
  var db;
  if (pouchDBService.getRemoteActive() === true) {
    db = pouchDBService.getDBRemote();
  } else {
    db = pouchDBService.getDBLocal();
  }
  //escuchador del estado de conexion a internet del dispositivo
  $scope.conexion = false;
  $scope.$on('change-state', function(event, args) {
    $scope.conexion = args.state;
  });

  $scope.active = function() {
    return $scope.panes.filter(function(pane) {
      return pane.active;
    })[0];
  };

  $scope.timeline = data.getTimeline($stateParams.idTimeline);
  /*mediante esta funcion se empiezan a generar las Urls de las imagenes de los eventos
  y galerias*/
  data.generarUrls($scope.timeline, db);
  //tabs
  $scope.panes = [{
    title: "Descripcion",
    content: $scope.timeline.descripcion,
    active: true
  }, {
    title: "Detalles",
    content: "content 2"
  }, {
    title: "Comentarios",
    content: "content 3"
  }];
  //accede a  la vista de la linea de tiempo
  $scope.goTimeline = function(id) {
    $location.path('app/timeline');
  };
}]);
//controlador de la vista STORE
controllers.controller('storeCtrl', ["data", "$scope", "pouchDBService", '$ionicLoading','$location', '$ionicScrollDelegate', '$window', '$rootScope', function(data, $scope, pouchDBService, $ionicLoading,$location,$ionicScrollDelegate, $window, $rootScope) {
  //define la base de datos de la aplicacion deacuerdo al modo de ingreso a la aplicacion (offline, online)
  var db;
  if (pouchDBService.getRemoteActive() === true) {
    db = pouchDBService.getDBRemote();
  } else {
    db = pouchDBService.getDBLocal();
  }
  $scope.viewDetails=function (path) {
    path='app/store/'+path;
    console.log(path);
    $location.path(path);
  }
  $scope.lineasTiempo=[];
   //FUNCIONES PARA OBTENER LAS LINEAS DE TIEMPO de la base de datos
    var getTimelines=function () {
      db.allDocs({
        include_docs: true
      }).then(function(result) {
        for (var i = 0; i < result.rows.length; i++) {
          var doc = result.rows[i].doc;
          if (doc.tipo === 'LineaTiempo') {
            //llamado al metodo encargado de generar la URL de la iamgen de la liena de tiempo
            asha(doc);
          }
        }
        $ionicLoading.hide();
      }).catch(function(err) {
        console.log(err);
      });
    };
    //funcion para obtener las imagenes de la linea de tiemp, recibe como parametro el documento de la linea de tiempo
    //despues de obtener la imagen añade el doc a la lista que se renderiza en el store $scope.lineasTiempo
    var asha = function(doc) {
      if (data.isAquirida(doc._id)) {
        doc.isAquirida = true;
        if (doc.imagenTimeline.idImagen !== undefined) {
          //promesa para obtener la imagen de la linea de tiempo
          db.getAttachment(doc._id, doc.imagenTimeline.idImagen).then(function(blob) {
            var url = $window.URL || $window.webkitURL;
            doc.img = url.createObjectURL(blob);
            //añade la linea de tiempo a la lista
            $scope.lineasTiempo.push(doc);
            $scope.$digest();
            data.addTimeline(doc);
          }).catch(function(err) {
            console.log(err);
          });
        } else {
          $scope.lineasTiempo.push(obj);
          $scope.$digest();
        }
      }
    };
   getTimelines();

  $scope.actualizar = false;
  //escuchador de los cambios en la base de datos remota
  $scope.$on('change-items', function(event, args) {
    //Actualiza el carrito de aquiridas
    if (args.changeCarAdquiridas) {
      $scope.lineasTiempo=data.getTimelines();
      $scope.$digest();
    }
    //Actuliza la linea de tiempo que fue modificada en cloudant
    else {
      data.updateTimeline(args.doc);
      $scope.actualizar = args.state;
      $scope.$digest();
    }
  });
  $scope.conexion = false;
  $scope.$on('change-state', function(event, args) {
    $scope.conexion = args.state;
  });
  //actualiza las lineas de tiempo (solo se activa cuando el usuario quiere aplicar los cambios)
  $scope.$on('reload-timeline', function() {
      $scope.actualizar = false;
      $scope.lineasTiempo=data.getTimelines();
      $scope.$digest();
  });
  //PANTILLA DE LOADING
  $ionicLoading.show({
    template: '<p class="item-icon-left">Cargando ...<ion-spinner icon="lines"/></p>'
  });

  //OBTINE LOS ITEMS QUE APARECEN EN CADA UNA DE LAS CATEGORIAS  DE LOS FILTROS (omite elementos repetidos)
  var uniqueItems = function(data, key) {
    var result = [];
    for (var i = 0; i < data.length; i++) {
      var value = data[i][key];
      if (result.indexOf(value) == -1) {
        result.push(value);
      }
    }
    return result;
  };

  //VARIABLES Y FUNCIONES PARA LOS FILTROS
  $scope.Areas = {};
  $scope.Temas = {};
  $scope.Materias = {};
  $scope.Pais = {};
  $scope.Departamento = {};
  $scope.Ciudad = {};
  $scope.Colegio = {};
  $scope.Profesor = {};
  $scope.Alumno = {};

  $scope.$watch(function() {
    return {
      lineasTiempo: $scope.lineasTiempo,
      Areas: $scope.Areas,
      Temas: $scope.Temas,
      Materias: $scope.Materias,
      Pais: $scope.Pais,
      Departamento: $scope.Departamento,
      Ciudad: $scope.Ciudad,
      Colegio: $scope.Colegio,
      Profesor: $scope.Profesor,
      Alumno: $scope.Alumno
    };
  }, function(value) {
    var selected;
    $scope.count = function(prop, value) {
      return function(el) {
        return el[prop] == value;
      };
    };
    $scope.AreaGroup = uniqueItems($scope.lineasTiempo, 'area');
    var filterAfterArea = [];
    selected = false;
    for (var j in $scope.lineasTiempo) {
      var p = $scope.lineasTiempo[j];
      for (var i in $scope.Areas) {
        if ($scope.Areas[i]) {
          selected = true;
          if (i == p.area) {
            filterAfterArea.push(p);
            break;
          }
        }
      }
    }
    if (!selected) {
      filterAfterArea = $scope.lineasTiempo;
    }
    $scope.MateriasGroup = uniqueItems($scope.lineasTiempo, 'materia');
    var filterAfterMateria = [];
    selected = false;
    for (var j in filterAfterArea) {
      var p = filterAfterArea[j];
      for (var i in $scope.Materias) {
        if ($scope.Materias[i]) {
          selected = true;
          if (i == p.materia) {
            filterAfterMateria.push(p);
            break;
          }
        }
      }
    }
    if (!selected) {
      filterAfterMateria = filterAfterArea;
    }
    $scope.TemasGroup = uniqueItems($scope.lineasTiempo, 'tema');
    var filterAfterTema = [];
    selected = false;
    for (var j in filterAfterMateria) {
      var p = filterAfterMateria[j];
      for (var i in $scope.Temas) {
        if ($scope.Temas[i]) {
          selected = true;
          if (i == p.tema) {
            filterAfterTema.push(p);
            break;
          }
        }
      }
    }
    if (!selected) {
      filterAfterTema = filterAfterMateria;
    }
    $scope.ColegiosGroup = uniqueItems($scope.lineasTiempo, 'colegio');
    var filterAfterColegio = [];
    selected = false;
    for (var j in filterAfterTema) {
      var p = filterAfterTema[j];
      for (var i in $scope.Colegio) {
        if ($scope.Colegio[i]) {
          selected = true;
          if (i == p.colegio) {
            filterAfterColegio.push(p);
            break;
          }
        }
      }
    }
    if (!selected) {
      filterAfterColegio = filterAfterTema;
    }
    $scope.ProfesoresGroup = uniqueItems($scope.lineasTiempo, 'profesor');
    var filterAfterProfesor = [];
    selected = false;
    for (var j in filterAfterColegio) {
      var p = filterAfterColegio[j];
      for (var i in $scope.Profesor) {
        if ($scope.Profesor[i]) {
          selected = true;
          if (i == p.profesor) {
            filterAfterProfesor.push(p);
            break;
          }
        }
      }
    }
    if (!selected) {
      filterAfterProfesor = filterAfterColegio;
    }
    $scope.AlumnosGroup = uniqueItems($scope.lineasTiempo, 'alumno');
    var filterAfterAlumno = [];
    selected = false;
    for (var j in filterAfterProfesor) {
      var p = filterAfterProfesor[j];
      for (var i in $scope.Alumno) {
        if ($scope.Alumno[i]) {
          selected = true;
          if (i == p.alumno) {
            filterAfterAlumno.push(p);
            break;
          }
        }
      }
    }
    if (!selected) {
      filterAfterAlumno = filterAfterProfesor;
    }
    $scope.paisGroup = uniqueItems($scope.lineasTiempo, 'pais');
    var filterAfterPais = [];
    selected = false;
    for (var j in filterAfterAlumno) {
      var p = filterAfterAlumno[j];
      for (var i in $scope.Pais) {
        if ($scope.Pais[i]) {
          selected = true;
          if (i == p.pais) {
            filterAfterPais.push(p);
            break;
          }
        }
      }
    }
    if (!selected) {
      filterAfterPais = filterAfterAlumno;
    }
    $scope.DepartamentoGroup = uniqueItems($scope.lineasTiempo, 'departamento');
    var filterAfterDepartamento = [];
    selected = false;
    for (var j in filterAfterPais) {
      var p = filterAfterPais[j];
      for (var i in $scope.Departamento) {
        if ($scope.Departamento[i]) {
          selected = true;
          if (i == p.departamento) {
            filterAfterDepartamento.push(p);
            break;
          }
        }
      }
    }
    if (!selected) {
      filterAfterDepartamento = filterAfterPais;
    }
    $scope.CiudadesGroup = uniqueItems($scope.lineasTiempo, 'municipio');
    var filterAfterCiudad = [];
    selected = false;
    for (var j in filterAfterDepartamento) {
      var p = filterAfterDepartamento[j];
      for (var i in $scope.Ciudad) {
        if ($scope.Ciudad[i]) {
          selected = true;
          if (i == p.municipio) {
            filterAfterCiudad.push(p);
            break;
          }
        }
      }
    }
    if (!selected) {
      filterAfterCiudad = filterAfterDepartamento;
    }
    var result = data.clasificarTimelines(filterAfterCiudad);
    $scope.filteredAdquiridas = result.adquiridas;
    $ionicScrollDelegate.resize();
  }, true);

  //FUNCIONES PARA LOS GRUPOS DEL FILTRO
  $scope.toggleGroup = function(group) {
    if ($scope.isGroupShown(group)) {
      $scope.shownGroup = null;
    } else {
      $scope.shownGroup = group;
    }
  };
  $scope.isGroupShown = function(group) {
    return $scope.shownGroup === group;
  };
}]);
//controlador de la vista TIMELINE
controllers.controller('TimelineCtrl', ['data', '$scope', function(data, $scope) {
  //OBTIENE LOS EVENTOS DE LA LINEA DE TIEMPO
  $scope.nombreLineaTiempo=data.getNombreTimeline();
  $scope.eventos = data.getEventos();
  $scope.evento = {galeria:[]};
  $scope.indexEvento = 1;
  $scope.carouselIndex = 0;
  $scope.loading=data.getStatusCarga();
  $scope.mensajeEventos="";
  $scope.showMensajeEventos=false;
  $scope.idNextEvent="";
  $scope.idPrevEvent="";
  var timeline;
  var initTimeline=function () {
    //VARIABLES Y FUCIONES NECESARIAS PARA INICIALIZAR EL PLUGIN timeline del script vis.js
    var container = document.getElementById('visualization');
    var itemTemplate = Handlebars.compile(document.getElementById('item-template').innerHTML);
    var options = {
      height: '255px',
      min: new Date(1500, 0, 1),
      max: new Date(2500, 0, 1),
      showCurrentTime: false,
      zoomMin:1000*60*60*24*31,
      zoomMax:1000*60*60*24*31*12*500,
      template: itemTemplate
    };
    timeline = new vis.Timeline(container, $scope.eventos, options);
    timeline.setSelection(1, {
      focus: true
    });
    $scope.evento = timeline.itemsData.get('1');
    timeline.on('select', function(properties) {
      if (properties.items.length) {
        var id = properties.items.toString();
        $scope.evento = timeline.itemsData.get(id);
        $scope.carouselIndex = 0;
        $scope.indexEvento = id;
        $scope.$digest();
        timeline.setSelection(id, {
          focus: true
        });
      }
    });
    timeline.on('rangechange',function () {
      var rango=timeline.getWindow();
      var dateInicial=new Date(rango.start);
      var fechaFinal= new Date(rango.end);
      var arrayEventIzq=$scope.eventos.filter(function (obj) {
      return new Date(obj.start)<dateInicial;
      });
      $scope.evntsIzq=arrayEventIzq.length;
      if($scope.evntsIzq>0&&arrayEventIzq[$scope.evntsIzq-1]!==undefined)
      {
        $scope.idPrevEvent=arrayEventIzq[$scope.evntsIzq-1].id;
      }
      var arrayEventDerecha=$scope.eventos.filter(function (obj) {
        return new Date(obj.start)>fechaFinal;
      });
      $scope.evntsDerecha=arrayEventDerecha.length;
      if(arrayEventDerecha[0]!==undefined)
      {
        $scope.idNextEvent=arrayEventDerecha[0].id;
      }
      $scope.$digest();
      });
      timeline.on('rangechanged',function () {
        if(timeline.getVisibleItems().length>0){
          $scope.showMensajeEventos=false;
        }
        else{
          if($scope.evntsIzq>0&&$scope.evntsDerecha>0){
            $scope.mensajeEventos="Tienes mas eventos disponibles a la izquierda y a la derecha";
          }
          else if($scope.evntsIzq>0){
            $scope.mensajeEventos="tienes mas eventos disponibles a la izquierda";
          }
          else{
            $scope.mensajeEventos="tienes mas eventos disponibles a la derecha";
          }
          $scope.showMensajeEventos=true;
        }
        $scope.$digest();
      });
  }
  if($scope.loading===false){
    initTimeline();
  };
  $scope.$on('eventsLoad',function (event) {
    $scope.loading=false;
    initTimeline();
  });
  //define la plantilla que debe renderizar deacuerdo al tipo de template de la galeria
  $scope.getIncludeFile = function(tipo) {
    switch (tipo) {
      case "tipo2_Img":
        return 'templates/template-slider1.html';
      case "tipo1_Img_Texto":
        return 'templates/template-slider2.html';
      case "tipo3_Texto":
        return 'templates/template-texto.html';
      case "tipo4_video":
        return 'templates/template-video.html';
    }
  };
  //funcion para acceder al siguiente evento
  $scope.nextEvent = function() {
    if($scope.evntsDerecha>0){
      $scope.evento=data.getEvnById($scope.idNextEvent).evento;
      timeline.setSelection($scope.evento.id, {
        focus: true
      });
     $scope.carouselIndex = 0;
   }
    /*$scope.indexEvento = parseInt($scope.indexEvento);
    $scope.indexEvento = ($scope.indexEvento < timeline.itemsData.length) ? $scope.indexEvento + 1 : 1;
    timeline.setSelection($scope.indexEvento, {
      focus: true
    });
    $scope.evento = timeline.itemsData.get($scope.indexEvento);
    $scope.carouselIndex = 0;*/
  };
  //funcion para acceder al avento anterior
  $scope.prevEvent = function() {
    if($scope.evntsIzq>0){
      $scope.evento=data.getEvnById($scope.idPrevEvent).evento;
      timeline.setSelection($scope.evento.id, {
        focus: true
      });
    $scope.carouselIndex = 0;
    }
    /*$scope.indexEvento = parseInt($scope.indexEvento);
    $scope.indexEvento = ($scope.indexEvento > 1) ? $scope.indexEvento - 1 : timeline.itemsData.length;
    timeline.setSelection($scope.indexEvento, {
      focus: true
    });
    $scope.evento = timeline.itemsData.get($scope.indexEvento);
    $scope.carouselIndex = 0;*/
  };
  //funcion para el ZOOM
  $scope.zoom = function(percentage) {
    var range = timeline.getWindow();
    var interval = range.end - range.start;
    timeline.setWindow({
      start: range.start.valueOf() - interval * percentage,
      end: range.end.valueOf() + interval * percentage
    });
  };
}]);
controllers.filter('count', function() {
  return function(collection, key) {
    var out = "test";
    for (var i = 0; i < collection.length; i++) {
    }
    return out;
  };
});
controllers.filter('groupBy', function() {
  return function(collection, key) {
    if (collection === null) return;
    return uniqueItems(collection, key);
  };
});
