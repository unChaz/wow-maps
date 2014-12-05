var config       = require('./config');
var _            = require('underscore');
var locations    = require('./locations.json');
var paths        = require('./paths.json');
var zones        = require('./zones.json');
var locationsObj = {};

var mapper = {

};

/*
A Heuristic to measure the distance from one 
node to another that are in the same zone.
*/
mapper.distanceToNode = function(node, otherNode) {
  var xDelta = (node.xCoord-otherNode.xCoord);
  var yDelta = (node.yCoord-otherNode.yCoord);
  var xSquared = Math.pow(xDelta, 2) || 1;
  var ySquared = Math.pow(yDelta, 2) || 1;
  return Math.sqrt(xSquared + ySquared);
}

/*
A Heuristic to measure the distance between 2
nodes in different zones.
*/
mapper.distanceToOtherZoneNode = function(node, goal) {
  var zoneBorder = zones[node.zone][goal.zone].borderCoordinates;
  var goalBorder = zones[goal.zone][node.zone].borderCoordinates;
  var zoneToZoneDistance = zones[goal.zone][node.zone].travelTime;
  var distanceToGoal = mapper.distanceToNode(node, goalBorder);
  var distanceToNode = mapper.distanceToNode(node, zoneBorder);
  return (distanceToNode + zoneToZoneDistance + distanceToGoal);
}

mapper.edgeHeuristic = function(edgeId, goal){
  var node = locationsObj[edgeId];
  if(node.zone === goal.zone) {
    return mapper.distanceToNode(node, goal);
  } else {
    return mapper.distanceToOtherZoneNode(node, goal);
  }
}

mapper.formDirection = function(node, distance, type) {
  var direction = {
    location: node.properName, 
    id:       node.id,
    zone:     node.zone,
    continent:node.continent,
    xCoord:   node.xCoord, 
    yCoord:   node.yCoord,
    distance: distance,
    type: type
  }
  return direction;
}

var navigate = function(startNode, destinationNode) {
  var directions = [
    {
      start:     true,
      location:  startNode.properName,
      id:        startNode.id,
      zone:      startNode.zone,
      continent: startNode.continent,
      xCoord:    startNode.xCoord,
      yCoord:    startNode.yCoord,
    }
  ];
  
  function search(node, goal, last) {
    if(node.id === goal.id) {
      return;
    } else {
      var lowestVal;
      var winningNode;
      node.edges.forEach(function(edgeId) {
        if(last && last.id == edgeId){
          //do nothing
        } else {
          var heuristic = mapper.edgeHeuristic(edgeId, goal);
          var edge = locationsObj[edgeId];
          var path = node.paths[edgeId];
          if(!lowestVal || heuristic < lowestVal) {
            lowestVal = heuristic;
            winningNode = edge;
            winningNode.type = path.type;
          }
        }
      });
      if(winningNode) {
        var direction = mapper.formDirection(winningNode, lowestVal, winningNode.type);
        if(winningNode.id == goal.id) {
          direction.goal = true;
        }
        directions.push(direction);
        search(winningNode, goal, node);
      }
    }
  }
  
  search(startNode, destinationNode);
  return directions;
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
      return callback("Invalid Path location ID: " + JSON.stringify(path));
    }
    
    if(path.lambdaNode === path.sigmaNode) {
      return callback("Path cannot lead to itself: " + JSON.stringify(path));
    }
    
    if(locationsObj[path.lambdaNode].edges[path.sigmaNode]) {
      return callback("Duplicate Path: " + JSON.stringify(path));
    }
    
    if(locationsObj[path.sigmaNode].edges[path.lambdaNode]) {
      return callback("Duplicate Path: " + JSON.stringify(path));
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
  
  var startNode = locationsObj[startNodeId];
  var endNode = locationsObj[endNodeId];
  var directions = navigate(startNode, endNode);
  return res.send(200, directions);
};

module.exports = mapper;