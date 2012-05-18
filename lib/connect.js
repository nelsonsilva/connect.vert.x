var App, EventEmitter, connect, vertx,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = Object.prototype.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

vertx = require('vertx');

EventEmitter = require('events').EventEmitter;

App = (function(_super) {

  __extends(App, _super);

  function App() {
    this.handle = __bind(this.handle, this);    this.stack = [];
    this.route = '/';
    this.vertxServer = vertx.createHttpServer();
    this.routeMatcher = new vertx.RouteMatcher();
    this.routeMatcher.noMatch(this.handle);
    this.vertxServer.requestHandler(this.routeMatcher);
  }

  App.prototype.use = function(route, fn) {
    var pos, server, _fn, _i, _len, _ref,
      _this = this;
    pos = this.stack.length - 1;
    if (route.routes != null) {
      _ref = route.routes;
      _fn = function() {
        var handler, method, path;
        method = route.method, path = route.path, handler = route.handler;
        return _this.routeMatcher[method](path, function(req) {
          _this.stack.splice(pos, 0, {
            route: req.path,
            handler: handler
          });
          _this.handle(req);
          return _this.stack.splice(pos, 1);
        });
      };
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        route = _ref[_i];
        _fn();
      }
      return this;
    }
    if ('string' !== typeof route) {
      fn = route;
      route = '/';
    }
    if ('function' === typeof fn.handle) {
      server = fn;
      fn.route = route;
      fn = function(req, res, next) {
        return server.handle(req, res, next);
      };
    }
    if ('/' === route[route.length - 1]) route = route.substr(0, route.length - 1);
    this.stack.push({
      route: route,
      handler: fn
    });
    return this;
  };

  App.prototype.listen = function(port, host) {
    if (host == null) host = 'localhost';
    return this.vertxServer.listen(port, host);
  };

  App.prototype.handle = function(req) {
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
        res.writeHead = function(statusCode, headers) {
          this.statusCode = statusCode;
          return this.putAllHeaders(headers);
        };
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

  return App;

})(EventEmitter);

connect = function() {
  var app, argument, _i, _len;
  app = new App;
  for (_i = 0, _len = arguments.length; _i < _len; _i++) {
    argument = arguments[_i];
    app.use(argument);
  }
  return app;
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
      return console.log(line + '\n');
    };
    return next();
  };
};

connect.router = function(fn) {
  var app, method, methods, _fn, _i, _len;
  app = {
    routes: []
  };
  methods = ["get", "post", "delete", "put"];
  _fn = function(method) {
    return app[method] = function(path, handler) {
      return app.routes.push({
        method: method,
        path: path,
        handler: handler
      });
    };
  };
  for (_i = 0, _len = methods.length; _i < _len; _i++) {
    method = methods[_i];
    _fn(method);
  }
  fn(app);
  return app;
};

connect.favicon = function(path, options) {
  var maxAge;
  if (options == null) options = {};
  if (path == null) path = __dirname + '/../public/favicon.ico';
  maxAge = options.maxAge || 86400000;
  return function(req, res, next) {
    if ('/favicon.ico' !== req.url) return next();
    return vertx.fileSystem.exists(path, function(err, res) {
      if (!res) return next();
      return req.response.sendFile(path);
    });
  };
};

module.exports = connect;
