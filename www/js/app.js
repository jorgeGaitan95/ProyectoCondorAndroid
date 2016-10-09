angular.module('starter', ['ionic', 'started.controllers', 'ngCordova', 'ngAnimate', 'angular-carousel', 'started.directives', 'started.services', 'ionic.rating'])

.run(function($ionicPlatform, pouchDBService, $ionicPopup,connectionService) {
  $ionicPlatform.ready(function() {
    if (window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      cordova.plugins.Keyboard.disableScroll(true);
    }
    if (window.StatusBar) {
      StatusBar.styleDefault();
    }
    if (window.Connection) {
      if (navigator.connection.type == Connection.NONE) {
        $ionicPopup.alert({
          title: "Sin acceso a internet",
          content: "Este dispositivo no esta conectado a una red solo se puede iniciar de manera offline"
        });
      }
    }
  });
  pouchDBService.init();
  pouchDBService.initRemote("https://robinsonuq:robinson123456@robinsonuq.cloudant.com/storetimeline");
})

.config(function($stateProvider, $urlRouterProvider, $ionicConfigProvider,$compileProvider) {
  $ionicConfigProvider.platform.android.scrolling.jsScrolling(false);
  $stateProvider

    .state('login', {
      cache: false,
      url: '/login',
      templateUrl: 'templates/login.html',
      controller: 'loginCtrl'
    })
    .state('app', {
      cache: false,
      url: '/app',
      abstract: true,
      templateUrl: 'templates/side-menu.html',
      controller: 'appCtrl'
    })

  .state('app.store', {
      url: '/store',
      views: {
        'menuContent': {
          templateUrl: 'templates/store.html',
          controller: 'storeCtrl'
        }
      }
    })
    .state('app.detalles', {
      url: '/store/:idTimeline',
      views: {
        'menuContent': {
          templateUrl: 'templates/detalles.html',
          controller: 'detallesCtrl'
        }
      }
    })
    .state('app.timeline', {
      url: '/timeline',
      views: {
        'menuContent': {
          templateUrl: 'templates/timeline.html',
          controller: 'TimelineCtrl'
        }
      }
    });
  $urlRouterProvider.otherwise('/login');
});
