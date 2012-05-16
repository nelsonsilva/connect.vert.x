vertx = require('vertx')

class Server

  constructor: ->
    @stack = []

    @server = vertx.createHttpServer()

    @server.requestHandler @handle

  use: (routeOrHandler, handler = null) ->
    route = '/'

    if ('string' != typeof routeOrHandler)
      handler = routeOrHandler;
      route = '/'

    # wrap sub-apps
    if ('function' == typeof handler)
      appHandler = handler
      handler = (req, res, next) ->
        appHandler(req, res, next);

    # normalize route to not trail with slash
    if ('/' == route[route.length - 1])
      route = route.substr(0, route.length - 1);

    @stack.push { route: route, handler: handler }
    @


  on: (evt, handler) -> stdout.print "Registered for event #{evt} of server\n"

  listen: (port, host = 'localhost') ->  @server.listen(port, host)

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
        req.url = {pathname: req.path.substr(removed.length)}
        req.url.pathname = "/" + req.url.pathname  unless "/" is req.url.pathname[0]
        layer.handler req, res, next

      catch e
          stdout.print "Exception #{e}"
          next e

    stack = @stack
    removed = ""
    index = 0
    next()

connect = -> new Server()

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
        stdout.print line + '\n'

    next();

connect.router = require('./router')

module.exports = connect