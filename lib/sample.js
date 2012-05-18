var app, connect;

require('node.vert.x');

connect = require('./connect');

app = connect(connect.favicon(), connect.logger('dev'), connect.static('public'), connect.router(function(app) {
  app.get('/hello/:name', function(req, res, next) {
    var name;
    name = req.params().name;
    return res.end("hello " + name);
  });
  return app.get('/goodbye/:name', function(req, res, next) {
    var name;
    name = req.params().name;
    return res.end("goodbye " + name);
  });
}));

app.use(function(req, res) {
  return res.end('hello world\n');
});

app.listen(3000);
