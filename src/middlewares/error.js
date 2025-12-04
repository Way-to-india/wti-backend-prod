// import formatHttpLoggerResponse from '../winston/formatHttpLoggerResponse';
// import { httpLoggerDB } from '../winston/logger.service';
const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };

  error.message = err.message;

  if (err.code === 11000) {
    const message = `Duplicate Field value entered`;
    error = new ErrorResponse(message, 400);
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new ErrorResponse(message, 400);
  }

  console.log(JSON.stringify(error));

  // httpLoggerDB.error(error.message, formatHttpLoggerResponse(req, res, err));

  const statusCode = error.statusCode ? error.statusCode : 500;

  res.deliver(statusCode, false, {}, error.message || 'Server Error');
  // res.status(statusCode).json({
  //   success: false,

  //   error: error.message || 'Server Error',
  // });
};

module.exports = errorHandler;
