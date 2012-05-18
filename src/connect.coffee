vertx = require('vertx')

{EventEmitter} = require('events')

class App extends EventEmitter

  constructor: ->
    @stack = []
    @route = '/'

    @vertxServer = vertx.createHttpServer()

    @routeMatcher = new vertx.RouteMatcher()

    @routeMatcher.noMatch @handle

    @vertxServer.requestHandler @routeMatcher

  use: (route, fn) ->

    pos = @stack.length - 1

    # Check for routes
    if route.routes?
      for route in route.routes
        do =>
          {method, path, handler} = route
          # Add the route
          @routeMatcher[method] path,
            # Wrap the handler
            (req) =>
              # Add the handler to the stack
              @stack.splice(pos,0, { route: req.path, handler: handler })
              @handle(req)
              @stack.splice(pos,1) # Remove it from the stack

      return @

    # default route to '/'
    if ('string' != typeof route)
      fn = route
      route = '/'

    # wrap sub-apps
    if ('function' == typeof fn.handle)
      server = fn
      fn.route = route
      fn = (req, res, next) ->
        server.handle(req, res, next)

    # normalize route to not trail with slash
    if ('/' == route[route.length - 1])
      route = route.substr(0, route.length - 1);

    @stack.push { route: route, handler: fn }
    @

  listen: (port, host = 'localhost') ->
    @vertxServer.listen(port, host)

  handle: (req) =>
    stack = @stack
    removed = ''
    index = 0

    res = req.response

    next = (err) ->
      req.url = removed + req.url
      req.originalUrl = req.originalUrl or req.url
      removed = ""
      layer = stack[index++]

      unless layer?
        if err
          msg = err.toString()
          res.statusCode = 500
          res.putHeader "Content-Type", "text/plain"
          res.end msg
        else
          res.statusCode = 404
          res.putHeader "Content-Type", "text/plain"
          res.end "Cannot " + req.method + " " + req.url

        return

      try
        path = req.path
        path = "/"  unless path?

        return next(err)  unless 0 is path.indexOf(layer.route)

        c = path[layer.route.length]

        return next(err)  if c and "/" isnt c and "." isnt c
        removed = layer.route

        # Refactor to use url.parse
        req.url = {pathname: req.path.substr(removed.length)}
        req.url.pathname = "/" + req.url.pathname  unless "/" is req.url.pathname[0]

        res.writeHead = (@statusCode, headers) ->  @putAllHeaders headers

        layer.handler req, res, next

      catch e
          stdout.print "Exception #{e}"
          next e

    stack = @stack
    removed = ""
    index = 0
    next()

connect = ->
  #app(req, res) -> app.handle(req, res)
  app = new App
  app.use argument for argument in arguments
  app

connect.static = (path) ->
   (req, res, next) ->
      file = path
      if req.url.pathname is '/'
        file += '/index.html'
      else if (req.url.pathname.indexOf('..') == -1)
        file += req.url.pathname

      vertx.fileSystem.exists file, (err, res) ->
        return next() unless res
        req.response.sendFile(file)


connect.logger = (options) ->
  fmt =  (req, res) ->
    remoteAddr = ""
    httpVersion = "1.1"
    date = new Date
    method = req.method
    url = req.uri
    referer = req.headers()["Referer"] || ""
    userAgent = req.headers()["User-Agent"]  || ""
    status = res.statusCode
    contentLength = "--" #res.length()
    responseTime = date - req._startTime

    "#{remoteAddr} - [#{date}] '#{method} #{url} HTTP/#{httpVersion}' #{status} #{contentLength} - #{responseTime} ms '#{referer}' '#{userAgent}'"

  (req, res, next) ->
    req._startTime = new Date;

    # mount safety
    return next() if (req._logging)

    # flag as logging
    req._logging = true;

    # immediate
    end = res.end;
    res.end = (chunk, encoding) ->
        res.end = end;
        res.end(chunk, encoding);
        line = fmt(req, res);
        return unless line?
        console.log line + '\n'

    next();

connect.router = (fn) ->
    app =
      routes: []

    methods = ["get", "post", "delete", "put"]
    for method in methods
      do (method) ->
        app[method] = (path, handler) ->
          app.routes.push {method: method, path: path, handler: handler}

    fn app
    app


connect.favicon = (path, options) ->
  options ?= {}
  path ?=  __dirname + '/../public/favicon.ico'
  maxAge = options.maxAge || 86400000;

  (req, res, next) ->
    return next() if ('/favicon.ico' != req.url)
    vertx.fileSystem.exists path, (err, res) ->
      return next() unless res
      req.response.sendFile(path)


module.exports = connect