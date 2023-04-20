import { apiHandler, usersRepo, omit } from 'helpers/api';

export default apiHandler({
    get: getUsers
});

function getUsers(req, res) {
    // return users without passwords in the response
    const response = usersRepo.getAll().map(x => omit(x, 'password'));
    return res.status(200).json(response);
}