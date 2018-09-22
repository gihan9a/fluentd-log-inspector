/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
require('babel-core/register');
require('marko/node-require');
const Koa = require('koa');

const template = require('./views/index.marko');

const port = process.env.PORT || 9999;

module.exports = function Server(inspectedDir, mode) {
  const app = new Koa();

  // read list of files
  const files = fs.readdirSync(inspectedDir);

  app.use((ctx) => {
    let data = null;
    let file = '';
    if (ctx.query.file) {
      file = ctx.query.file;
      const rawData = fs.readFileSync(
        path.join(inspectedDir, ctx.query.file),
        'utf8',
      );
      data = JSON.parse(rawData);
    }

    ctx.type = 'html';
    ctx.body = template.stream({
      file,
      files,
      data,
      mode,
    });
  });
  app.listen(port);
  console.log(`Server is up. Visit http://localhost:${port}`);

  return app;
};
