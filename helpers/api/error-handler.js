export { errorHandler };

function errorHandler(err, res) {
    if (typeof (err) === 'string') {
        // custom application error
        return res.status(400).json({ message: err });
    }

    if (err.status) {
        // status code set in error object
        return res.status(err.status).json({ message: err.message });
    }

    // default to 500 server error
    return res.status(500).json({ message: err.message });
}