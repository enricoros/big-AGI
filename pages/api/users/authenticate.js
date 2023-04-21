import { apiHandler, usersRepo, omit } from 'helpers/api';

export default apiHandler({
    post: authenticate
});

function authenticate(req, res) {
    const { username, password } = req.body;
    const user = usersRepo.find(x => x.username === username && x.password === password);

    if (!user) throw 'Username or password is incorrect';

    // return basic user details on success
    return res.status(200).json(omit(user, 'password'));
}