var express = require('express');
var mongoose = require('mongoose');
var http = require('http');
var connectUtils = require('connect/lib/utils');
var config = require('./config');
var mapper = require('./mapper');
var app = express();

mapper.init(function(err) {
  if(err) {
    console.log("Error validating locations: " + err);
    process.exit(1);
  }
  
  app.configure(function() {
    app.use(express.bodyParser());
    //app.use(express.static('./public'));

    // Routing
    app.use(app.router);
    
    app.get('/api/locations', mapper.getLocations);
    app.get('/api/location/:id/to/:destination', mapper.getRoute);
    app.get('/api/location/:id', mapper.getLocation);
  });

  var appServer = http.createServer(app);

  appServer.listen(config.port);

  module.exports = app;
});
