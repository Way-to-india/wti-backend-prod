import type { Application } from 'express';
import user from './user';
import admin from './admin';
import common from './common';

const routerSetup = (app: Application) =>
  app
    .get('/', (_req, res) => {
      res.deliver(200,true,{},"API WORKING")
    })
    .use('/api/user', user)
    .use('/api/admin',admin)
    .use('/api/common',common)
    
export default routerSetup;
