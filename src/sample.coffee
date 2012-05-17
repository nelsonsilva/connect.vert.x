require('node.vert.x')

connect = require('./connect')

app = connect()
  .use(connect.logger('dev'))
  .use(connect.static('public'))
  .use( (req, res) -> res.end('hello world\n'))
 .listen(3000)