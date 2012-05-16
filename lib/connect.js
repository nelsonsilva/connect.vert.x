var Server, connect, vertx,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

vertx = require('vertx');

Server = (function() {

  function Server() {
    this.handle = __bind(this.handle, this);    this.stack = [];
    this.server = vertx.createHttpServer();
    this.server.requestHandler(this.handle);
  }

  Server.prototype.use = function(routeOrHandler, handler) {
    var appHandler, route;
    if (handler == null) handler = null;
    route = '/';
    if ('string' !== typeof routeOrHandler) {
      handler = routeOrHandler;
      route = '/';
    }
    if ('function' === typeof handler) {
      appHandler = handler;
      handler = function(req, res, next) {
        return appHandler(req, res, next);
      };
    }
    if ('/' === route[route.length - 1]) route = route.substr(0, route.length - 1);
    this.stack.push({
      route: route,
      handler: handler
    });
    return this;
  };

  Server.prototype.on = function(evt, handler) {
    return stdout.print("Registered for event " + evt + " of server\n");
  };

  Server.prototype.listen = function(port, host) {
    if (host == null) host = 'localhost';
    return this.server.listen(port, host);
  };

  Server.prototype.handle = function(req) {
    var index, next, removed, res, stack;
    stack = this.stack;
    removed = '';
    index = 0;
    res = req.response;
    next = function(err) {
      var c, layer, msg, path;
      req.url = removed + req.url;
      req.originalUrl = req.originalUrl || req.url;
      removed = "";
      layer = stack[index++];
      if (layer == null) {
        if (err) {
          msg = err.toString();
          res.statusCode = 500;
          res.putHeader("Content-Type", "text/plain");
          res.end(msg);
        } else {
          res.statusCode = 404;
          res.putHeader("Content-Type", "text/plain");
          res.end("Cannot " + req.method + " " + req.url);
        }
        return;
      }
      try {
        path = req.path;
        if (path == null) path = "/";
        if (0 !== path.indexOf(layer.route)) return next(err);
        c = path[layer.route.length];
        if (c && "/" !== c && "." !== c) return next(err);
        removed = layer.route;
        req.url = {
          pathname: req.path.substr(removed.length)
        };
        if ("/" !== req.url.pathname[0]) req.url.pathname = "/" + req.url.pathname;
        return layer.handler(req, res, next);
      } catch (e) {
        stdout.print("Exception " + e);
        return next(e);
      }
    };
    stack = this.stack;
    removed = "";
    index = 0;
    return next();
  };

  return Server;

})();

connect = function() {
  return new Server();
};

connect.static = function(path) {
  return function(req, res, next) {
    var file;
    file = path;
    if (req.url.pathname === '/') {
      file += '/index.html';
    } else if (req.url.pathname.indexOf('..') === -1) {
      file += req.url.pathname;
    }
    return vertx.fileSystem.exists(file, function(err, res) {
      if (!res) return next();
      return req.response.sendFile(file);
    });
  };
};

connect.logger = function(options) {
  var fmt;
  fmt = function(req, res) {
    var contentLength, date, httpVersion, method, referer, remoteAddr, responseTime, status, url, userAgent;
    remoteAddr = "";
    httpVersion = "1.1";
    date = new Date;
    method = req.method;
    url = req.uri;
    referer = req.headers()["Referer"] || "";
    userAgent = req.headers()["User-Agent"] || "";
    status = res.statusCode;
    contentLength = "--";
    responseTime = date - req._startTime;
    return "" + remoteAddr + " - [" + date + "] '" + method + " " + url + " HTTP/" + httpVersion + "' " + status + " " + contentLength + " - " + responseTime + " ms '" + referer + "' '" + userAgent + "'";
  };
  return function(req, res, next) {
    var end;
    req._startTime = new Date;
    if (req._logging) return next();
    req._logging = true;
    end = res.end;
    res.end = function(chunk, encoding) {
      var line;
      res.end = end;
      res.end(chunk, encoding);
      line = fmt(req, res);
      if (line == null) return;
      return stdout.print(line + '\n');
    };
    return next();
  };
};

connect.router = require('./router');

module.exports = connect;
