var config       = require('./config');
var _            = require('underscore');
var locations    = require('./locations.json');
var paths        = require('./paths.json');
var locationsObj = {};

var mapper = {

};

var buildTree = function(nodeId, parentId, depth) {
  var location = locationsObj[nodeId];
  var node = {
    id: nodeId
  };
  
  if(locationsObj[parentId]) {
    var path = locationsObj[parentId].paths[nodeId];
    node.distance = path.travelTime;
    node.type = path.type;
  }
  
  if(depth >= config.treeDepth) {
    return node;
  } else {
    node.children = [];
    if(depth !== config.treeDepth) {
      location.edges.forEach(function(edge) {
        if(edge !== parentId) {
          node.children.push(buildTree(edge, node.id, depth + 1));
        }
      });
    }  
    return node;
  }
}

mapper.init = function(callback) {
  locations.forEach(function(location) {
    if(locationsObj[location.id]) {
      return callback("Duplicate Location ID: " + location.id);
    } else {
      locationsObj[location.id] = location;
      locationsObj[location.id].edges = [];
      locationsObj[location.id].paths = {};
    }
  });
  
  paths.forEach(function(path) {
    if(!locationsObj[path.lambdaNode] || !locationsObj[path.sigmaNode]) {
      return callback("Invalid Path location ID: " + path);
    }
    
    if(path.lambdaNode === path.sigmaNode) {
      return callback("Path cannot lead to itself: " + path);
    }
    
    if (!path.travelTime || !(typeof path.travelTime === 'number')) {
      return callback("Invalid or missing travel time: " + path);
    }
    
    if(locationsObj[path.lambdaNode].edges[path.sigmaNode]) {
      return callback("Duplicate Path: " + path);
    }
    
    if(locationsObj[path.sigmaNode].edges[path.lambdaNode]) {
      return callback("Duplicate Path: " + path);
    }
    
    locationsObj[path.lambdaNode].edges.push([path.sigmaNode]);
    locationsObj[path.lambdaNode].paths[path.sigmaNode] = path;
    
    locationsObj[path.sigmaNode].edges.push(path.lambdaNode);
    locationsObj[path.sigmaNode].paths[path.lambdaNode] = path;
  });

  return callback();
};

mapper.getLocations = function(req, res, next) {
  return res.send(locations);
}

mapper.getLocation = function(req, res, next) {
  if(!req.params.id) {
    return res.send(400);
  }
  
  if(locationsObj[req.params.id]) {
    return res.send(200, locationsObj[req.params.id]);
  } else {
    return res.send(404);
  }
}

mapper.getRoute = function(req, res, next) {
  var startNodeId = req.params.id;
  var endNodeId = req.params.destination;
  
  if(!startNodeId || !endNodeId) {
    return res.send(400, "Missing Start/End Node ID");
  }
  if(!locationsObj[startNodeId]) {
    return res.send(400, "Invalid Start Node ID");
  };
  if(!locationsObj[endNodeId]) {
    return res.send(400, "Invalid End Node ID");
  };
  
  var tree = buildTree(startNodeId, endNodeId, 0);
  return res.send(200, tree);
};

module.exports = mapper;