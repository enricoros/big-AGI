import { usersRepo } from 'helpers/api';

export { basicAuthMiddleware };

async function basicAuthMiddleware(req, res) {
    // make authenticate path public
    if (req.url === '/api/users/authenticate') {
        return;
    }

    // check for basic auth header
    if (!req.headers.authorization || req.headers.authorization.indexOf('Basic ') === -1) {
        throw { status: 401, message: 'Missing Authorization Header' };
    }

    // verify auth credentials
    const base64Credentials = req.headers.authorization.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');
    const user = await usersRepo.find(x => x.username === username && x.password === password);
    if (!user) {
        throw { status: 401, message: 'Invalid Authentication Credentials' };
    }

    // attach user to request object
    req.user = user
}
