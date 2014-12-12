var config       = require('./config');
var _            = require('underscore');
var locations    = require('./locations.json');
var paths        = require('./paths.json');
var zones        = require('./zones.json');
var locationsObj = {};

var mapper = {

};

/*
A Heuristic to measure the distance between the node and 
the given set of coordinates.
*/
mapper.distanceToNodeFromCoords = function(node, coords) {
    var xDelta = (node.xCoord - coords.x);
    var yDelta = (node.yCoord - coords.y);
    var xSquared = Math.pow(xDelta, 2) || 1;
    var ySquared = Math.pow(yDelta, 2) || 1;
    return Math.sqrt(xSquared + ySquared);
}
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
  var distanceToGoal = mapper.distanceToNodeFromCoords(goal, goalBorder);
  var distanceToNode = mapper.distanceToNodeFromCoords(node, zoneBorder);
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

var navigate = function (startNode, destinationNode) {
    var directions = [];

  function search(start, goal) {
      //Create an open list of nodes to be evaluated.
      var openList = [];

      //Create a closed list of nodes already evaluated.
      var closedList = [];

      //Establish starting node's g, h, and f values, as well as its parent.
      start.g = 0;
      start.h = mapper.edgeHeuristic(start.id, goal);
      start.f = start.g + start.h;
      start.parent = null;

      //Add starting node to the open list.
      openList.push(start);

      //Search while the open list contains nodes.
      while (openList.length > 0) {
          
          //Select the open list node with the lowest f value.
          var lowestIndex = 0;
          for (var i = 0; i < openList.length; i++) {
              if (openList[i].f < openList[lowestIndex].f) {
                  lowestIndex = i;
              }
          }
          var current = openList[lowestIndex];

          //Check if current is the goal. If so, return the solution path.
          if (current.id === goal.id) {
              buildSolutionPath(current, goal);
              return;
          }

          //Move current from open to closed.
          openList.splice(openList.indexOf(current), 1);
          closedList.push(current);

          //Add current's children to the open list.
          var children = current.edges;

          for (var i = 0; i < children.length; i++) {
              var child = locationsObj[children[i]];
              if (checkIfAlreadyVisited(child, closedList)) {
                  child.g = current.g + mapper.edgeHeuristic(current.id, child);
                  child.h = mapper.edgeHeuristic(child.id, goal);
                  child.f = child.g + child.h;
                  child.parent = current;
                  openList.push(child);
              }
          }
      }
  }

  function checkIfAlreadyVisited(node, list) {
      for (var i = 0; i < list.length; i++) {
          if (list[i].id === node.id) {
              return false;
          }
      }
      return true;
  }

  function buildSolutionPath(node, goal) {
      var direction;
      while (node.parent) {
          direction = mapper.formDirection(node, node.h, node.type);
          if (node.id === goal.id) {
              direction.goal = true;
          }
          directions.push(direction);
          node = node.parent;
      }
      appendStartLocation();
  }

  function appendStartLocation() {
      var startLocation =
      {
          start: true,
          location: startNode.properName,
          id: startNode.id,
          zone: startNode.zone,
          continent: startNode.continent,
          xCoord: startNode.xCoord,
          yCoord: startNode.yCoord,
  };
      directions.push(startLocation);
  }
  
  search(startNode, destinationNode);
  return directions.reverse();
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