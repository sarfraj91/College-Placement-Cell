const errorMiddleware = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    err.message = err.message || 'Internal Server Error';

    return res.status(err.statusCode).json({
        success: false,
        status: err.status,
        message: err.message,
        stack: err.stack,
    });
}

  
export default errorMiddleware;