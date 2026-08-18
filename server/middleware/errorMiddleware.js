const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Server Error';

  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    message = 'Invalid ObjectId';
  }

  if (err.code === 11000) {
    statusCode = 400;
    message = 'Duplicate field value entered';
  }

  let code = 'INTERNAL_SERVER_ERROR';
  
  if (err.name === 'ValidationError') {
    code = 'VALIDATION_ERROR';
  } else if (statusCode === 401) {
    code = 'UNAUTHORIZED';
  } else if (statusCode === 403) {
    code = 'FORBIDDEN';
  } else if (statusCode === 404) {
    code = 'NOT_FOUND';
  }

  const errorResponse = {
    error: {
      code,
      message,
      details: err.details || {},
    }
  };

  if (process.env.NODE_ENV !== 'production') {
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

module.exports = {
  notFound,
  errorHandler,
};
