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
  var distanceToNode = mapper.distanceToNode(zoneBorder, node);
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
  
  function search(node, goal, i, last) {
    console.log("Searching " + i);
    if(i>100) {
      return;
    }
    var lowestScore;
    var bestNode;
    var foundNode;
    node.edges.forEach(function(edgeId) {
      var edge = locationsObj[edgeId];
      console.log(JSON.stringify(edge));
      if(edge.type == "Border") {
        console.log("FOUND BORDER")
      }
      if(edge.type === "Border" 
        && edge.zone !== goal.zone 
        && zones[edge.zone][goal.zone].borderCoordinates.x == edge.xCoord
        && zones[edge.zone][goal.zone].borderCoordinates.y == edge.yCoord
      ) {
        foundNode = edge;
      }
      var heuristicTravelTime = mapper.edgeHeuristic(edgeId, goal);
      console.log("Heuristic: " + heuristicTravelTime);
      var actualTravelTime = node.paths[edgeId].travelTime 
      || mapper.distanceToNode(node, locationsObj[edgeId]);
      var edgeScore = heuristicTravelTime + actualTravelTime;
      if(!lowestScore || edgeScore < lowestScore) {
        lowestScore = edgeScore;
        bestNode = edgeId;
      }
    });
    if (!foundNode && bestNode) {
      foundNode = locationsObj[bestNode];
    }
    
    var distance = node.paths[foundNode.id].travelTime 
    || mapper.distanceToNode(node, foundNode);
    var direction = {
      location:   foundNode.properName,
      id:         foundNode.id,
      zone:       foundNode.zone,
      continent:  foundNode.continent,
      xCoord:     foundNode.xCoord,
      yCoord:     foundNode.yCoord,
      distance:   distance
    }
    directions.push(direction);
    if(foundNode.id == goal.id) {
      directions[directions.length - 1].goal = true;
      return;
    } else {
      i++;
      return search(foundNode, goal, i, node);
    }
  }
  
  search(startNode, destinationNode, 0);
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