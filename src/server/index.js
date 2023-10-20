
import http from 'http'
import app from './server'

const server = http.createServer(app);
server.listen(5000);

let currentApp = app;
if (module.hot) {
  module.hot.accept('./server', () => {
    server.removeListener('request', currentApp);
    server.on('request', app);
    currentApp = app;
  });
}
