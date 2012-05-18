require('node.vert.x')

connect = require('./connect')

app = connect(
  connect.favicon(),
  connect.logger('dev'),
  connect.static('public'),
  connect.router(
    (app) ->
      app.get '/hello/:name', (req, res, next) ->
        name = req.params().name;
        res.end("hello #{name}")
      app.get '/goodbye/:name', (req, res, next) ->
        name = req.params().name;
        res.end("goodbye #{name}")
  )
)

app.use( (req, res) -> res.end('hello world\n'))

app.listen(3000)